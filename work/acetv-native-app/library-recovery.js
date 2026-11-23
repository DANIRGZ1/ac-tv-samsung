(function (root, factory) {
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.AceLibraryRecovery = api;
})(typeof window !== 'undefined' ? window : globalThis, function (root) {
  'use strict';

  var SNAPSHOT_KEY = 'ace-tv.library-recovery.snapshot.v1';
  var VERSION_KEY = 'ace-tv.library-recovery.version.v1';
  var LIBRARY_KEYS = ['ace-tv.channels', 'ace-tv.favorites', 'ace-tv.recent', 'ace-tv.working-links.v1'];
  var MAX_BYTES = 4 * 1024 * 1024;
  var MAX_ITEMS = { 'ace-tv.channels': 5000, 'ace-tv.favorites': 100, 'ace-tv.recent': 12, 'ace-tv.working-links.v1': 12 };

  function validVersion(version) { return typeof version === 'string' && version.length > 0 && version.length <= 80; }
  function validLibrary(library) {
    if (!library || typeof library !== 'object' || Array.isArray(library)) return false;
    for (var i = 0; i < LIBRARY_KEYS.length; i += 1) {
      var key = LIBRARY_KEYS[i], raw = library[key];
      if (!Object.prototype.hasOwnProperty.call(library, key)) return false;
      if (raw !== null && typeof raw !== 'string') return false;
      if (raw === null) continue;
      var list;
      try { list = JSON.parse(raw); } catch (_) { return false; }
      if (!Array.isArray(list) || list.length > MAX_ITEMS[key]) return false;
      for (var j = 0; j < list.length; j += 1) {
        var item = list[j];
        if (!item || typeof item !== 'object' || Array.isArray(item) ||
            typeof item.id !== 'string' || !/^[a-f0-9]{40}$/i.test(item.id) ||
            typeof item.name !== 'string' || !item.name.trim() || item.name.length > 120 ||
            (item.kind !== undefined && item.kind !== 'content_id' && item.kind !== 'infohash')) return false;
      }
    }
    return true;
  }
  function makeSnapshot(library, version, timestamp) {
    if (!validVersion(version) || !validLibrary(library)) return null;
    var record = { v: 1, appVersion: version, createdAt: timestamp || 0, library: {} };
    LIBRARY_KEYS.forEach(function (key) { if (Object.prototype.hasOwnProperty.call(library, key)) record.library[key] = library[key]; });
    var raw = JSON.stringify(record);
    return raw.length * 2 <= MAX_BYTES ? raw : null;
  }
  function parseSnapshot(raw) {
    if (typeof raw !== 'string' || raw.length * 2 > MAX_BYTES) return null;
    try {
      var record = JSON.parse(raw);
      if (!record || record.v !== 1 || !validVersion(record.appVersion) || !record.library || !validLibrary(record.library)) return null;
      return record;
    } catch (_) { return null; }
  }
  function capture(storage) {
    var library = {};
    try { LIBRARY_KEYS.forEach(function (key) { library[key] = storage.getItem(key); }); }
    catch (_) { return null; }
    return library;
  }
  function transaction(storage, updates) {
    try { return !!(root && root.LibraryCore && root.LibraryCore.commit(storage, updates)); }
    catch (_) { return false; }
  }
  function init(version) {
    if (!validVersion(version) || !root || !root.localStorage || !root.LibraryCore) return false;
    var storage = root.localStorage, savedVersion, rawSnapshot;
    try { savedVersion = storage.getItem(VERSION_KEY); rawSnapshot = storage.getItem(SNAPSHOT_KEY); }
    catch (_) { return false; }
    var existing = parseSnapshot(rawSnapshot);
    if (savedVersion === version && existing) return true;
    // Preserve a usable recovery point if reading, validation, size checks, or storage writes fail.
    var current = capture(storage), raw = current && makeSnapshot(current, version, Date.now());
    if (!raw) return false;
    var updates = {}; updates[SNAPSHOT_KEY] = raw; updates[VERSION_KEY] = version;
    return transaction(storage, updates);
  }
  function restore() {
    if (!root || !root.localStorage || !root.LibraryCore) return false;
    var storage = root.localStorage, raw, current;
    try { raw = storage.getItem(SNAPSHOT_KEY); } catch (_) { return false; }
    var backup = parseSnapshot(raw);
    if (!backup) return false;
    current = capture(storage);
    var rollback = current && makeSnapshot(current, backup.appVersion, Date.now());
    if (!rollback) return false;
    var updates = {};
    LIBRARY_KEYS.forEach(function (key) { updates[key] = Object.prototype.hasOwnProperty.call(backup.library, key) ? backup.library[key] : null; });
    updates[SNAPSHOT_KEY] = rollback;
    return transaction(storage, updates);
  }
  function open() {
    if (!root || !root.document || !root.localStorage) return false;
    var doc = root.document, dialog = doc.getElementById('library-recovery-dialog');
    if (!dialog) {
      dialog = doc.createElement('section'); dialog.id = 'library-recovery-dialog'; dialog.className = 'library-recovery';
      dialog.setAttribute('role', 'dialog'); dialog.setAttribute('aria-modal', 'true'); dialog.setAttribute('aria-labelledby', 'library-recovery-title');
      dialog.innerHTML = '<div class="library-recovery-card"><span class="library-recovery-brand">AC TV</span><h1 id="library-recovery-title">Restaurar biblioteca</h1><p class="library-recovery-copy">Se reemplazarán los canales, favoritos y reproducidos actuales por la copia guardada. La biblioteca actual se conservará como copia para poder deshacer la restauración.</p><p class="library-recovery-status" role="status" aria-live="polite"></p><div class="library-recovery-actions"><button type="button" data-recovery="restore">Restaurar copia</button><button type="button" data-recovery="cancel">Volver</button></div></div>';
      doc.body.appendChild(dialog);
      dialog.addEventListener('click', function (event) {
        var action = event.target && event.target.getAttribute('data-recovery');
        if (action === 'cancel') { closeDialog(dialog); return; }
        if (action === 'restore') {
          if (restore()) { dialog.hidden = true; root.location.reload(); }
          else dialog.querySelector('.library-recovery-status').textContent = 'No se pudo restaurar la copia. La biblioteca actual se conserva.';
        }
      });
    }
    var saved;
    try { saved = parseSnapshot(root.localStorage.getItem(SNAPSHOT_KEY)); } catch (_) { saved = null; }
    if (!saved) { dialog.querySelector('.library-recovery-copy').textContent = 'No hay una copia válida disponible para restaurar.'; dialog.querySelector('[data-recovery="restore"]').disabled = true; }
    dialog.hidden = false;
    previousFocus = doc.activeElement;
    var cancel = dialog.querySelector('[data-recovery="cancel"]'); if (cancel) cancel.focus();
    return true;
  }
  var previousFocus = null;
  function closeDialog(dialog) {
    dialog.hidden = true;
    if (previousFocus && typeof previousFocus.focus === 'function') previousFocus.focus();
    previousFocus = null;
  }
  if (root && root.document && root.document.addEventListener) root.document.addEventListener('keydown', function (event) {
    var dialog = root.document.getElementById('library-recovery-dialog');
    if (!dialog || dialog.hidden) return;
    var key = event.keyCode || event.which;
    if (key === 27 || key === 10009 || key === 65385) { event.preventDefault(); event.stopImmediatePropagation(); closeDialog(dialog); return; }
    var buttons = Array.prototype.slice.call(dialog.querySelectorAll('button:not([disabled])'));
    var active = root.document.activeElement, index = buttons.indexOf(active);
    if (key === 13) { event.preventDefault(); event.stopImmediatePropagation(); if (active && active.tagName === 'BUTTON' && !active.disabled) active.click(); return; }
    if (key === 37 || key === 38 || key === 39 || key === 40 || key === 9) {
      event.preventDefault(); event.stopImmediatePropagation();
      var direction = key === 37 || key === 38 || (key === 9 && event.shiftKey) ? -1 : 1;
      var next = (index + direction + buttons.length) % buttons.length;
      if (buttons[next]) buttons[next].focus();
    }
  }, true);
  return { init: init, open: open, _internals: { makeSnapshot: makeSnapshot, parseSnapshot: parseSnapshot, validLibrary: validLibrary, capture: capture, restore: restore, keys: LIBRARY_KEYS.slice(), snapshotKey: SNAPSHOT_KEY, versionKey: VERSION_KEY, maxBytes: MAX_BYTES } };
});
