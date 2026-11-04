const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const appSource = fs.readFileSync(path.join(__dirname, 'acetv-native-app/app.js'), 'utf8');

function makeHarness() {
  let now=0,mediaTime=0;const events={};
  class TestDate extends Date { static now(){return now;} }
  const ids = ['engine', 'source', 'play', 'explore', 'check', 'stop', 'backguide', 'status', 'hud', 'browser-player', 'native-player'];
  const elements = Object.fromEntries(ids.map(id => [id, {
    id, value: id === 'source' ? 'acestream://0123456789abcdef0123456789abcdef01234567' : '',
    textContent: '', hidden: false, style: {}, classList: { add() {}, remove() {} },
    focus() { document.activeElement = this; }, blur() {}, pause() {}, play() { return Promise.resolve(); },
    removeAttribute() {}, load() {}, set src(v) { this._src = v; }, get src() { return this._src; },
    getBoundingClientRect() { return { left: 0, top: 0, width: 100, height: 30 }; }
  }]));
  const timers = new Map(); let timerId = 0;
  const avCalls = { opened: [], stopped: 0, closed: 0, played: 0, listeners: [], rects: [] };
  let avState = 'NONE';
  const avplay = {
    getCurrentTime:()=>mediaTime,
    getState: () => avState,
    open(url) { avCalls.opened.push(url); avState = 'IDLE'; },
    setDisplayRect(...rect) { avCalls.rects.push(rect); }, setDisplayMethod() {},
    setListener(l) { avCalls.listeners.push(l); },
    prepareAsync(ok) { this.ready = ok; },
    play() { avCalls.played++; avState = 'PLAYING'; },
    stop() { avCalls.stopped++; avState = 'NONE'; }, close() { avCalls.closed++; avState = 'NONE'; },
    pause() { avState = 'PAUSED'; }
  };
  const starts = [], transportStops = [];
  const document = {
    getElementById: id => elements[id], body: { classList: { add() {}, remove() {} } },
    documentElement: { clientWidth: 1920, clientHeight: 1080 }, hidden: false,
    activeElement: elements.explore,
    addEventListener(name,fn) {events[name]=fn;}
  };
  const window = { webapis: { avplay }, addEventListener() {} };
  const transport = {
    start(spec, progress, failure) {
      let resolve, reject;
      const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
      starts.push({ spec, progress, failure, resolve, reject });
      return promise;
    },
    stop() { transportStops.push(true); }
  };
  window.NativeP2PTransport = transport;
  const context = {
    window, webapis: window.webapis, document, NativeP2PTransport: transport,
    AceCore: { parse: () => ({ id: '0123456789abcdef0123456789abcdef01234567', kind: 'content_id' }), engine: () => null },
    localStorage: { getItem: () => null, setItem() {} }, URL, Date:TestDate, Math, Error, String, JSON,
    setTimeout(fn, ms) { const id = ++timerId; timers.set(id, { fn, ms }); return id; },
    clearTimeout(id) { if (timers.has(id)) timers.get(id).cleared = true; },
    console
  };
  vm.runInNewContext(appSource, context, { filename: 'app.js' });
  async function flush() { await Promise.resolve(); await Promise.resolve(); }
  function pendingTimers() { return [...timers.entries()].filter(([, t]) => !t.cleared); }
  function runTimer(id, evenIfCleared = false) {
    const t = timers.get(id); assert(t, `timer ${id} exists`);
    if (evenIfCleared || !t.cleared) t.fn();
  }
  return { elements, avplay, avCalls, starts, transportStops, timers, pendingTimers, runTimer, flush, app: context.window.AceTV,
    advance(ms,playMs=0){now+=ms;mediaTime+=playMs;},key(code){events.keydown({keyCode:code,preventDefault(){}});} };
}

