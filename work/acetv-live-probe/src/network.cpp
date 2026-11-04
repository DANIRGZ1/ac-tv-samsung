#include <arpa/inet.h>
#include <errno.h>
#include <emscripten.h>
#include <poll.h>
#include <string.h>
#include <sys/socket.h>
#include <unistd.h>

static int fd = -1;
extern "C" {
int net_close() { if(fd >= 0) close(fd); fd=-1; return 0; }
int net_connect_udp(const char* host,int port) {
  net_close();if(port<1||port>65535)return -EINVAL;
  sockaddr_in addr;memset(&addr,0,sizeof(addr));addr.sin_family=AF_INET;addr.sin_port=htons(port);
  if(inet_pton(AF_INET,host,&addr.sin_addr)!=1)return -EINVAL;
  fd=socket(AF_INET,SOCK_DGRAM|SOCK_NONBLOCK,0);if(fd<0)return -errno;
  int rc=connect(fd,(sockaddr*)&addr,sizeof(addr));return rc==0?1:(errno==EINPROGRESS?0:-errno);
}
int net_connect(const char* host, int port) {
  net_close();
  if(port < 1 || port > 65535) return -EINVAL;
  sockaddr_in addr; memset(&addr,0,sizeof(addr));
  addr.sin_family=AF_INET; addr.sin_port=htons(port);
  if(inet_pton(AF_INET,host,&addr.sin_addr)!=1) return -EINVAL;
  fd=socket(AF_INET,SOCK_STREAM|SOCK_NONBLOCK,0);
  if(fd<0) return -errno;
  int rc=connect(fd,(sockaddr*)&addr,sizeof(addr));
  return rc==0 ? 1 : (errno==EINPROGRESS ? 0 : -errno);
}
int net_ready() {
  if(fd<0) return -EBADF;
  pollfd p={fd,POLLOUT,0}; int rc=poll(&p,1,0);
  if(rc<0)return -errno; if(!rc)return 0;
  int err=0; socklen_t len=sizeof(err);
  if(getsockopt(fd,SOL_SOCKET,SO_ERROR,&err,&len)<0)return -errno;
  return err ? -err : 1;
}
int net_write(const unsigned char* bytes,int len) {
  if(len<0||len>65536)return -EINVAL;
  int n=send(fd,bytes,len,0);
  return n>=0?n:((errno==EAGAIN||errno==EWOULDBLOCK||errno==EINTR)?0:-errno);
}
int net_read(unsigned char* bytes,int len) {
  if(len<1||len>65536)return -EINVAL;
  int n=recv(fd,bytes,len,0);
  // Stable bridge sentinel for orderly EOF; errno numbers vary across SDK targets.
  return n>0?n:(n==0?-4096:((errno==EAGAIN||errno==EWOULDBLOCK||errno==EINTR)?0:-errno));
}
}
extern "C" void stream_tick();
static void tick(){ stream_tick();EM_ASM({ if(Module.peerTick) Module.peerTick(); }); }
int main(){
  EM_ASM({ Module.startWire(); });
  emscripten_set_main_loop(tick,30,1);
  return 0;
}
