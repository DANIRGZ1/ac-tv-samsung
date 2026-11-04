(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.CatalogCore = factory();
  }
}(this, function () {
  'use strict';

  var INFOHASH = /^[0-9a-fA-F]{40}$/;
  var CONTROL = /[\x00-\x1f\x7f-\x9f]/g;

  function cleanText(value, limit) {
    if (typeof value !== 'string') return '';
    return value.replace(CONTROL, '').substring(0, limit);
  }

  function normalize(payload) {
    var result = payload && payload.result;
    var groups = result && result.results;
    var items = [];
    var seen = {};
    var i;
    var j;
    var group;
    var choices;
    var entry;
    var id;
    var name;
    var status;
    var key;
    var total;

    if (!groups || Object.prototype.toString.call(groups) !== '[object Array]') {
      return { total: 0, items: [] };
    }

    for (i = 0; i < groups.length && items.length < 50; i += 1) {
      group = groups[i];
      if (!group || typeof group !== 'object' || typeof group.name !== 'string' ||
          Object.prototype.toString.call(group.items) !== '[object Array]') continue;

      name = cleanText(group.name, 120);
      choices = group.items;
      for (j = 0; j < choices.length; j += 1) {
        entry = choices[j];
        if (!entry || typeof entry !== 'object' || typeof entry.infohash !== 'string' ||
            !INFOHASH.test(entry.infohash)) continue;

        id = entry.infohash.toLowerCase();
        key = '$' + id;
        if (seen[key]) continue;
        seen[key] = true;
        status = entry.status === undefined ? group.status : entry.status;
        status = typeof status === 'number' && isFinite(status) ? status : cleanText(status, 40);
        items.push({ name: name, id: id, status: status });
        break;
      }
    }

    total = result.total;
    if (typeof total !== 'number' || !isFinite(total) || total < 0) total = items.length;
    return { total: total, items: items };
  }

  function normalizeAll(payload) {
    var result = payload && payload.result;
    var groups = result && result.results;
    var items = [];
    var seen = {};
    var i;
    var j;
    var group;
    var choices;
    var entry;
    var id;
    var name;
    var status;
    var key;
    var categories;
    var category;
    var total;
    var existing;

    if (!groups || Object.prototype.toString.call(groups) !== '[object Array]') {
      return { total: 0, items: [] };
    }

    for (i = 0; i < groups.length && items.length < 4000; i += 1) {
      group = groups[i];
      if (!group || typeof group !== 'object' ||
          Object.prototype.toString.call(group.items) !== '[object Array]') continue;

      choices = group.items;
      for (j = 0; j < choices.length && items.length < 4000; j += 1) {
        entry = choices[j];
        if (!entry || typeof entry !== 'object' || entry.disabled === true ||
            typeof entry.infohash !== 'string' || !INFOHASH.test(entry.infohash)) continue;

        id = entry.infohash.toLowerCase();
        key = '$' + id;
        categories = Object.prototype.toString.call(entry.categories) === '[object Array]' ? entry.categories :
          Object.prototype.toString.call(group.categories) === '[object Array]' ? group.categories : [];
        category = categories.length ? categories.slice(0,8).filter(function(value){return typeof value==='string';}).map(function(value){return cleanText(value,20);}).join(' ').slice(0,60) :
          cleanText(entry.category || entry.group || group.category || group.group || '', 60);
        existing = seen[key];
        if (existing) {
          if (!existing.category && category) existing.category = category;
          continue;
        }

        name = cleanText(entry.name, 120) || cleanText(group.name, 120);
        if (!name) continue;
        status = entry.status === undefined ? group.status : entry.status;
        status = typeof status === 'number' && isFinite(status) ? status : cleanText(status, 40);
        existing = { name: name, id: id, status: status, category: category };
        seen[key] = existing;
        items.push(existing);
      }
    }

    total = result.total;
    if (typeof total !== 'number' || !isFinite(total) || total < 0) total = items.length;
    return { total: total, items: items };
  }

  return { normalize: normalize, normalizeAll: normalizeAll };
}));
