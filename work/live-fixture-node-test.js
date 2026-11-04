// Local WASM integration check for out-of-order and tampered RSA-authenticated live pieces.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');

const root = __dirname;
const configPath = path.join(root, 'live-fixture-node-test.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const wasmJsPath = process.argv[2] || path.join(root, 'acetv-wire-probe/app/core/ace_wire.js');
const wasmPath = process.argv[3] || path.join(root, 'acetv-wire-probe/app/core/ace_wire_bg.wasm');

function bencode(value) {
  if (Number.isSafeInteger(value)) return Buffer.from(`i${value}e`);
  if (Buffer.isBuffer(value) || value instanceof Uint8Array) {
    const b = Buffer.from(value); return Buffer.concat([Buffer.from(`${b.length}:`), b]);
  }
  if (Array.isArray(value)) return Buffer.concat([Buffer.from('l'), ...value.map(bencode), Buffer.from('e')]);
  const keys = Object.keys(value).map(k => Buffer.from(k)).sort(Buffer.compare);
  return Buffer.concat([Buffer.from('d'), ...keys.flatMap(k => [bencode(k), bencode(value[k.toString()])]), Buffer.from('e')]);
}
function frame(body) { const h = Buffer.alloc(4); h.writeUInt32BE(body.length); return Buffer.concat([h, body]); }
function ext(body) { return frame(Buffer.concat([Buffer.from([20, 0]), bencode(body)])); }
function pieceFrame(piece, chunk, bytes) {
  const h = Buffer.alloc(8); h.writeDoubleBE(1800000100);
  const coords = Buffer.alloc(8); coords.writeUInt32BE(0, 0); coords.writeUInt32BE(piece, 4);
  const chunkIndex = Buffer.alloc(2); chunkIndex.writeUInt16BE(chunk);
  return frame(Buffer.concat([Buffer.from([7]), coords, h, chunkIndex, bytes]));
}
function feedSetup(peer, descriptor, targetHash) {
  const hello = Buffer.from(peer.take_outgoing());
  if (hello.length !== 66 || hello.subarray(26, 46).toString('hex') !== targetHash) throw Error('bad outgoing AceStream handshake/infohash');
  peer.feed(Buffer.concat([hello.subarray(0, 46), Buffer.alloc(20)]));
  peer.take_outgoing(); // its signed extended handshake
  peer.feed(ext({mi:{min_piece:100,max_piece:100,position:100,distance_from_source:0}}));
  peer.take_outgoing(); // refreshed signed mi and Interested
  peer.feed(frame(Buffer.from([1]))); // Unchoke
  peer.take_outgoing(); // four chunk requests
}

(async () => {
  globalThis.crypto = crypto.webcrypto;
  const source = fs.readFileSync(wasmJsPath, 'utf8') + '\nglobalThis.__liveWasmBindgen = wasm_bindgen;\n';
  vm.runInThisContext(source, {filename:wasmJsPath});
  await globalThis.__liveWasmBindgen({module_or_path:new Uint8Array(fs.readFileSync(wasmPath))});
  const descriptor = Buffer.from(config.descriptorBase64, 'base64');
  const hash = JSON.parse(fs.readFileSync(path.join(root, 'acetv-live-probe/app/fixture-config.json'), 'utf8')).targetHash;
  const key = crypto.createPrivateKey(config.rsaPrivateKeyPem);
  const payload = Buffer.alloc(config.expectedMediaBytes);
  for (let i = 0; i < payload.length; i++) payload[i] = (i * 31 + 7) & 255;
  const signature = crypto.sign('sha1', payload, {key, padding:crypto.constants.RSA_PKCS1_PADDING});
  if (signature.length !== 128) throw Error(`expected RSA-1024 signature, got ${signature.length}`);
  const wire = Buffer.concat([payload, signature]);

  const peer = new globalThis.__liveWasmBindgen.LivePeer(descriptor, new Uint8Array(32).fill(7));
  feedSetup(peer, descriptor, hash);
  const header = 65536 - wire.length;
  if (header !== 0) throw Error('local payload must fill one 64 KiB piece with its signature');
  for (let chunk = 3; chunk >= 0; chunk--) peer.feed(pieceFrame(100, chunk, wire.subarray(chunk*16384, (chunk+1)*16384)));
  const media = Buffer.from(peer.take_media());
  if (!media.equals(payload)) throw Error(`verified media differs (${media.length} bytes)`);
  const status = JSON.parse(peer.status_json());
  if (status.verified_pieces !== 1 || status.state !== 'live') throw Error(`unexpected success status: ${JSON.stringify(status)}`);
  peer.free();

  const badPeer = new globalThis.__liveWasmBindgen.LivePeer(descriptor, new Uint8Array(32).fill(8));
  feedSetup(badPeer, descriptor, hash);
  const corrupted = Buffer.from(wire); corrupted[corrupted.length-1] ^= 1;
  let rejected = false;
  try {
    for (let chunk = 3; chunk >= 0; chunk--) badPeer.feed(pieceFrame(100, chunk, corrupted.subarray(chunk*16384, (chunk+1)*16384)));
  } catch (_) { rejected = true; }
  const badStatus = JSON.parse(badPeer.status_json());
  if (!rejected || badStatus.state !== 'failed' || badStatus.verified_pieces !== 0) throw Error('tampered RSA piece was not rejected');
  badPeer.free();
  console.log(JSON.stringify({ok:true,out_of_order_chunks:4,rsa_signature_verified:true,media_bytes:media.length,
    tampered_signature_rejected:true,success_status:status.state,rejection_status:badStatus.state}));
})().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
