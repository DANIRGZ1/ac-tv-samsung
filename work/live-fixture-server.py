"""One synthetic Acestream live peer for the TV probe; never contacts a tracker."""
import base64, hashlib, json, pathlib, socket, struct, sys, time

ROOT = pathlib.Path(__file__).parent
sys.path.insert(0, str(ROOT / 'pythondeps'))
from cryptography.hazmat.primitives import hashes, padding
from cryptography.hazmat.primitives.asymmetric import ed25519, padding as asym_padding, rsa
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat, PrivateFormat, NoEncryption, load_pem_private_key

HOST, PORT, TV_IP = '127.0.0.1', 18681, '127.0.0.1'
PIECE, CHUNK = 65536, 16384
SIG_LEN = 128
PAYLOAD_PER_PIECE = PIECE - SIG_LEN
MAX_WIRE = 2 * 1024 * 1024
FIELDS = (b'name', b'authmethod', b'pubkey', b'piece_length', b'chunk_length', b'bitrate')

def benc(v):
    if isinstance(v, int): return b'i' + str(v).encode() + b'e'
    if isinstance(v, bytes): return str(len(v)).encode() + b':' + v
    if isinstance(v, list): return b'l' + b''.join(map(benc, v)) + b'e'
    if isinstance(v, dict): return b'd' + b''.join(benc(k) + benc(v[k]) for k in sorted(v)) + b'e'
    raise TypeError(type(v))

def bdec(data, pos=0):
    tag = data[pos:pos+1]
    if tag == b'i':
        end = data.index(b'e', pos); return int(data[pos+1:end]), end+1
    if tag in (b'd', b'l'):
        out = {} if tag == b'd' else []; pos += 1
        while data[pos:pos+1] != b'e':
            k, pos = bdec(data, pos)
            if tag == b'd': v, pos = bdec(data, pos); out[k] = v
            else: out.append(k)
        return out, pos+1
    end = data.index(b':', pos); size = int(data[pos:end]); end += 1
    return data[end:end+size], end+size

def recv_exact(conn, size):
    data = bytearray()
    while len(data) < size:
        part = conn.recv(size-len(data))
        if not part: raise EOFError('peer disconnected')
        data.extend(part)
    return bytes(data)

def recv_frame(conn):
    size = struct.unpack('!I', recv_exact(conn, 4))[0]
    if size > MAX_WIRE: raise ValueError('oversized peer frame')
    return recv_exact(conn, size)

def frame(body): return struct.pack('!I', len(body)) + body
def send_frame(conn, body): conn.sendall(frame(body))

def synthetic_media():
    paths = sorted((ROOT/'acetv-video-probe/app/media').glob('test-*.ts'))
    if len(paths) != 16: raise FileNotFoundError('expected 16 test-00.ts..15.ts source assets')
    media = b''.join(p.read_bytes() for p in paths)
    if len(media) % 188: raise ValueError('source TS concatenation is not packet aligned')
    return media

