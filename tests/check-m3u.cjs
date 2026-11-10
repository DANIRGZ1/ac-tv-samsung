'use strict';

const assert = require('assert');
const M3UCore = require('../work/acetv-native-app/m3u-core.js');
const hash = '0123456789abcdef0123456789abcdef01234567';
const hash2 = 'abcdef0123456789abcdef0123456789abcdef01';

const parsed = M3UCore.parse('\uFEFF#EXTM3U\r\n' +
  '#EXTINF:-1 tvg-id="one" note="comma,inside" group-title="News, World",Channel, One\r\n' +
  'acestream://' + hash.toUpperCase() + '\r\n' +
  '#EXTINF:-1 group-title="Films",Second\r\n' + hash2 + '\r\n' +
  'infohash:' + hash + '\r\n' +
  'https://example.invalid/live.m3u8\r\n' +
  'broken:not-a-hash\r\n');
assert.deepStrictEqual(parsed.items, [
  { id: hash, kind: 'infohash', name: 'Channel, One', group: 'News, World' },
  { id: hash2, kind: 'infohash', name: 'Second', group: 'Films' }
]);
assert.strictEqual(parsed.duplicates, 1);
assert.strictEqual(parsed.unsupported, 1);
assert.strictEqual(parsed.invalid, 1);

const plain = M3UCore.parse('#EXTM3U\ncontent_id:' + hash + '\n' + hash2);
assert.deepStrictEqual(plain.items.map(x => [x.id, x.kind, x.name, x.group]), [
  [hash, 'content_id', 'Canal 1', ''], [hash2, 'infohash', 'Canal 2', '']
]);

const malformed = M3UCore.parse('#EXTINF:-1 group-title="broken\n' + hash + '\n#EXTINF:-1,orphan');
assert.strictEqual(malformed.items.length, 1);
assert.strictEqual(malformed.items[0].name, 'Canal 1');
assert.ok(malformed.invalid >= 1);
assert.throws(() => M3UCore.parse('x'.repeat(2 * 1024 * 1024 + 1)), /2 MiB/);

const many = Array.from({ length: 5001 }, (_, i) => {
  const value = i.toString(16).padStart(40, '0');
  return value;
}).join('\n');
const capped = M3UCore.parse(many);
assert.strictEqual(capped.items.length, 5000);
assert.strictEqual(capped.overLimit, 1);
assert.strictEqual(capped.invalid, 0);
process.stdout.write('M3U parser regression checks passed.\n');
