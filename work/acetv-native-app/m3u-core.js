(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./ace-core.js'));
  } else {
    root.M3UCore = factory(root.AceCore);
  }
}(this, function (AceCore) {
  'use strict';

  var MAX_BYTES = 2 * 1024 * 1024;
  var MAX_CHANNELS = 5000;

  function splitExtinf(line) {
    var quote = '';
    var escaped = false;
    var i;
    for (i = 0; i < line.length; i += 1) {
      if (escaped) { escaped = false; continue; }
      var char = line.charAt(i);
      if (char === '\\' && quote) { escaped = true; continue; }
      if (char === quote) { quote = ''; continue; }
      if (!quote && (char === '"' || char === "'")) { quote = char; continue; }
      if (char === ',' && !quote) {
        return { attrs: line.slice(8, i), title: line.slice(i + 1).trim() };
      }
    }
    return null;
  }

  function attributes(source) {
    var result = Object.create(null);
    var i = 0;
    var start;
    var key;
    var value;
    var quote;
    while (i < source.length) {
      while (i < source.length && /\s/.test(source.charAt(i))) i += 1;
      start = i;
      while (i < source.length && /[A-Za-z0-9_-]/.test(source.charAt(i))) i += 1;
      if (start === i) { i += 1; continue; }
      key = source.slice(start, i).toLowerCase();
      while (i < source.length && /\s/.test(source.charAt(i))) i += 1;
      if (source.charAt(i) !== '=') continue;
      i += 1;
      while (i < source.length && /\s/.test(source.charAt(i))) i += 1;
      value = '';
      if (source.charAt(i) === '"' || source.charAt(i) === "'") {
        quote = source.charAt(i++);
        while (i < source.length && source.charAt(i) !== quote) {
          if (source.charAt(i) === '\\' && i + 1 < source.length) i += 1;
          value += source.charAt(i++);
        }
        if (source.charAt(i) === quote) i += 1;
      } else {
        start = i;
        while (i < source.length && !/\s/.test(source.charAt(i))) i += 1;
        value = source.slice(start, i);
      }
      result[key] = value;
    }
    return result;
  }

  function parse(text) {
    var result = { items: [], unsupported: 0, invalid: 0, duplicates: 0, overLimit: 0 };
    var lines;
    var pending = null;
    var seen = Object.create(null);
    var line;
    var part;
    var attrs;
    var parsed;
    var name;
    var group;
    var i;

    if (typeof text !== 'string') throw new Error('La lista M3U debe ser texto.');
    if (text.length > MAX_BYTES || new TextEncoder().encode(text).length > MAX_BYTES) {
      throw new Error('La lista supera el límite de 2 MiB.');
    }
    if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
    lines = text.split(/\r\n|\n|\r/);

    for (i = 0; i < lines.length; i += 1) {
      line = lines[i].trim();
      if (!line || line.charAt(0) === '#') {
        if (/^#EXTINF:/i.test(line)) {
          if (pending) result.invalid += 1;
          part = splitExtinf(line);
          if (!part) { pending = null; result.invalid += 1; continue; }
          attrs = attributes(part.attrs);
          pending = { name: part.title || attrs['tvg-name'], group: attrs['group-title'] || '' };
        }
        continue;
      }

      parsed = AceCore.parse(line);
      if (!parsed) {
        if (/^(?:https?:|rtmp:|rtsp:|udp:)/i.test(line)) result.unsupported += 1;
        else result.invalid += 1;
        pending = null;
        continue;
      }
      name = pending && pending.name ? pending.name : 'Canal ' + (result.items.length + result.overLimit + 1);
      group = pending ? pending.group : '';
      pending = null;
      if (Object.prototype.hasOwnProperty.call(seen, parsed.id)) {
        result.duplicates += 1;
        continue;
      }
      seen[parsed.id] = true;
      if (result.items.length >= MAX_CHANNELS) { result.overLimit += 1; continue; }
      result.items.push({ id: parsed.id, kind: parsed.kind, name: name, group: group });
    }
    if (pending) result.invalid += 1;
    return result;
  }

  return { parse: parse };
}));
