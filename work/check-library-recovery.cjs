'use strict';
const assert = require('assert');
const storageKey = 'ace-tv.library-recovery.snapshot.v1';
const versionKey = 'ace-tv.library-recovery.version.v1';
const dataKeys = ['ace-tv.channels', 'ace-tv.favorites', 'ace-tv.recent', 'ace-tv.working-links.v1'];

function MemoryStorage(seed) { this.data = Object.assign({}, seed || {}); this.failWrites = false; }
MemoryStorage.prototype.getItem = function (key) { return Object.prototype.hasOwnProperty.call(this.data, key) ? this.data[key] : null; };
MemoryStorage.prototype.setItem = function (key, value) { if (this.failWrites) throw Error('quota'); this.data[key] = String(value); };
MemoryStorage.prototype.removeItem = function (key) { if (this.failWrites) throw Error('quota'); delete this.data[key]; };
global.localStorage = new MemoryStorage();
global.LibraryCore = require('./acetv-native-app/library-core.js');
const recovery = require('./acetv-native-app/library-recovery.js');
const core = recovery._internals;
const id = '0123456789abcdef0123456789abcdef01234567';
function entry(name, kind) { return { id, name, kind: kind || 'infohash' }; }
function lib(name) {
  const result = {};
  dataKeys.forEach(key => { result[key] = JSON.stringify(key === dataKeys[0] ? [entry(name)] : []); });
  return result;
}

assert.strictEqual(core.validLibrary(lib('Baseline')), true);
assert.strictEqual(core.validLibrary({ 'ace-tv.channels': '[{"id":"bad","name":"x"}]' }), false);
assert.strictEqual(core.validLibrary({ 'ace-tv.channels': JSON.stringify([entry('')]) }), false);
assert.strictEqual(core.validLibrary({ 'ace-tv.channels': JSON.stringify([entry('x', 'other')]) }), false);
assert.strictEqual(core.validLibrary({ 'ace-tv.favorites': JSON.stringify(Array(101).fill(entry('x'))) }), false);
assert.strictEqual(core.parseSnapshot('{bad'), null);
assert.strictEqual(core.makeSnapshot({ 'ace-tv.channels': '[]' }, '1.0', 1), null);
assert.strictEqual(core.makeSnapshot({...lib('Baseline'), 'ace-tv.channels': '[' + ' '.repeat(core.maxBytes / 2) + ']'}, '1.0', 1), null);

global.localStorage = new MemoryStorage(lib('Baseline'));
assert.strictEqual(recovery.init('1.0.0'), true, 'first init captures baseline');
const baseline = global.localStorage.getItem(storageKey);
assert.ok(baseline);
global.localStorage.setItem(dataKeys[0], JSON.stringify([entry('Edited')]));
assert.strictEqual(recovery.init('1.0.0'), true, 'same version leaves backup alone');
assert.strictEqual(global.localStorage.getItem(storageKey), baseline);
assert.strictEqual(recovery.init('2.0.0'), true, 'version change captures pre-migration data');
assert.strictEqual(core.parseSnapshot(global.localStorage.getItem(storageKey)).library[dataKeys[0]], JSON.stringify([entry('Edited')]));

const storage = global.localStorage;
storage.setItem(dataKeys[0], JSON.stringify([entry('After migration')]));
const preRestore = JSON.stringify([entry('After migration')]);
assert.strictEqual(core.restore(), true, 'restore commits');
assert.strictEqual(storage.getItem(dataKeys[0]), JSON.stringify([entry('Edited')]));
assert.strictEqual(core.parseSnapshot(storage.getItem(storageKey)).library[dataKeys[0]], preRestore, 'restore swaps current data into rollback snapshot');
assert.strictEqual(core.restore(), true, 'rollback snapshot can be restored');
assert.strictEqual(storage.getItem(dataKeys[0]), preRestore);

const failed = new MemoryStorage(lib('Still usable'));
failed.data[storageKey] = baseline;
failed.failWrites = true;
global.localStorage = failed;
assert.strictEqual(recovery.init('3.0.0'), false, 'storage failure is reported');
assert.strictEqual(failed.getItem(storageKey), baseline, 'failed init keeps previous recovery snapshot');
assert.strictEqual(failed.getItem(versionKey), null, 'failed init does not advance version metadata');
console.log('Library recovery checks passed.');
