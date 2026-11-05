(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.LibraryCore = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  const JOURNAL = 'ace-tv.library-journal.v1';
  const KEYS = new Set(['ace-tv.channels', 'ace-tv.favorites', 'ace-tv.recent']);
  const validId = value => typeof value === 'string' && /^[a-f0-9]{40}$/i.test(value);

  function normalize(list, limit = 12) {
    const max = Number.isFinite(limit) ? Math.max(0, Math.min(12, Math.floor(limit))) : 12;
    if (!Array.isArray(list) || max === 0) return [];
    const seen = new Set(), out = [];
    for (const entry of list) {
      if (!entry || typeof entry !== 'object' || !validId(entry.id) || typeof entry.name !== 'string' ||
          !entry.name.trim() || entry.name.length > 120) continue;
      const kind = entry.kind === 'content_id' ? 'content_id' : 'infohash';
      const id = entry.id.toLowerCase(), key = `${id}:${kind}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(Object.assign({}, entry, { id, name: entry.name.trim(), kind }));
      if (out.length >= max) break;
    }
    return out;
  }

  function recent(list, item, limit = 12) {
    const base = normalize(list, 12);
    if (!item || typeof item !== 'object' || !validId(item.id) || typeof item.name !== 'string' ||
        item.name.trim().length === 0 || item.name.length > 120) return normalize(base, limit);
    const kind = item.kind === 'content_id' ? 'content_id' : 'infohash';
    const normalized = Object.assign({}, item, { id: item.id.toLowerCase(), name: item.name.trim(), kind });
    const key = `${normalized.id}:${kind}`;
    return normalize([normalized].concat(base.filter(entry => `${entry.id}:${entry.kind}` !== key)), limit);
  }

  function move(list, id, delta) {
    if (!Array.isArray(list)) return [];
    const result = list.slice();
    const from = result.findIndex(item => item && item.id === id);
    if (from < 0 || !Number.isFinite(delta)) return result;
    const to = Math.max(0, Math.min(result.length - 1, from + Math.trunc(delta)));
    if (to === from) return result;
    const item = result.splice(from, 1)[0];
    result.splice(to, 0, item);
    return result;
  }

  function rollback(storage, before) {
    let ok = true;
    for (const key of Object.keys(before)) {
      try {
        if (before[key] === null) storage.removeItem(key);
        else storage.setItem(key, before[key]);
      } catch (_) { ok = false; }
    }
    if (ok) {
      try { storage.removeItem(JOURNAL); } catch (_) { ok = false; }
    }
    return ok;
  }

  function recover(storage) {
    let raw;
    try { raw = storage.getItem(JOURNAL); } catch (_) { return false; }
    if (raw === null) return true;
    let record;
    try { record = JSON.parse(raw); } catch (_) { return false; }
    if (!record || record.v !== 1 || !record.before || typeof record.before !== 'object' || Array.isArray(record.before)) return false;
    const keys = Object.keys(record.before);
    if (keys.some(key => !KEYS.has(key) || !(record.before[key] === null || typeof record.before[key] === 'string'))) return false;
    return rollback(storage, record.before);
  }

  function commit(storage, updates) {
    if (!storage || !updates || typeof updates !== 'object' || Array.isArray(updates) || !recover(storage)) return false;
    const keys = Object.keys(updates);
    if (keys.some(key => !KEYS.has(key) || !(updates[key] === null || typeof updates[key] === 'string'))) return false;
    const before = {};
    try {
      for (const key of keys) before[key] = storage.getItem(key);
    } catch (_) { return false; }
    try { storage.setItem(JOURNAL, JSON.stringify({ v: 1, before })); } catch (_) { return false; }
    try {
      for (const key of keys) {
        if (updates[key] === null) storage.removeItem(key);
        else storage.setItem(key, updates[key]);
      }
      storage.removeItem(JOURNAL);
      return true;
    } catch (_) {
      rollback(storage, before);
      return false;
    }
  }

  return { normalize, recent, move, commit, recover };
});
