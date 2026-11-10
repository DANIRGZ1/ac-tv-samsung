'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');
var vm = require('vm');
var base = path.join(__dirname, 'acetv-native-app');
var AceCore = require(path.join(base, 'ace-core.js'));
var CatalogCore = require(path.join(base, 'catalog-core.js'));
var FavoritesCore = require(path.join(base, 'favorites-core.js'));
var LibraryCore = require(path.join(base, 'library-core.js'));
var M3UCore = require(path.join(base, 'm3u-core.js'));
var source = fs.readFileSync(path.join(base, 'catalog.js'), 'utf8');
var hashA = '0123456789abcdef0123456789abcdef01234567';

function hash(n) { return (n.toString(16).padStart(40, '0')); }
function createApp(favorites, cacheValue, response, options) {
  options = options || {};
  var elements = {}, requests = [], storage = { 'ace-tv.favorites': JSON.stringify(favorites || []) };
  if (cacheValue !== undefined) storage['ace-tv.channels'] = typeof cacheValue === 'string' ? cacheValue : JSON.stringify(cacheValue);
  if (options.recents) storage['ace-tv.recent'] = JSON.stringify(options.recents);
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
  var window = { tizen: null, LibraryCore: LibraryCore };
  var context = { document: document, window: window, localStorage: { getItem: function (k) { return storage[k] || null; }, setItem: function (k, v) { if (options.failChannelWrite && k === 'ace-tv.channels') throw new Error('storage full'); storage[k] = v; }, removeItem: function (k) { delete storage[k]; } },
    FavoritesCore: FavoritesCore, CatalogCore: CatalogCore, AceCore: AceCore, LibraryCore: LibraryCore, M3UCore: M3UCore,
    AceTV: { setViewport: function () {}, stop: function () {}, diagnostics: function () { return { phase: 'idle' }; }, play: function () {} },
    XMLHttpRequest: Xhr, setTimeout: function () { return 1; }, clearTimeout: function () {}, URL: URL };
  vm.runInNewContext(source, context);
  return { api:window.AceCatalog, elements: elements, requests: requests, storage: storage, diag: function () { return window.AceCatalog.diagnostics(); },
    respond: function (index, value) { reply(requests[index], value); } };
}

var favorite={id:hashA,name:'Mi canal favorito'},app=createApp([favorite],[{id:hash(2),name:'Café Noticias'}]);assert.strictEqual(app.diag().cachedChannels,2);assert.strictEqual(app.diag().favorites,1);assert.strictEqual(app.requests.length,0);app.elements['guide-search'].click();app.elements['guide-query'].value='cafe';app.elements['guide-search-submit'].click();assert.strictEqual(app.elements['guide-list'].children.length,1);assert.strictEqual(app.requests.length,0);
var empty=createApp([],[]);assert.strictEqual(empty.diag().cachedChannels,0);assert.strictEqual(typeof empty.api.refresh,'undefined','public build has no directory download API');assert.strictEqual(empty.api.addChannel('Mi canal','invalid').ok,false);assert.strictEqual(empty.api.addChannel('',hash(3)).ok,false);assert.strictEqual(empty.diag().cachedChannels,0);assert.strictEqual(empty.api.addChannel('Fútbol 1',hash(3)).ok,true);assert.strictEqual(empty.api.addChannel('Otro nombre',hash(3)).ok,true);assert.strictEqual(empty.diag().cachedChannels,1,'duplicate link preserves existing name');assert.strictEqual(empty.api.addChannel('Otro tipo','content_id:'+hash(3)).ok,false,'different identifier kind must not be silently discarded');assert.strictEqual(JSON.parse(empty.storage['ace-tv.channels'])[0].name,'Fútbol 1');assert.strictEqual(empty.api.addChannel('Campeones 1','content_id:'+hash(4)).ok,true);assert.strictEqual(empty.api.toggleFavorite(hash(4)),true);assert.strictEqual(JSON.parse(empty.storage['ace-tv.favorites'])[0].kind,'content_id');assert.strictEqual(FavoritesCore.normalize(JSON.parse(empty.storage['ace-tv.favorites']))[0].kind,'content_id');assert.strictEqual(empty.requests.length,0,'saving and local search never downloads catalogues');
var fail=createApp([],[],null,{failChannelWrite:true});assert.strictEqual(fail.api.addChannel('Canal propio',hash(5)).ok,false);assert.strictEqual(fail.diag().cachedChannels,0,'failed write rolls back');var many=[];for(var i=1;i<=60;i++)many.push({id:hash(i),name:'Canal '+i});var paging=createApp([],many);paging.elements['guide-live'].click();paging.elements['guide-next'].click();assert.strictEqual(paging.elements['guide-list'].children.length,10);assert.strictEqual(paging.requests.length,0);console.log('PASS empty-by-default public app, local search/paging, own-link validation, duplicates, content-ID favorites and storage rollback.');

var playlist = '#EXTM3U\n#EXTINF:-1,Duplicate\nacestream://' + hash(11) +
  '\n#EXTINF:-1 group-title="Noticias",Canal importado\ncontent_id:' + hash(12) +
  '\n#EXTINF:-1,HLS\nhttps://example.invalid/stream.m3u8';
var saved = { id: hash(11), name: 'Nombre original' };
var importApp = createApp([saved], [saved], null, { recents: [saved] });
var original = Object.assign({}, importApp.storage);
var preview = importApp.api.previewM3U(playlist);
assert.strictEqual(preview.newCount, 1);
assert.strictEqual(preview.duplicates, 1);
assert.strictEqual(preview.unsupported, 1);
assert.deepStrictEqual(importApp.storage, original, 'preview does not write');
assert.strictEqual(importApp.api.importM3U(playlist).ok, true);
var imported = JSON.parse(importApp.storage['ace-tv.channels']);
assert.strictEqual(imported[0].name, saved.name);
assert.strictEqual(imported[1].kind, 'content_id');
assert.strictEqual(imported[1].category, 'Noticias');
assert.strictEqual(importApp.storage['ace-tv.favorites'], original['ace-tv.favorites']);
assert.strictEqual(importApp.storage['ace-tv.recent'], original['ace-tv.recent']);
assert.strictEqual(importApp.api.importM3U(playlist).newCount, 0, 'reimport is idempotent');
importApp.api.search('Canal importado');
assert.strictEqual(importApp.elements['guide-list'].children.length, 1);
assert.strictEqual(importApp.requests.length, 0, 'import and search stay local');

var full = createApp([], Array.from({length: 5000}, function (_, i) { return { id: hash(i + 100), name: 'Canal ' + i }; }));
assert.strictEqual(full.api.previewM3U(playlist).overLimit, 2);
assert.strictEqual(full.api.importM3U(playlist).newCount, 0);
var failImport = createApp([saved], [saved], null, { failChannelWrite: true, recents: [saved] });
assert.strictEqual(failImport.api.importM3U(playlist).ok, false);
assert.strictEqual(failImport.diag().cachedChannels, 1);
assert.deepStrictEqual(JSON.parse(failImport.storage['ace-tv.channels']), [saved]);
console.log('PASS M3U preview, append-only import, preserved favorites and history, capacity, reimport and rollback.');