def make_fixture():
    media = synthetic_media()
    state_path = ROOT/'live-fixture-server-state.json'
    if state_path.exists():
        state = json.loads(state_path.read_text(encoding='utf-8'))
        descriptor = base64.b64decode(state['descriptorBase64'], validate=True)
        rsa_key = load_pem_private_key(state['rsaPrivateKeyPem'].encode(), password=None)
    else:
        rsa_key = rsa.generate_private_key(public_exponent=65537, key_size=1024)
        public_der = rsa_key.public_key().public_bytes(Encoding.DER, PublicFormat.SubjectPublicKeyInfo)
        d = {b'name':b'acetv-synthetic-live-fixture', b'authmethod':b'RSA', b'pubkey':public_der,
             b'piece_length':PIECE, b'chunk_length':CHUNK, b'bitrate':1000000,
             b'trackers':[]}
        plaintext = benc(d)
        padder = padding.PKCS7(128).padder(); padded = padder.update(plaintext) + padder.finalize()
        enc = Cipher(algorithms.AES(bytes.fromhex('a50c4e33a2f48cc50ce275c9ff3a31bf')),
                     modes.CBC(bytes.fromhex('74e9cdd6391bcbd565f99503313329a3'))).encryptor()
        descriptor = b'AceStreamTransport\x00\x02' + enc.update(padded) + enc.finalize()
        pem = rsa_key.private_bytes(Encoding.PEM, PrivateFormat.PKCS8, NoEncryption()).decode()
        state_path.write_text(json.dumps({'descriptorBase64':base64.b64encode(descriptor).decode(),
                                          'rsaPrivateKeyPem':pem}), encoding='utf-8')
    public_der = rsa_key.public_key().public_bytes(Encoding.DER, PublicFormat.SubjectPublicKeyInfo)
    count = (len(media) + PAYLOAD_PER_PIECE - 1) // PAYLOAD_PER_PIECE
    padded_len = count * PAYLOAD_PER_PIECE
    # MPEG-TS null PID packets for the bounded end padding; the final packet may be short.
    null_packet = b'\x47\x1f\xff\x10' + b'\xff' * 184
    media_padded = media + (null_packet * ((padded_len-len(media)+187)//188))[:padded_len-len(media)]
    pieces = []
    for i in range(count):
        payload = media_padded[i*PAYLOAD_PER_PIECE:(i+1)*PAYLOAD_PER_PIECE]
        signature = rsa_key.sign(payload, asym_padding.PKCS1v15(), hashes.SHA1())
        if len(signature) != SIG_LEN: raise ValueError('RSA signature has unexpected size')
        rsa_key.public_key().verify(signature, payload, asym_padding.PKCS1v15(), hashes.SHA1())
        pieces.append(payload + signature)
    # Reconstructing this descriptor from persisted state keeps the server's swarm identity
    # identical to the browser config generated by --prepare.
    decoded, end = bdec(benc({b'name':b'acetv-synthetic-live-fixture', b'authmethod':b'RSA', b'pubkey':public_der,
                              b'piece_length':PIECE, b'chunk_length':CHUNK, b'bitrate':1000000,
                              b'trackers':[]}))
    if end <= 0 or not decoded: raise AssertionError('synthetic descriptor fields unavailable')
    d = {b'name':b'acetv-synthetic-live-fixture', b'authmethod':b'RSA', b'pubkey':public_der,
         b'piece_length':PIECE, b'chunk_length':CHUNK, b'bitrate':1000000}
    infohash = hashlib.sha1(benc([[field, d[field]] for field in FIELDS])).digest()
    return descriptor, infohash, rsa_key, media, media_padded, pieces

def signed_ext(key, mi):
    fields = {b'ace_metadata_version':1, b'm':{b'ut_metadata':2}, b'mi':mi,
              b'node_id':key.public_key().public_bytes_raw(), b'signature':bytes(64),
              b'nt':1, b'p':8621, b'platform':2, b'pv':2, b'ts':1, b'tt':b'bt', b'v':3021100}
    fields[b'signature'] = key.sign(hashlib.sha256(benc(fields)).digest())
    return b'\x14\x00' + benc(fields)

def verify_tv_ext(body):
    if body[:2] != b'\x14\x00': raise ValueError('TV did not send ext handshake first')
    fields, end = bdec(body, 2)
    if end != len(body): raise ValueError('trailing TV ext bytes')
    signature = fields[b'signature']; fields[b'signature'] = bytes(64)
    ed25519.Ed25519PublicKey.from_public_bytes(fields[b'node_id']).verify(
        signature, hashlib.sha256(benc(fields)).digest())
    return fields

def myinfo(max_piece):
    d = {b'max_piece':max_piece, b'min_piece':100, b'position':max_piece}
    return b'\x09' + benc(d)  # unknown message id carrying the documented myinfo bencode shape

def run_server():
    report = {'test':'synthetic-live-peer', 'ok':False, 'pc_is_test_peer':True,
              'tv_ip':None, 'rsa_signatures_generated':0, 'sent_chunks':0, 'sent_pieces':0}
    started = time.monotonic()
    try:
        descriptor, infohash, rsa_key, media, padded_media, pieces = make_fixture()
        config_path = ROOT/'acetv-live-probe/app/fixture-config.json'
        if not config_path.exists(): raise FileNotFoundError('run --prepare before starting the live fixture')
        prepared = json.loads(config_path.read_text(encoding='utf-8'))
        if prepared.get('targetHash') != infohash.hex() or base64.b64decode(prepared.get('descriptorBase64',''), validate=True) != descriptor:
            raise ValueError('prepared TV config does not match fixture descriptor/infohash')
        report.update(expected_pieces=len(pieces), expected_media_bytes=len(padded_media),
                      payload_sha256=hashlib.sha256(padded_media).hexdigest(),
                      original_ts_bytes=len(media), rsa_signatures_generated=len(pieces),
                      rsa_signatures_validated=len(pieces),
                      descriptor_sha256=hashlib.sha256(descriptor).hexdigest())
        with socket.socket() as server:
            server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            server.bind((HOST, PORT)); server.listen(1); server.settimeout(180)
            print(f'Live fixture ready at {HOST}:{PORT}; waiting only for {TV_IP}', flush=True)
            conn, addr = server.accept()
            report['tv_ip'] = addr[0]
            if addr[0] != TV_IP: conn.close(); raise ValueError('connection is not from TV IP .13')
            with conn:
                conn.settimeout(25)
                hello = recv_exact(conn, 66)
                if hello[:18] != b'\x11AceStreamProtocol' or hello[26:46] != infohash:
                    raise ValueError('TV handshake protocol or descriptor infohash mismatch')
                reply = hello[:46] + b'-FIXTURE-LIVE-000000'
                if len(reply) != 66: raise AssertionError('bad reply handshake length')
                conn.sendall(reply[:19]); time.sleep(.04); conn.sendall(reply[19:])
                tv_ext = verify_tv_ext(recv_frame(conn))
                report['tv_signed_handshake_verified'] = True
                node = ed25519.Ed25519PrivateKey.generate()
                send_frame(conn, signed_ext(node, {b'min_piece':100,b'max_piece':100,b'position':100,
                                                   b'distance_from_source':0}))
                # LivePeer sends a refreshed signed mi for this window, then Interested.
                interested = False
                while not interested:
                    body = recv_frame(conn)
                    if body[:2] == b'\x14\x00':
                        verify_tv_ext(body); report['tv_live_mi_handshake_verified'] = True
                    elif body == b'\x02': interested = True
                    else: raise ValueError(f'unexpected pre-live frame id={body[:1].hex()}')
                send_frame(conn, b'\x01')  # Unchoke
                requests = set(); served_piece = None
                while report['sent_pieces'] < len(pieces):
                    body = recv_frame(conn)
                    if not body or body[0] != 6 or len(body) != 11:
                        raise ValueError('invalid Acestream custom chunk request')
                    stream, piece, chunk = struct.unpack('!IIH', body[1:])
                    if stream != 0 or piece < 100 or piece >= 100 + len(pieces) or chunk >= PIECE//CHUNK:
                        raise ValueError('chunk request outside fixture geometry/window')
                    requests.add((piece, chunk))
                    if len(requests) == PIECE//CHUNK:
                        served_piece = piece
                        # Reverse delivery order so peer-side assembly cannot assume FIFO.
                        for _, ch in sorted(requests, reverse=True):
                            wire = pieces[piece-100]
                            payload = struct.pack('!II', 0, piece) + struct.pack('!d', 1_800_000_000.0+piece)
                            payload += struct.pack('!H', ch) + wire[ch*CHUNK:(ch+1)*CHUNK]
                            send_frame(conn, b'\x07' + payload)
                            report['sent_chunks'] += 1
                            time.sleep(.05)  # ~320 KiB/s (~3x playback) and one requested piece at a time
                        report['sent_pieces'] += 1
                        report['last_piece'] = served_piece
                        requests.clear()
                        if report['sent_pieces'] < len(pieces): send_frame(conn, myinfo(100 + report['sent_pieces']))
                report.update(ok=True, stopped_after='all signed media pieces served')
                time.sleep(1)
    except Exception as exc:
        report['error'] = repr(exc)
    report['elapsed_seconds'] = round(time.monotonic()-started, 3)
    (ROOT/'live-fixture-report.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    print(json.dumps(report), flush=True)
    return 0 if report['ok'] else 1

def prepare():
    descriptor, infohash, key, media, media_padded, pieces = make_fixture()
    output = ROOT/'acetv-live-probe/app'; output.mkdir(parents=True, exist_ok=True)
    config = {'host':HOST, 'port':PORT, 'targetHash':infohash.hex(),
              'descriptorBase64':base64.b64encode(descriptor).decode(),
              'expectedPieces':len(pieces), 'expectedMediaBytes':len(media_padded)}
    (output/'fixture-config.json').write_text(json.dumps(config, indent=2), encoding='utf-8')
    node_config = {'descriptorBase64':config['descriptorBase64'], 'rsaPrivateKeyPem':key.private_bytes(
        Encoding.PEM, PrivateFormat.PKCS8, NoEncryption()).decode(), 'expectedMediaBytes':PAYLOAD_PER_PIECE}
    (ROOT/'live-fixture-node-test.json').write_text(json.dumps(node_config), encoding='utf-8')
    print(json.dumps({'fixture_config':str(output/'fixture-config.json'), 'targetHash':infohash.hex(),
                      'expectedPieces':len(pieces), 'expectedMediaBytes':len(media_padded)}), flush=True)

if __name__ == '__main__':
    if '--prepare' in sys.argv: prepare()
    else: sys.exit(run_server())
