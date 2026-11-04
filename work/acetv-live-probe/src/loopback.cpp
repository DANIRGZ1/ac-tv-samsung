#include <arpa/inet.h>
#include <errno.h>
#include <stdio.h>
#include <string.h>
#include <sys/socket.h>
#include <unistd.h>

// This server is deliberately independent of the peer socket in network.cpp.
// AVPlay connects to it from the TV itself; only loopback clients are accepted.
static const unsigned int kQueueSize = 8u * 1024u * 1024u;
static const int kRequestLimit = 4096;
static const int kChunkSize = 65536;
static unsigned char queueBytes[8u * 1024u * 1024u];
static unsigned char outgoing[kChunkSize];
static int listenerFd = -1;
static int clientFd = -1;
static unsigned int queueHead = 0, queueUsed = 0;
static char streamToken[65];
static int ended = 0;
static char requestBytes[kRequestLimit + 1];
static int requestUsed = 0;
static int responseState = 0; // 0=request, 1=response headers, 2=body
static int responseOffset = 0, responseLength = 0;
static int responseHeadOnly = 0;
static int bodyState = 0; // 0=need chunk, 1=chunk header, 2=data, 3=trailer
static char chunkHeader[24];
static int chunkHeaderLength = 0, chunkHeaderOffset = 0;
static int chunkLength = 0, chunkOffset = 0;
static int trailerOffset = 0;
static int finalChunk = 0;

static void close_client() {
  if (clientFd >= 0) close(clientFd);
  clientFd = -1; requestUsed = 0; responseState = 0;
  responseOffset = responseLength = 0; responseHeadOnly = 0;
  bodyState = 0; chunkLength = chunkOffset = 0;
  chunkHeaderLength = chunkHeaderOffset = trailerOffset = 0;
  finalChunk = 0;
}

static void close_all() {
  close_client();
  if (listenerFd >= 0) close(listenerFd);
  listenerFd = -1; queueHead = queueUsed = 0; ended = 0;
  streamToken[0] = '\0';
}

