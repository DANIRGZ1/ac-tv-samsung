'use strict';
const assert = require('node:assert/strict');
const core = require('./acetv-native-app/library-core.js');

class FakeStorage {
  constructor(initial = {}) { this.data = new Map(Object.entries(initial)); this.fail = null; this.count = 0; }
  getItem(k) { return this.data.has(k) ? this.data.get(k) : null; }
  setItem(k, v) { this.tick(k, 'set'); this.data.set(k, String(v)); }
  removeItem(k) { this.tick(k, 'remove'); this.data.delete(k); }
  tick(k, op) { this.count++; if (this.fail && this.fail(k, op, this.count)) throw Error('injected storage failure'); }
}
const id = n => n.toString(16).padStart(40, '0');

// Reordering preserves object identity/properties, does not mutate input, and clamps to bounds.
const rows = [{ id: 'a', pinned: true }, { id: 'b', extra: 2 }, { id: 'c' }];
const moved = core.move(rows, 'c', -50);
assert.deepEqual(moved.map(x => x.id), ['c', 'a', 'b']);
assert.equal(rows[0].id, 'a');
assert.equal(moved[1], rows[0]);
assert.deepEqual(core.move(rows, 'a', -1).map(x => x.id), ['a', 'b', 'c']);
assert.deepEqual(core.move(rows, 'missing', 1), rows);

// Recent validation, id/kind de-duplication, normalization, and the hard 12-item cap.
const seed = Array.from({ length: 15 }, (_, i) => ({ id: id(i + 1), name: `n${i}`, kind: i === 0 ? 'content_id' : 'infohash' }));
let recents = core.recent(seed, { id: id(1), name: ' replacement ', kind: 'content_id' });
assert.equal(recents.length, 12);
assert.equal(recents[0].name, 'replacement');
assert.equal(recents.filter(x => x.id === id(1)).length, 1);
recents = core.recent(recents, { id: id(1), name: 'same id other kind', kind: 'unknown' });
assert.equal(recents.filter(x => x.id === id(1)).length, 2);
assert.deepEqual(core.recent([], { id: 'bad', name: 'x' }), []);
assert.deepEqual(core.recent([], { id: id(2), name: 'x'.repeat(121) }), []);
assert.equal(core.recent([], { id: id(2), name: 'x', kind: 'content_id' })[0].kind, 'content_id');

const K = 'ace-tv.channels', F = 'ace-tv.favorites', J = 'ace-tv.library-journal.v1';
let s = new FakeStorage({ [K]: 'old', [F]: 'fav' });
s.fail = (key, op) => key === J && op === 'set';
assert.equal(core.commit(s, { [K]: 'new' }), false);
assert.equal(s.getItem(K), 'old'); // journal write failure occurs before data writes

s = new FakeStorage({ [K]: 'old', [F]: 'fav' });
let dataWrites = 0;
s.fail = (key, op) => key === F && op === 'set' && ++dataWrites === 1;
assert.equal(core.commit(s, { [K]: 'new', [F]: 'newfav' }), false);
assert.equal(s.getItem(K), 'old');
assert.equal(s.getItem(F), 'fav');
assert.equal(s.getItem(J), null);

// A persisted journal from an interrupted transaction restores only allowlisted keys.
s = new FakeStorage({ [K]: 'partial', [F]: 'changed', [J]: JSON.stringify({ v: 1, before: { [K]: 'old', [F]: 'fav' } }) });
assert.equal(core.recover(s), true);
assert.equal(s.getItem(K), 'old');
assert.equal(s.getItem(F), 'fav');
assert.equal(s.getItem(J), null);
s = new FakeStorage({ [K]: 'untouched', [J]: JSON.stringify({ v: 1, before: { arbitrary: 'bad' } }) });
assert.equal(core.recover(s), false);
assert.equal(s.getItem(K), 'untouched');
assert.notEqual(s.getItem(J), null);

console.log('library-core checks passed');
