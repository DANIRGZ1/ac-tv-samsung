'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');
var vm = require('vm');
var base = path.join(__dirname, 'acetv-native-app');
var AceCore = require(path.join(base, 'ace-core.js'));
var CatalogCore = require(path.join(base, 'catalog-core.js'));
var FavoritesCore = require(path.join(base, 'favorites-core.js'));
var source = fs.readFileSync(path.join(base, 'catalog.js'), 'utf8');
var hashA = '0123456789abcdef0123456789abcdef01234567';

function hash(n) { return (n.toString(16).padStart(40, '0')); }
function createApp(favorites, cacheValue, response, options) {
  options = options || {};
  var elements = {}, requests = [], storage = { 'ace-tv.favorites': JSON.stringify(favorites || []) };
  if (cacheValue !== undefined) storage['ace-tv.channels'] = typeof cacheValue === 'string' ? cacheValue : JSON.stringify(cacheValue);
  function element(tag, owner) {
    var e = { tagName: tag.toUpperCase(), id: '', value: '', hidden: false, disabled: false, className: '', children: [], attributes: {}, style: {},
      offsetTop: 0, offsetHeight: 40, scrollTop: 0, clientHeight: 500,
      appendChild: function (child) { child.parent = this; this.children.push(child); return child; },
      setAttribute: function (n, v) { this.attributes[n] = String(v); }, getAttribute: function (n) { return this.attributes[n] || null; },
      focus: function () { owner.activeElement = this; if (this.onfocus) this.onfocus(); },
      click: function () { if (this.onclick) this.onclick(); }, blur: function () { if (owner.activeElement === this) owner.activeElement = null; },
      classList: { add: function (n) { if (e.className.split(' ').indexOf(n) < 0) e.className += (e.className ? ' ' : '') + n; },
        remove: function (n) { e.className = e.className.split(' ').filter(function (x) { return x && x !== n; }).join(' '); },
        toggle: function (n, force) { var on = force === undefined ? e.className.split(' ').indexOf(n) < 0 : !!force; if (on) this.add(n); else this.remove(n); return on; } }
    };
    Object.defineProperty(e, 'textContent', { get: function () { return e._text || ''; }, set: function (v) { e._text = String(v); if (v === '') e.children = []; } });
    return e;
  }
  var document = { activeElement: null, documentElement: { clientWidth: 1920, clientHeight: 1080 }, getElementById: function (id) { return elements[id] || null; },
    body: null, createElement: function (tag) { var n = element(tag, document), append = n.appendChild; n.appendChild = function (child) { append.call(n, child); if (child.id) elements[child.id] = child; return child; }; return n; },
    addEventListener: function () {} };
  document.body = element('body', document);
  ['engine', 'source', 'explore', 'backguide', 'import-pc'].forEach(function (id) { var n = element('input', document); n.id = id; elements[id] = n; });
  elements.engine.value = 'http://127.0.0.1:6878';
  function Xhr() { requests.push(this); this.status = 200; this.timeout = 0; this.aborted = false; }
  Xhr.prototype.open = function (method, url) { this.method = method; this.url = url; };
  Xhr.prototype.abort = function () { this.aborted = true; };
  function reply(xhr, value) {
    value = value || { result: { total: 0, results: [] } };
    xhr.status = value.httpStatus === undefined ? 200 : value.httpStatus;
    xhr.responseText = JSON.stringify(value.body === undefined ? value : value.body);
    if (xhr.onload) xhr.onload();
  }
  Xhr.prototype.send = function () {
    if (options.defer) return;
    var value = Array.isArray(response) ? response[requests.indexOf(this)] : response;
    reply(this, value);
  };
  var window = { tizen: null };
  var context = { document: document, window: window, localStorage: { getItem: function (k) { return storage[k] || null; }, setItem: function (k, v) { if (options.failChannelWrite && k === 'ace-tv.channels') throw new Error('storage full'); storage[k] = v; } },
    FavoritesCore: FavoritesCore, CatalogCore: CatalogCore, AceCore: AceCore,
    AceTV: { setViewport: function () {}, stop: function () {}, diagnostics: function () { return { phase: 'idle' }; }, play: function () {} },
    XMLHttpRequest: Xhr, setTimeout: function () { return 1; }, clearTimeout: function () {}, URL: URL };
  vm.runInNewContext(source, context);
  return { elements: elements, requests: requests, storage: storage, diag: function () { return window.AceCatalog.diagnostics(); },
    respond: function (index, value) { reply(requests[index], value); } };
}