async function main() {
  {
    const h = makeHarness();
    h.elements.play.onclick();
    assert.equal(h.starts.length, 1, 'native playback starts without a PC engine address');
    assert.equal(h.starts[0].spec.contentId, '0123456789abcdef0123456789abcdef01234567');
    h.starts[0].resolve('http://127.0.0.1:43210/stream.ts'); await h.flush();
    assert.deepEqual(h.avCalls.opened, ['http://127.0.0.1:43210/stream.ts'], 'loopback URL is passed to AVPlay');
    h.avplay.ready();
    assert.equal(h.app.diagnostics().phase, 'playing');
    assert.equal(h.avCalls.played, 1);
    const fullscreen = [0, 0, 1920, 1080];
    assert.deepEqual(h.avCalls.rects.at(-1), fullscreen, 'AVPlay rectangle is reapplied after play at fullscreen dimensions');
    const listener = h.avCalls.listeners.at(-1);
    const beforeBufferComplete = h.avCalls.rects.length;
    listener.onbufferingcomplete();
    assert.deepEqual(h.avCalls.rects.at(-1), fullscreen, 'buffering complete restores the fullscreen rectangle');
    assert.equal(h.avCalls.rects.length, beforeBufferComplete + 1);
    const delayed = h.pendingTimers().find(([, t]) => t.ms === 350);
    assert(delayed, 'post-play display correction is scheduled at 350ms');
    const beforeDelayed = h.avCalls.rects.length;
    h.runTimer(delayed[0]);
    assert.deepEqual(h.avCalls.rects.at(-1), fullscreen, 'delayed display correction uses fullscreen dimensions');
    assert.equal(h.avCalls.rects.length, beforeDelayed + 1);
    const beforeStop = h.avCalls.rects.length;
    h.app.stop();
    h.runTimer(delayed[0], true);
    listener.onbufferingcomplete();
    assert.equal(h.avCalls.rects.length, beforeStop, 'cleared delayed callback and buffering callback are ignored after stop');
    assert(h.transportStops.length >= 2, 'start reset and explicit stop both cancel transport');
  }
  {
    const h = makeHarness();
    h.elements.play.onclick();
    h.starts[0].reject(Error('transient 1')); await h.flush();
    for (let attempt = 1; attempt <= 3; attempt++) {
      assert.equal(h.app.diagnostics().recoveryAttempts,attempt,'retry counter stays in diagnostics');
      assert.equal(h.elements.status.textContent,'Recuperando la reproducción…');
      const pending = h.pendingTimers().filter(([, t]) => t.ms === 1800);
      assert.equal(pending.length, 1, 'transient failure schedules one 1.8 second retry');
      h.runTimer(pending[0][0]); await h.flush();
      assert.equal(h.starts.length, attempt + 1, 'retry starts transport');
      h.starts.at(-1).reject(Error(`transient ${attempt + 1}`)); await h.flush();
    }
    assert.equal(h.starts.length, 4, 'initial attempt plus three retries are started');
    assert.equal(h.pendingTimers().filter(([, t]) => t.ms === 1800).length, 0, 'failure after three retries is terminal');
  }
  {
    const h = makeHarness();
    h.elements.play.onclick();
    h.starts[0].reject(Error('temporary')); await h.flush();
    const retry = h.pendingTimers().find(([, t]) => t.ms === 1800);
    assert(retry, 'retry is pending before stop');
    h.app.stop();
    h.runTimer(retry[0], true);
    assert.equal(h.starts.length, 1, 'stopped retry callback is stale and ignored');
  }
  {
    const h = makeHarness();
    h.elements.play.onclick();
    h.app.stop();
    h.starts[0].resolve('http://127.0.0.1:43210/stale.ts'); await h.flush();
    assert.equal(h.avCalls.opened.length, 0, 'stale transport completion after stop is ignored');
  }
  {
    const h=makeHarness();h.elements.play.onclick();h.starts[0].resolve('http://127.0.0.1:43210/stream.ts');await h.flush();h.avplay.ready();
    for(let i=0;i<4;i++){h.advance(5000);const t=h.pendingTimers().filter(([,t])=>t.ms===5000).at(-1);h.runTimer(t[0]);}
    assert.equal(h.app.diagnostics().recoveryAttempts,1,'frozen video starts a recovery after 20 seconds');
    h.app.stop();
  }
  {
    const h=makeHarness();h.elements.play.onclick();h.starts[0].resolve('http://127.0.0.1:43210/stream.ts');await h.flush();h.avplay.ready();
    const monitor=h.pendingTimers().filter(([,t])=>t.ms===5000).at(-1);h.key(13);h.advance(60000);h.runTimer(monitor[0],true);
    assert.equal(h.app.diagnostics().phase,'paused');assert.equal(h.app.diagnostics().totalRecoveries,0,'user pause never triggers freeze recovery');
    h.app.stop();h.runTimer(monitor[0],true);assert.equal(h.app.diagnostics().totalRecoveries,0,'monitor cannot restart stopped playback');
  }
  {
    const h=makeHarness();h.avplay.getCurrentTime=()=>{throw Error('unsupported telemetry')};h.elements.play.onclick();h.starts[0].resolve('http://127.0.0.1:43210/stream.ts');await h.flush();h.avplay.ready();
    for(let i=0;i<6;i++){h.advance(5000);h.runTimer(h.pendingTimers().filter(([,t])=>t.ms===5000).at(-1)[0]);}
    assert.equal(h.app.diagnostics().totalRecoveries,0,'missing telemetry never triggers a false recovery');h.app.stop();
  }
  {
    const h=makeHarness();h.elements.play.onclick();h.starts[0].reject(Error('temporary'));await h.flush();h.runTimer(h.pendingTimers().find(([,t])=>t.ms===1800)[0]);
    h.starts[1].resolve('http://127.0.0.1:43210/stream.ts');await h.flush();h.avplay.ready();
    for(let i=0;i<12;i++){h.advance(5000,5000);h.runTimer(h.pendingTimers().filter(([,t])=>t.ms===5000).at(-1)[0]);}
    assert.equal(h.app.diagnostics().recoveryAttempts,0,'one minute of confirmed video progress restores retry budget');
    assert.equal(h.app.diagnostics().playbackMonitor.status,'healthy');h.app.stop();
  }
  {
    const h=makeHarness();h.elements.play.onclick();h.starts[0].resolve('http://127.0.0.1:43210/stream.ts');await h.flush();h.avplay.ready();h.avCalls.listeners.at(-1).onerror('PLAYER_ERROR_NOT_SUPPORTED_FORMAT');
    assert.equal(h.app.diagnostics().phase,'idle');assert.equal(h.pendingTimers().filter(([,t])=>t.ms===1800).length,0,'unsupported format does not retry three times');
  }
  console.log('PASS native app VM regression checks');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
