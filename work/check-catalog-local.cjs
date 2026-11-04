const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const core = 'work/acetv-wire-probe/app/core';
const fixture = 'work/outpace-research/tests/vectors/catalog/response.xml';
globalThis.self = globalThis;
vm.runInThisContext(fs.readFileSync(`${core}/ace_wire.js`, 'utf8'), { filename: 'ace_wire.js' });

function http(body, headers = `Content-Length: ${body.length}\r\nConnection: close\r\n`) {
  return Buffer.concat([Buffer.from(`HTTP/1.1 200 OK\r\n${headers}\r\n`, 'ascii'), body]);
}

(async () => {
  await wasm_bindgen({ module_or_path: fs.readFileSync(`${core}/ace_wire_bg.wasm`) });
  // Git's Windows checkout may translate the fixture's canonical LF to CRLF;
  // its signed source bytes are LF, as stated by the vector README.
  const xml = Buffer.from(fs.readFileSync(fixture, 'utf8').replace(/\r\n/g, '\n'));
  const transport = Buffer.from(wasm_bindgen.catalog_response(http(xml), '123'));
  assert.ok(transport.length > 0, 'synthetic signed catalog fixture resolves');

  const rejects = (name, bytes, nonce = '123') => {
    assert.throws(() => wasm_bindgen.catalog_response(bytes, nonce), undefined, name);
  };
  rejects('nonce mismatch', http(xml), '124');
  const authTamper = Buffer.from(xml); authTamper[authTamper.indexOf(Buffer.from('fbda'))] ^= 1;
  rejects('tampered response authentication', http(authTamper));
  const substituted = Buffer.from(xml.toString('utf8').replace('<torrent>Q', '<torrent>R'));
  rejects('substituted signed bytes', http(substituted));
  rejects('non-200 HTTP status', Buffer.concat([Buffer.from(`HTTP/1.1 500 Nope\r\nContent-Length: ${xml.length}\r\n\r\n`), xml]));
  rejects('malformed HTTP framing', Buffer.from('HTTP/1.1 200 OK\r\nContent-Length: 4\r\n\r\nabc'));
  rejects('malformed chunk framing', Buffer.from('HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\nZ\r\n'));

  // Vectors copied from upstream resolve.rs::catalog_signature_matches_engine_vectors.
  const cid = '2123456789abcdef0123456789abcdef01234567';
  const nonce = '4245094384320117676';
  const request = new TextDecoder().decode(wasm_bindgen.catalog_request(cid, nonce, '5.252.161.191'));
  assert.match(request, /GET \/gettorrent\?/);
  assert.match(request, /_s=ee6c8422795ced4cd5c1fb80f10276801ab636c6/);
  assert.match(request, /Host: 5\.252\.161\.191:8081\r\n/);
  assert.throws(() => wasm_bindgen.catalog_request(cid, nonce, '127.0.0.1'));

  const hash='fb'.repeat(20),base64=Buffer.from(hash,'hex').toString('base64');
  const hashRequest=new TextDecoder().decode(wasm_bindgen.catalog_request_infohash(hash,'123','5.252.161.191'));
  const hashPath=hashRequest.split(' ')[1],query=new URL(hashPath,'http://test.invalid').searchParams;
  assert.equal(query.get('infohash'),base64);assert.ok(hashPath.includes('%2B'));assert.ok(hashPath.includes('%3D'));
  const keySource=fs.readFileSync('work/acetv-wire-wasm/src/catalog.rs','utf8');
  // Decode the public protocol constant through a JSON string literal; this key has no Rust-only escapes.
  const literal=keySource.match(/CATALOG_SIGNING_SECRET[^=]*=\s*b("(?:[^"\\]|\\.)*")/)[1];
  const key=JSON.parse(literal),crypto=require('crypto');
  const expected=crypto.createHash('sha1').update('_n=3.2.11#_p=linux#_r=123#_v=3021100#infohash='+base64).update(key).digest('hex');
  assert.equal(query.get('_s'),expected);
  assert.throws(()=>wasm_bindgen.catalog_response_infohash(http(xml),'123','00'.repeat(20)));

  console.log(JSON.stringify({ ok: true, checks: ['synthetic signed response', 'nonce/authentication/substitution rejection', 'HTTP status and framing rejection', 'upstream request-signature vector', 'host allowlist'] }));
})().catch((e) => { console.error(e); process.exitCode = 1; });
