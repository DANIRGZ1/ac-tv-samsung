/* Serial, bounded tracker-peer freshness probe. Socket ownership ends before resolve. */
(function (root) {
  'use strict';
  var MAX_PEERS = 32, CONNECT_MS = 3000, WINDOW_MS = 3000;
  var MAX_BYTES = 64 * 1024, BUFFER_BYTES = 32 * 1024;

  function seed32() { var seed = new Uint8Array(32); root.crypto.getRandomValues(seed); return seed; }
  function quiet(progress, stage, count, head, attempted, total) {
    if (typeof progress === 'function') {
      var event = { stage: stage, count: count, head: head };
      if (attempted != null) event.attempted = attempted;
      if (total != null) event.total = total;
      progress(event);
    }
  }
  function probe(descriptor, peer, progress, isCancelled) {
    return new Promise(function (resolve) {
      var mod = root.Module, wire = null, ptr = 0, connected = false, closed = false;
      var connectStarted = Date.now(), windowStarted = 0, received = 0, sent = 0;
      var pending=new Uint8Array(0);
      function close() {
        if (closed) return;
        closed = true;
        if (mod.peerTick === tick) mod.peerTick = null;
        try { mod._net_close(); } catch (_) {}
        if (ptr) { try { mod._free(ptr); } catch (_) {} ptr = 0; }
        if (wire) { try { wire.free(); } catch (_) {} wire = null; }
      }
      function finish(value,reason) { if(!value&&reason)quiet(progress,'unavailable: '+reason,1,null);close(); resolve(value || null); }
      function tick() {
        try {
          if (closed) return;
          if (isCancelled()) return finish(null, 'cancelled');
          var now = Date.now();
          if (!connected) {
            if (now - connectStarted > CONNECT_MS) return finish(null,'connect timeout');
            var ready = mod._net_ready();
            if (ready < 0) return finish(null,'connect '+ready);
            if (!ready) return;
            connected = true; windowStarted = now;
          }
          if (now - windowStarted > WINDOW_MS || received + sent >= MAX_BYTES) return finish(null,'handshake timeout or byte limit');

          // Drain only the initial handshake. Keep this below the 32 KiB probe buffer.
          if(!pending.length)pending=wire.take_outgoing();
          var outgoing=pending;
          if (outgoing.length) {
            var nwrite = Math.min(outgoing.length, BUFFER_BYTES, MAX_BYTES - sent);
            mod.HEAPU8.set(outgoing.subarray(0, nwrite), ptr);
            var nw = mod._net_write(ptr, nwrite);
            if (nw < 0) return finish(null,'write '+nw);
            sent += nw;
            pending=pending.subarray(nw);
          }
          for (var i = 0; i < 4; i++) {
            var n = mod._net_read(ptr, BUFFER_BYTES);
            if (n === -4096) return finish(null,'peer closed');
            if (n < 0) return finish(null,'read '+n);
            if (!n) break;
            received += n;
            if (received + sent > MAX_BYTES) return finish(null);
            wire.feed(mod.HEAPU8.slice(ptr, ptr + n));
            var state = JSON.parse(wire.status_json());
            if (state.window != null) {
              var head = Number(state.window.max_piece);
              if (Number.isFinite(head) && head >= 0) {
                quiet(progress, 'verified', 1, head);
                return finish({ host: peer.host, port: peer.port, head: head });
              }
              return finish(null);
            }
          }
        } catch (e) { finish(null,String(e.message||e).slice(0,120)); }
      }
      try {
        ptr = mod._malloc(BUFFER_BYTES);
        if (!ptr) return finish(null);
        wire = new wasm_bindgen.LivePeer(descriptor, seed32());
        var rc = mod.ccall('net_connect', 'number', ['string', 'number'], [peer.host, peer.port]);
        if (rc < 0) return finish(null,'initial connect '+rc);
        connected = rc === 1;
        if (connected) windowStarted = Date.now();
        mod.peerTick = tick;
        if (isCancelled()) finish(null, 'cancelled');
      } catch (e) { finish(null,String(e.message||e).slice(0,120)); }
    });
  }

  root.AcePeerSelector = {
    select: async function (descriptor, peers, onProgress, options) {
      if (!(descriptor instanceof Uint8Array) || !Array.isArray(peers)) throw new TypeError('Invalid peer probe input');
      options = options || {};
      var maxUsable = Number.isInteger(options.maxUsable) && options.maxUsable > 0 ? options.maxUsable : MAX_PEERS;
      var budgetMs = Number.isFinite(options.budgetMs) && options.budgetMs >= 0 ? options.budgetMs : Infinity;
      var isCancelled = typeof options.isCancelled === 'function' ? function () {
        try { return !!options.isCancelled(); } catch (_) { return true; }
      } : function () { return false; };
      var candidates = peers.slice(0, MAX_PEERS), usable = [];
      var started = Date.now(), attemptedCount = 0;
      quiet(onProgress, 'probing', candidates.length, null, 0, candidates.length);
      for (var i = 0; i < candidates.length; i++) {
        if (isCancelled()) { quiet(onProgress, 'cancelled', usable.length, usable.length ? usable[0].head : null, i, candidates.length); break; }
        var peer = candidates[i];
        if (!peer || typeof peer.host !== 'string' || !Number.isInteger(peer.port) || peer.port < 1 || peer.port > 65535) continue;
        if(root.AceDiscovery&&root.AceDiscovery.isPublicIPv4&&!root.AceDiscovery.isPublicIPv4(peer.host))continue;
        var progress = function (event) {
          event.attempted = i + 1; event.total = candidates.length;
          if (typeof onProgress === 'function') onProgress(event);
        };
        attemptedCount = i + 1;
        var result = await probe(descriptor, peer, progress, isCancelled);
        if (isCancelled()) { quiet(onProgress, 'cancelled', usable.length, usable.length ? usable[0].head : null, i + 1, candidates.length); break; }
        if (result) usable.push(result);
        if (usable.length >= maxUsable || (usable.length > 0 && Date.now() - started >= budgetMs)) break;
      }
      usable.sort(function (a, b) { return b.head - a.head; });
      quiet(onProgress, 'complete', usable.length, usable.length ? usable[0].head : null, attemptedCount, candidates.length);
      return usable;
    }
  };
})(self);
