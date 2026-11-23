(function (root) {
  'use strict';
  var directions = { 37: 'left', 38: 'up', 39: 'right', 40: 'down' };
  function move(container, key, current) {
    var direction = directions[key];
    if (!container || !direction) return;
    var nodes = container.querySelectorAll('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex="-1"])');
    var candidates = [];
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (el.hidden || getComputedStyle(el).visibility === 'hidden') continue;
      var rect = el.getBoundingClientRect();
      if (rect.width || rect.height || el.getClientRects().length) candidates.push({ element: el, rect: rect });
    }
    if (!candidates.length) return;
    var from = null;
    for (var c = 0; c < candidates.length; c++) {
      if (candidates[c].element === current) { from = candidates[c]; break; }
    }
    if (!from) { candidates[0].element.focus(); return; }
    var a = from.rect, ax = (a.left + a.right) / 2, ay = (a.top + a.bottom) / 2;
    var best = null, bestScore = Infinity;
    candidates.forEach(function (el) {
      if (el === from) return;
      var r = el.rect, x = (r.left + r.right) / 2, y = (r.top + r.bottom) / 2;
      var primary = direction === 'left' ? ax - x : direction === 'right' ? x - ax : direction === 'up' ? ay - y : y - ay;
      var horizontal = direction === 'left' || direction === 'right';
      var edge = horizontal ? a.width / 2 : a.height / 2;
      if (primary <= edge + 1) return;
      var secondary = horizontal ? Math.abs(y - ay) : Math.abs(x - ax);
      var gap = horizontal ? Math.max(0, r.top - a.bottom, a.top - r.bottom)
        : Math.max(0, r.left - a.right, a.left - r.right);
      var score = primary + gap * 2.5 + secondary * 0.15;
      if (score < bestScore) { bestScore = score; best = el; }
    });
    if (!best) return;
    best.element.focus();
    if (best.element.classList.contains('library-row')) best.element.scrollIntoView({ block: 'nearest' });
  }
  function dialog() {
    var all = document.querySelectorAll('[role="dialog"]');
    for (var i = all.length - 1; i >= 0; i--) if (!all[i].hidden && all[i].getClientRects().length) return all[i];
    return null;
  }
  document.addEventListener('keydown', function (event) {
    var key = event.keyCode;
    if (!directions[key]) return;
    var active = document.activeElement;
    if (active && /^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName)) return;
    var box = dialog();
    if (!box) return;
    if (active && active.hasAttribute('data-favorite') && (key === 37 || key === 39)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    move(box, key, active);
  }, true);
  root.AceSpatialFocus = { move: move };
})(window);