static int is_hex_token(const char* token) {
  if (!token) return 0;
  int n = 0;
  while (token[n]) {
    char c = token[n];
    if (!((c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') ||
          (c >= 'A' && c <= 'F')) || n >= 64) return 0;
    ++n;
  }
  return n >= 16 && n <= 64;
}

static void begin_response(const char* text, int length, int headOnly) {
  responseState = 1; responseOffset = 0; responseLength = length;
  responseHeadOnly = headOnly;
  // The response text is copied into requestBytes only after parsing is done.
  if (length > kRequestLimit) { close_client(); return; }
  memcpy(requestBytes, text, (size_t)length);
}

static void reject_request() {
  static const char notFound[] =
      "HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\nConnection: close\r\n\r\n";
  begin_response(notFound, (int)sizeof(notFound) - 1, 1);
}

static void parse_request() {
  requestBytes[requestUsed] = '\0';
  char* end = strstr(requestBytes, "\r\n");
  if (!end) { reject_request(); return; }
  *end = '\0';
  char method[8], target[96], version[16], extra;
  if (sscanf(requestBytes, "%7s %95s %15s %c", method, target, version, &extra) != 3 ||
      (strcmp(version, "HTTP/1.0") && strcmp(version, "HTTP/1.1"))) {
    reject_request(); return;
  }
  const int isHead = !strcmp(method, "HEAD");
  if ((!isHead && strcmp(method, "GET")) || target[0] != '/') {
    reject_request(); return;
  }
  char expected[72];
  int n = snprintf(expected, sizeof(expected), "/%s.ts", streamToken);
  if (n < 0 || (size_t)n >= sizeof(expected) || strcmp(target, expected)) {
    reject_request(); return;
  }
  static const char ok[] =
      "HTTP/1.1 200 OK\r\nContent-Type: video/mp2t\r\n"
      "Transfer-Encoding: chunked\r\nConnection: close\r\n"
      "Cache-Control: no-cache, no-store\r\n\r\n";
  begin_response(ok, (int)sizeof(ok) - 1, isHead);
}

static int request_complete() {
  for (int i = 3; i < requestUsed; ++i) {
    if (requestBytes[i - 3] == '\r' && requestBytes[i - 2] == '\n' &&
        requestBytes[i - 1] == '\r' && requestBytes[i] == '\n') return 1;
  }
  return 0;
}

static int try_send(const void* data, int length, int* offset) {
  if (*offset >= length) return 1;
  int n = (int)send(clientFd, (const char*)data + *offset,
                    (size_t)(length - *offset), MSG_DONTWAIT | MSG_NOSIGNAL);
  if (n > 0) { *offset += n; return *offset >= length; }
  if (n < 0 && (errno == EINTR || errno == EAGAIN || errno == EWOULDBLOCK)) return 0;
  close_client(); return -1;
}

static void accept_clients() {
  // Bound work per tick. An accepted fd is kept blocking-mode; MSG_DONTWAIT is
  // applied to every client recv/send because old TV SDKs lack accept4().
  for (int i = 0; i < 4; ++i) {
    sockaddr_in peer; socklen_t peerLen = sizeof(peer);
    int fd = accept(listenerFd, (sockaddr*)&peer, &peerLen);
    if (fd < 0) {
      if (errno == EINTR) { --i; continue; }
      return;
    }
    if (peer.sin_family != AF_INET || ntohl(peer.sin_addr.s_addr) != 0x7f000001u) {
      close(fd); continue;
    }
    if (clientFd >= 0) { close(fd); continue; }
    clientFd = fd; requestUsed = 0; responseState = 0;
  }
}

extern "C" {
int stream_open(const char* token) {
  close_all();
  if (!is_hex_token(token)) return -EINVAL;
  strncpy(streamToken, token, sizeof(streamToken) - 1);
  streamToken[sizeof(streamToken) - 1] = '\0';
  listenerFd = socket(AF_INET, SOCK_STREAM | SOCK_NONBLOCK, 0);
  if (listenerFd < 0) { int e = errno; close_all(); return -e; }
  int reuse = 1;
  setsockopt(listenerFd, SOL_SOCKET, SO_REUSEADDR, &reuse, sizeof(reuse));
  sockaddr_in addr; memset(&addr, 0, sizeof(addr));
  addr.sin_family = AF_INET; addr.sin_addr.s_addr = htonl(INADDR_LOOPBACK);
  addr.sin_port = 0;
  if (bind(listenerFd, (sockaddr*)&addr, sizeof(addr)) < 0 || listen(listenerFd, 4) < 0) {
    int e = errno; close_all(); return -e;
  }
  socklen_t addrLen = sizeof(addr);
  if (getsockname(listenerFd, (sockaddr*)&addr, &addrLen) < 0) {
    int e = errno; close_all(); return -e;
  }
  return (int)ntohs(addr.sin_port);
}

int stream_enqueue(const unsigned char* bytes, int len) {
  if (listenerFd < 0) return -EBADF;
  if (len < 0 || (len > 0 && !bytes)) return -EINVAL;
  if (len == 0) return 0;
  if ((unsigned int)len > kQueueSize - queueUsed) return 0;
  unsigned int tail = (queueHead + queueUsed) % kQueueSize;
  unsigned int first = kQueueSize - tail;
  if (first > (unsigned int)len) first = (unsigned int)len;
  memcpy(queueBytes + tail, bytes, first);
  if ((unsigned int)len > first) memcpy(queueBytes, bytes + first, (unsigned int)len - first);
  queueUsed += (unsigned int)len;
  return len;
}

int stream_buffered() { return (int)queueUsed; }
void stream_end() { ended = 1; }

void stream_tick() {
  if (listenerFd < 0) return;
  accept_clients();
  if (clientFd < 0) return;

  if (responseState == 0) {
    // At most 4 KiB per tick, including fragmented request headers.
    int n = (int)recv(clientFd, requestBytes + requestUsed,
                      (size_t)(kRequestLimit - requestUsed), MSG_DONTWAIT);
    if (n == 0) { close_client(); return; }
    if (n < 0) {
      if (errno == EINTR || errno == EAGAIN || errno == EWOULDBLOCK) return;
      close_client(); return;
    }
    requestUsed += n;
    if (requestUsed >= 4 && request_complete()) parse_request();
    else if (requestUsed == kRequestLimit) reject_request();
  }
  if (clientFd < 0) return;
  int sent;
  if (responseState == 1) {
    sent = try_send(requestBytes, responseLength, &responseOffset);
    if (sent <= 0) return;
    if (responseHeadOnly) { close_client(); return; }
    responseState = 2;
  }
  if (responseState != 2) return;

  // Bound each tick to at most four TS chunks. Every framing and payload write
  // tracks partial progress, and the ring advances only after payload delivery.
  for (int i = 0; i < 4 && clientFd >= 0; ++i) {
    if (bodyState == 0) {
      if (!queueUsed) {
        if (!ended) return;
        static const char last[] = "0\r\n\r\n";
        if (!finalChunk) { memcpy(chunkHeader, last, sizeof(last) - 1); chunkHeaderLength = (int)sizeof(last) - 1; chunkHeaderOffset = 0; finalChunk = 1; }
        bodyState = 4;
      } else {
        chunkLength = (int)queueUsed;
        if (chunkLength > kChunkSize) chunkLength = kChunkSize;
        unsigned int first = kQueueSize - queueHead;
        if (first > (unsigned int)chunkLength) first = (unsigned int)chunkLength;
        memcpy(outgoing, queueBytes + queueHead, first);
        if ((unsigned int)chunkLength > first) memcpy(outgoing + first, queueBytes, (unsigned int)chunkLength - first);
        int h = snprintf(chunkHeader, sizeof(chunkHeader), "%X\r\n", chunkLength);
        if (h <= 0 || h >= (int)sizeof(chunkHeader)) { close_client(); return; }
        chunkHeaderLength = h; chunkHeaderOffset = 0; chunkOffset = 0;
        trailerOffset = 0; bodyState = 1;
      }
    }
    if (bodyState == 1 || bodyState == 4) {
      sent = try_send(chunkHeader, chunkHeaderLength, &chunkHeaderOffset);
      if (sent <= 0) return;
      if (bodyState == 4) { close_client(); return; }
      bodyState = 2;
    }
    if (bodyState == 2) {
      sent = try_send(outgoing, chunkLength, &chunkOffset);
      if (sent <= 0) return;
      queueHead = (queueHead + (unsigned int)chunkLength) % kQueueSize;
      queueUsed -= (unsigned int)chunkLength;
      bodyState = 3;
    }
    if (bodyState == 3) {
      static const char crlf[] = "\r\n";
      sent = try_send(crlf, 2, &trailerOffset);
      if (sent <= 0) return;
      bodyState = 0;
    }
  }
}

void stream_close() { close_all(); }
}
