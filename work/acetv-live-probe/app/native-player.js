/* Samsung AVPlay adapter for the TV-local HTTP MPEG-TS source. */
function NativeTsPlayer(objectElement, onEvent) {
  var api = window.webapis && window.webapis.avplay;
  var generation = 0;
  var state = 'idle';
  var source = null;
  var currentTimeSeconds = 0;
  var tracks = { audio: [], video: [] };

  function emit(type, detail) {
    if (typeof onEvent === 'function') {
      var event = { type: type };
      if (detail) Object.keys(detail).forEach(function (key) { event[key] = detail[key]; });
      onEvent(event);
    }
  }
  function validUrl(value) {
    if (typeof value !== 'string' || value.length > 2048) return false;
    var match = /^http:\/\/127\.0\.0\.1:(\d{1,5})\/([0-9a-fA-F]+)\.ts$/.exec(value);
    if (!match) return false;
    var port = Number(match[1]);
    return port > 0 && port <= 65535;
  }
  function active(token) { return token === generation; }
  function safeError(error) {
    if (typeof error === 'string' && /^[A-Za-z0-9_ -]{1,80}$/.test(error)) return error;
    var name = error && error.name;
    return typeof name === 'string' && /^[A-Za-z0-9_ -]{1,80}$/.test(name) ? name : 'AVPlay error';
  }
  function parseTracks(token) {
    if (!active(token)) return;
    var found = { audio: [], video: [] };
    try {
      var infos = api.getTotalTrackInfo() || [];
      infos.forEach(function (info) {
        var type = info && info.type;
        if (type !== 'AUDIO' && type !== 'VIDEO') return;
        var item = { type: type.toLowerCase() };
        if (Number.isFinite(info.index)) item.index = info.index;
        var extra = info.extra_info;
        if (typeof extra === 'string') {
          try { extra = JSON.parse(extra); } catch (_) { extra = null; }
        }
        if (extra && typeof extra === 'object') {
          ['width', 'height', 'channels'].forEach(function (key) {
            var raw = extra[key];
            if (raw == null && key === 'width') raw = extra.Width;
            if (raw == null && key === 'height') raw = extra.Height;
            var value = Number(raw);
            if (raw != null && Number.isFinite(value) && value > 0 && value < 100000) item[key] = value;
          });
          ['codec', 'fourCC', 'track_lang'].forEach(function (key) {
            if (typeof extra[key] === 'string' && /^[A-Za-z0-9_./+-]{1,40}$/.test(extra[key])) item[key] = extra[key];
          });
        }
        found[type.toLowerCase()].push(item);
      });
    } catch (_) { /* Track metadata is optional on some TV firmware. */ }
    try {
      var stream = api.getCurrentStreamInfo && api.getCurrentStreamInfo();
      if (stream && typeof stream === 'object') {
        ['width', 'height'].forEach(function (key) {
          if (Number.isFinite(stream[key]) && found.video.length) found.video[0][key] = stream[key];
        });
      }
    } catch (_) { /* Optional firmware API. */ }
    tracks = found;
    emit('configured', { tracks: found });
  }
  function stop() {
    generation++;
    source = null;
    state = 'idle';
    currentTimeSeconds = 0;
    tracks = { audio: [], video: [] };
    if (api) {
      try { if (api.getState() !== 'NONE') api.stop(); } catch (_) {}
      try { api.close(); } catch (_) {}
    }
    return status();
  }
  function start(url) {
    stop();
    if (!api) {
      state = 'error';
      emit('error', { error: 'AVPlay unavailable' });
      return false;
    }
    if (!validUrl(url)) {
      state = 'error';
      emit('error', { error: 'Invalid loopback stream URL' });
      return false;
    }
    source = url;
    state = 'opening';
    var token = generation;
    try {
      api.open(url);
      api.setDisplayRect(0, 0, 1920, 1080);
      api.setDisplayMethod('PLAYER_DISPLAY_MODE_LETTER_BOX');
      api.setListener({
        onbufferingstart: function () { if (active(token)) { state = 'buffering'; emit('buffering'); } },
        onbufferingcomplete: function () { if (active(token)) { state = 'playing'; emit('playing'); } },
        onbufferingprogress: function (percent) { if (active(token)) emit('buffering', { percent: Number.isFinite(percent) ? percent : undefined }); },
        oncurrentplaytime: function (milliseconds) {
          if (!active(token) || !Number.isFinite(milliseconds)) return;
          currentTimeSeconds = Math.max(0, milliseconds / 1000);
          emit('time', { currentTimeSeconds: currentTimeSeconds });
        },
        onerror: function (error) { if (active(token)) { state = 'error'; emit('error', { error: safeError(error) }); } },
        onstreamcompleted: function () { if (active(token)) { state = 'ended'; emit('ended'); } }
      });
      api.prepareAsync(function () {
        if (!active(token)) return;
        try { api.play(); state = 'playing'; parseTracks(token); emit('playing'); }
        catch (error) { state = 'error'; emit('error', { error: safeError(error) }); }
      }, function (error) {
        if (!active(token)) return;
        state = 'error'; emit('error', { error: safeError(error) });
      });
      return true;
    } catch (error) {
      if (active(token)) { state = 'error'; emit('error', { error: safeError(error) }); }
      return false;
    }
  }
  function status() {
    return { state: state, currentTimeSeconds: currentTimeSeconds, tracks: { audio: tracks.audio.slice(), video: tracks.video.slice() } };
  }
  return { start: start, stop: stop, status: status };
}