var favorite = { id: hashA, name: 'Canal favorito' };
var initialCache = [{ id: hash(2), name: 'Café Noticias' }];
var app = createApp([favorite], initialCache);
assert.strictEqual(app.diag().cachedChannels, 2, 'favorites should seed the channel cache');
assert.strictEqual(JSON.parse(app.storage['ace-tv.channels']).some(function (x) { return x.id === hashA; }), true, 'favorite seed should persist');
assert.strictEqual(app.requests.length, 0, 'opening the guide should stay local');
app.elements['guide-search'].click(); app.elements['guide-query'].value = 'cafe'; app.elements['guide-search-submit'].click();
assert.strictEqual(app.requests.length, 0, 'search should stay local');
assert.strictEqual(app.elements['guide-list'].children.length, 1, 'accent-insensitive name search should match');
app.elements['guide-favorites'].click();
assert.strictEqual(app.requests.length, 0, 'favorites should stay local');
app.elements['guide-home'].click();
assert.strictEqual(app.requests.length, 0, 'returning to local catalog should not fetch');

var many = []; for (var i = 1; i <= 60; i++) many.push({ id: hash(i), name: 'Channel ' + i });
var paging = createApp([], many); paging.elements['guide-live'].click(); paging.elements['guide-next'].click();
assert.strictEqual(paging.requests.length, 0, 'pagination should stay local');
assert.strictEqual(paging.elements['guide-list'].children.length, 10);

var importedHash = 'abcdef0123456789abcdef0123456789abcdef01';
var importApp = createApp([], [], { result: { total: 3, results: [
  { name: '  N\u0001oticias  ', category: 'sport', items: [{ infohash: importedHash, status: 'ok' }] },
  { name: 'Duplicate', items: [{ infohash: importedHash }] },
  { name: 'Bad hash', items: [{ infohash: 'invalid' }] }
] } });
importApp.elements['guide-reload'].click();
assert.strictEqual(importApp.requests.length, 1, 'explicit reload should issue one request');
assert.strictEqual(importApp.requests[0].url.indexOf('https://search.acestream.net/?') === 0, true);
var persisted = JSON.parse(importApp.storage['ace-tv.channels']);
assert.strictEqual(persisted.length, 1, 'bad and duplicate channels should be discarded');
assert.strictEqual(persisted[0].id, importedHash);
assert.strictEqual(persisted[0].name, '  Noticias  '.trim());

var full = []; for (i = 1; i <= 5000; i++) full.push({ id: hash(i), name: 'Ch ' + i });
var bounded = createApp([], full, { result: { total: 1, results: [{ name: 'Fresh', items: [{ infohash: importedHash }] }] } });
bounded.elements['guide-reload'].click();
assert.strictEqual(JSON.parse(bounded.storage['ace-tv.channels']).length, 5000, 'cache must stay capped at 5000');

var malformed = createApp([favorite], '{not json');
assert.strictEqual(malformed.diag().cachedChannels, 1, 'malformed cache should be ignored while favorites seed the cache');
assert.strictEqual(malformed.requests.length, 0);
assert.strictEqual(persisted[0].category, 'sport', 'a later duplicate without category must not erase available category metadata');

function group(n, category) {
  var entry = { name: 'Imported ' + n, infohash: hash(n), status: 2 };
  if (category) entry.categories = [category];
  return { name: 'Group ' + n, items: [entry] };
}
function page(total, results) { return { result: { total: total, results: results } }; }

var bulkFirst = []; for (i = 1; i <= 200; i++) bulkFirst.push(group(i, i === 1 ? 'regional' : 'sport'));
var bulkTail = [
  { name: 'Duplicate group', items: [{ name: 'Duplicate channel', infohash: hash(1), status: 1 }] },
  group(201, 'music')
];
var bulk = createApp([], [], [page(202, bulkFirst), page(202, bulkTail)]);
bulk.elements['guide-reload'].click();
assert.strictEqual(bulk.requests.length, 2, 'a short final page should end a bulk import');
assert.strictEqual(bulk.requests[0].url.indexOf('page_size=200') >= 0, true, 'bulk requests should use the supported page size');
assert.strictEqual(bulk.requests[0].url.indexOf('query=') >= 0, false, 'bulk import should fetch the full catalog');
var bulkCache = JSON.parse(bulk.storage['ace-tv.channels']);
assert.strictEqual(bulkCache.length, 201, 'all unique channels across pages should be imported');
assert.strictEqual(bulkCache.find(function (x) { return x.id === hash(1); }).category, 'regional', 'duplicate IDs across pages should preserve the available category');

