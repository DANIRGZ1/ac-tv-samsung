(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.FavoritesCore = factory();
  }
}(this, function () {
  'use strict';

  var ID = /^[0-9a-fA-F]{40}$/;
  var CONTROL = /[\x00-\x1f\x7f-\x9f]/g;
  var LIMIT = 100;

  function cleanName(value) {
    return value.replace(CONTROL, '').substring(0, 120);
  }

  function normalize(value) {
    var result = [];
    var seen = {};
    var i;
    var entry;
    var id;
    var key;
    if (Object.prototype.toString.call(value) !== '[object Array]') return result;

    for (i = 0; i < value.length && result.length < LIMIT; i += 1) {
      entry = value[i];
      if (!entry || typeof entry !== 'object' || typeof entry.id !== 'string' ||
          !ID.test(entry.id) || typeof entry.name !== 'string') continue;
      id = entry.id.toLowerCase();
      key = '$' + id;
      if (seen[key]) continue;
      seen[key] = true;
      var item={id:id,name:cleanName(entry.name)};if(entry.kind==='content_id')item.kind='content_id';result.push(item);
    }
    return result;
  }

  function order(items, favorites) {
    var source = normalize(items);
    var saved = normalize(favorites);
    var byId = {};
    var used = {};
    var result = [];
    var i;
    var item;
    var key;

    for (i = 0; i < source.length; i += 1) {
      byId['$' + source[i].id] = source[i];
    }
    for (i = 0; i < saved.length; i += 1) {
      key = '$' + saved[i].id;
      item = byId[key];
      if (item && !used[key]) {
        result.push(item);
        used[key] = true;
      }
    }
    for (i = 0; i < source.length; i += 1) {
      item = source[i];
      key = '$' + item.id;
      if (!used[key]) result.push(item);
    }
    return result;
  }

  function toggle(favorites, item) {
    var result = normalize(favorites);
    var normalizedItem = normalize([item]);
    var i;
    if (!normalizedItem.length) return result;

    for (i = 0; i < result.length; i += 1) {
      if (result[i].id === normalizedItem[0].id) {
        result.splice(i, 1);
        return result;
      }
    }
    if (result.length < LIMIT) result.push(normalizedItem[0]);
    return result;
  }

  return { normalize: normalize, order: order, toggle: toggle };
}));
