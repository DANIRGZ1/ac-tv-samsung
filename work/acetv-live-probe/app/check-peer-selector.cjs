const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, 'peer-selector.js'), 'utf8');
function fixture(profiles) {
  let active = null, peerIndex = 0, closes = 0, frees = 0, now = 1000;
  const counters = Object.create(null);
  const sandbox = {
    Uint8Array, Number, Promise, TypeError, Array, JSON, Math,
    Date: { now: () => now }, crypto: { getRandomValues(a) { a.fill(7); } },
    wasm_bindgen: { LivePeer: class {
      constructor() { this.profile = Object.values(profiles)[peerIndex++]; this.reads = 0; this.outgoing = new Uint8Array([17, 18, 19, 20]); }
      take_outgoing() { const bytes = this.outgoing; this.outgoing = new Uint8Array(0); return bytes; }
      feed() { this.reads++; this.outgoing = new Uint8Array([21, 22]); now += this.profile.advanceMs || 0; }
      status_json() {
        if (this.profile.badStatus) throw Error('bad status');
        return JSON.stringify({ window: this.reads >= (this.profile.validAfter || 1) ? { max_piece: this.profile.head } : null });
      }
      free() { frees++; }
    } },
    Module: {
      HEAPU8: new Uint8Array(32768), peerTick: null,
      _malloc() { return 1; }, _free() { frees++; },
      ccall(_f, _r, _t, args) {
        active = args[0]; counters[active] ||= { writes: 0, reads: 0, connects: 0 };
        counters[active].connects++;
        return profiles[active].connectFail ? -1 : 0;
      },
      _net_ready() { return 1; },
      _net_write(_p, n) { counters[active].writes++; return Math.min(n, 1); },
      _net_read(_p, n) {
        const p = profiles[active], c = counters[active];
        if (p.readFail) return -1;
        if (c.reads >= (p.validAfter || 1) || c.writes < 4 || (c.reads === 1 && c.writes < 6)) return 0;
        this.HEAPU8.set([1, 2, 3], 1); c.reads++; return Math.min(3, n);
      },
      _net_close() { closes++; }
    }
  };
  sandbox.self = sandbox;
  vm.runInNewContext(source, sandbox, { filename: 'peer-selector.js' });
  return { sandbox, counters, counts: () => ({ closes, frees }) };
}
const peer = (host, port) => ({ host, port });
async function pump(selection, sandbox) {
  const timer = setInterval(() => { if (sandbox.Module.peerTick) sandbox.Module.peerTick(); }, 1);
  try { return await selection; } finally { clearInterval(timer); }
}

async function run() {
  // Default mode still scans candidates serially, handles fragmented reads and partial writes, then sorts verified heads.
  {
    const f = fixture({ stale: { head: 100, validAfter: 2 }, fresh: { head: 200, validAfter: 2 }, bad: { readFail: true } });
    const result = await pump(f.sandbox.AcePeerSelector.select(new Uint8Array([1]), [peer('stale', 1), peer('fresh', 2), peer('bad', 3)]), f.sandbox);
    assert.deepEqual(Array.from(result, x => x.head), [200, 100]);
    assert.equal(f.counts().closes, 3); assert.equal(f.counts().frees, 6);
    assert.equal(f.sandbox.Module.peerTick, null);
    assert(f.counters.stale.writes >= 6 && f.counters.fresh.writes >= 6, 'partial outgoing handshake writes were retried');
    assert.equal(f.counters.bad.connects, 1);
  }
  // Fast mode stops after the requested number of valid sockets and avoids an unreachable tail.
  {
    const profiles = { a: { head: 11 }, b: { head: 22 } };
    for (let i = 0; i < 30; i++) profiles[`dead${i}`] = { connectFail: true };
    const peers = Object.keys(profiles).map((host, i) => peer(host, i + 1));
    const f = fixture(profiles);
    const result = await pump(f.sandbox.AcePeerSelector.select(new Uint8Array([1]), peers, null,
      { maxUsable: 2, budgetMs: 20000 }), f.sandbox);
    assert.deepEqual(Array.from(result, x => x.head), [22, 11]);
    assert.equal(f.counts().closes, 2); assert.equal(f.counters.dead0, undefined);
  }
  // An expired budget stops after one valid result, while no-valid scans still exhaust all 32 bounded candidates.
  {
    const f = fixture({ only: { head: 7, advanceMs: 50 }, later: { connectFail: true } });
    const result = await pump(f.sandbox.AcePeerSelector.select(new Uint8Array([1]), [peer('only', 1), peer('later', 2)], null,
      { maxUsable: 2, budgetMs: 10 }), f.sandbox);
    assert.deepEqual(Array.from(result, x => x.head), [7]);
    assert.equal(f.counters.later, undefined);
  }
  {
    const profiles = {}, peers = [];
    for (let i = 0; i < 32; i++) { const host = `bad${i}`; profiles[host] = { connectFail: true }; peers.push(peer(host, i + 1)); }
    const f = fixture(profiles);
    const result = await f.sandbox.AcePeerSelector.select(new Uint8Array([1]), peers, null,
      { maxUsable: 2, budgetMs: 0 });
    assert.equal(result.length, 0); assert.equal(Object.keys(f.counters).length, 32);
    assert.equal(f.counts().closes, 32, 'expired budget does not abort a scan with no valid peers');
  }
  // Cancellation during a live probe closes the socket and both owned allocations before returning.
  {
    let cancelled = false;
    const f = fixture({ first: { head: 3 }, second: { head: 4 } });
    const selection = f.sandbox.AcePeerSelector.select(new Uint8Array([1]), [peer('first', 1), peer('second', 2)], null,
      { maxUsable: 2, budgetMs: 20000, isCancelled: () => cancelled });
    await Promise.resolve();
    assert.equal(typeof f.sandbox.Module.peerTick, 'function');
    cancelled = true; f.sandbox.Module.peerTick();
    const result = await selection;
    assert.equal(result.length, 0); assert.equal(f.counts().closes, 1); assert.equal(f.counts().frees, 2);
    assert.equal(f.counters.second, undefined); assert.equal(f.sandbox.Module.peerTick, null);
  }
  console.log('peer-selector checks passed');
}
run().catch(e => { console.error(e); process.exitCode = 1; });