var oldCached = [{ id: hash(900), name: 'Previous catalog' }];
var failureFirst = []; for (i = 1; i <= 200; i++) failureFirst.push(group(i));
var pageFailure = createApp([], oldCached, [page(201, failureFirst), { httpStatus: 503, body: { error: 'unavailable' } }]);
var oldStorageAfterLoad = JSON.parse(pageFailure.storage['ace-tv.channels']);
pageFailure.elements['guide-reload'].click();
assert.strictEqual(pageFailure.requests.length, 2, 'the second page should be requested before the simulated error');
assert.deepStrictEqual(JSON.parse(pageFailure.storage['ace-tv.channels']), oldStorageAfterLoad, 'a later-page error must leave the old cache untouched');

var cancelled = createApp([], oldCached, null, { defer: true });
oldStorageAfterLoad = JSON.parse(cancelled.storage['ace-tv.channels']);
cancelled.elements['guide-reload'].click();
assert.strictEqual(cancelled.requests.length, 1, 'deferred bulk import should start one page');
cancelled.elements['guide-home'].click();
cancelled.respond(0, page(1, [group(901)]));
assert.deepStrictEqual(JSON.parse(cancelled.storage['ace-tv.channels']), oldStorageAfterLoad, 'a response arriving after cancellation must be ignored');

var storageFailure = createApp([], oldCached, page(1, [group(902)]), { failChannelWrite: true });
oldStorageAfterLoad = JSON.parse(storageFailure.storage['ace-tv.channels']);
storageFailure.elements['guide-reload'].click();
assert.deepStrictEqual(JSON.parse(storageFailure.storage['ace-tv.channels']), oldStorageAfterLoad, 'storage write failure must retain the existing persisted cache');
assert.strictEqual(storageFailure.diag().cachedChannels, 1, 'storage write failure must roll back the in-memory cache too');
var personalName = createApp([{id:importedHash,name:'Mi DAZN'}], [], {result:{total:1,results:[{name:'Nombre remoto',items:[{infohash:importedHash,categories:['sport']}]}]}});
personalName.elements['guide-reload'].click();
var personalCache = JSON.parse(personalName.storage['ace-tv.channels']);
assert.strictEqual(personalCache[0].name,'Mi DAZN','imports must retain personal favorite names');
assert.strictEqual(personalCache[0].category,'sport','personal names must not discard imported categories');
personalName.elements['guide-query'].value='Mi DAZN';personalName.elements['guide-search-submit'].click();
assert.strictEqual(personalName.diag().items,1,'personal favorite names remain searchable after import');
var directCatalog=createApp([],[],{total:1,results:[{name:'Canal directo',items:[{infohash:hash(30)}]}]});
directCatalog.elements['guide-reload'].click();
assert.strictEqual(directCatalog.diag().cachedChannels,1,'official flat response imports without a PC engine');
assert.strictEqual(new URL(directCatalog.requests[0].url).hostname,'search.acestream.net');
var backupCatalog=createApp([],[],{result:{total:1,results:[{name:'Canal local',items:[{infohash:hash(31)}]}]}});
backupCatalog.elements['import-pc'].click();
assert.strictEqual(new URL(backupCatalog.requests[0].url).hostname,'127.0.0.1','PC source is contacted only through explicit backup import');
var names=createApp([], [{id:hash(41),name:'M. Liga de Campeones'},{id:hash(42),name:'DAZN LaLiga'},{id:hash(43),name:'Café Noticias'},{id:hash(44),name:'Campeones TV'}]);
['movistar','movistar campeones','dazn la liga','daznlaliga','noticias cafe'].forEach(function(term){names.elements['guide-query'].value=term;names.elements['guide-search-submit'].click();assert.strictEqual(names.diag().items,1,'channel search handles brands, spaces, accents and word order: '+term);});
assert.strictEqual(names.requests.length,0,'smart search remains entirely local');
console.log('Local/direct catalog, smart search, paging, rollback, favorites and malformed-cache checks passed');
