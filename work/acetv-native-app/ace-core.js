(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.AceCore = factory();
  }
}(this, function () {
  'use strict';

  var HASH = /^[0-9a-fA-F]{40}$/;

  function parse(value) {
    var match;
    var id;
    var kind = 'infohash';

    if (typeof value !== 'string') return null;

    if (HASH.test(value)) {
      id = value;
    } else if ((match = /^acestream:\/\/([0-9a-fA-F]{40})$/.exec(value))) {
      id = match[1];
    } else if ((match = /^https:\/\/acestreamui\.app\/\?f=([0-9a-fA-F]{40})$/.exec(value))) {
      id = match[1];
    } else if ((match = /^(content_id|infohash):([0-9a-fA-F]{40})$/.exec(value))) {
      kind = match[1];
      id = match[2];
    } else {
      return null;
    }

    return { id: id.toLowerCase(), kind: kind };
  }

  function isPrivateIpv4(host) {
    var parts = host.split('.');
    var octets = [];
    var i;
    var number;

    if (parts.length !== 4) return false;
    for (i = 0; i < parts.length; i += 1) {
      if (!/^(0|[1-9][0-9]{0,2})$/.test(parts[i])) return false;
      number = Number(parts[i]);
      if (number > 255) return false;
      octets.push(number);
    }

    return octets[0] === 10 ||
      (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
      (octets[0] === 192 && octets[1] === 168) ||
      octets[0] === 127;
  }

  function engine(value) {
    var match;
    var host;
    var port;

    if (typeof value !== 'string') return null;
    match = /^http:\/\/([^/?#@]+)(\/?)$/.exec(value);
    if (!match) return null;

    host = match[1];
    match = /^([^:]+)(?::([0-9]+))?$/.exec(host);
    if (!match) return null;

    host = match[1];
    if (host !== 'localhost' && !isPrivateIpv4(host)) return null;

    port = match[2] === undefined ? 6878 : Number(match[2]);
    if (!isFinite(port) || port < 1 || port > 65535 || String(port) !== (match[2] || '6878')) return null;

    return 'http://' + host + ':' + port;
  }

  return { parse: parse, engine: engine };
}));
