(function () {
  'use strict';

  var panel = null;
  var previousFocus = null;
  var refreshButton = null;
  var reportText = null;

  function safeStatus(value, allowed) {
    return allowed.indexOf(value) >= 0 ? value : 'unknown';
  }

  function readReport() {
    var report = {
      appVersion: 'unavailable',
      online: typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean' ? navigator.onLine : null,
      storage: 'unavailable',
      channels: 'unavailable',
      favorites: 'unavailable',
      recent: 'unavailable',
      phase: 'unknown',
      recovery: 'unknown',
      protonProfile: 'unavailable',
      nativePlayer: false
    };
    try {
      if (window.tizen && tizen.application && tizen.application.getCurrentApplication) {
        var info = tizen.application.getCurrentApplication().appInfo;
        if (info && typeof info.version === 'string') report.appVersion = info.version;
      }
    } catch (e) {}
    try {
      var storage = window.localStorage;
      var key = '__ace_tv_diag__' + Date.now() + Math.random();
      storage.setItem(key, '1');
      storage.removeItem(key);
      report.storage = 'available';
      ['ace-tv.channels', 'ace-tv.favorites', 'ace-tv.recent'].forEach(function (name) {
        var raw = storage.getItem(name);
        var count = 0;
        if (raw) {
          var parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) count = parsed.length;
        }
        if (name === 'ace-tv.channels') report.channels = count;
        if (name === 'ace-tv.favorites') report.favorites = count;
        if (name === 'ace-tv.recent') report.recent = count;
      });
    } catch (e) { report.storage = 'unavailable'; }
    try {
      var state = window.AceTV && typeof AceTV.diagnostics === 'function' ? AceTV.diagnostics() : null;
      if (state) {
        report.phase = safeStatus(state.phase, ['idle', 'connecting', 'preparing', 'playing', 'paused']);
        var playback = state.playbackMonitor || {};
        report.recovery = safeStatus(playback.status, ['idle', 'monitoring', 'unavailable', 'recovering', 'healthy', 'stalled', 'paused', 'stopped', 'inactive']);
        report.nativePlayer = state.nativePlayer === true;
      }
    } catch (e) {}
    try {
      if (window.AceVpnProfile && typeof AceVpnProfile.read === 'function') {
        report.protonProfile = AceVpnProfile.read() ? 'present' : 'not present';
      } else report.protonProfile = 'not configured';
    } catch (e) { report.protonProfile = 'unavailable'; }
    try {
      report.nativePlayer = report.nativePlayer || !!(window.webapis && webapis.avplay && typeof webapis.avplay.open === 'function');
    } catch (e) {}
    return report;
  }

  function render() {
    var data = readReport();
    var phases={idle:'En espera',connecting:'Conectando',preparing:'Preparando vídeo',playing:'Reproduciendo',paused:'En pausa'};
    var states={idle:'En espera',monitoring:'Comprobando reproducción',unavailable:'Sin información del reproductor',
      recovering:'Reconectando',healthy:'Reproducción estable',stalled:'Emisión detenida',paused:'En pausa',stopped:'Detenido',inactive:'Inactivo'};
    reportText.value=[
      'AC TV · Comprobación de la aplicación',
      'Versión: '+data.appVersion,
      'Red: '+(data.online===false?'Sin conexión':data.online===true?'Disponible · Internet sin comprobar':'Sin información'),
      'Almacenamiento: '+(data.storage==='available'?'Disponible':'No se pudo comprobar'),
      'Canales: '+data.channels+' · Favoritos: '+data.favorites+' · Recientes: '+data.recent,
      'Reproductor de Samsung: '+(data.nativePlayer?'Disponible':'No disponible'),
      'Estado: '+(phases[data.phase]||'Sin información'),
      'Recuperación: '+(states[data.recovery]||'Sin información'),
      'Perfil de Proton: '+(data.protonProfile==='present'?'Configurado':data.protonProfile==='not present'?'Falta configurar':data.protonProfile==='not configured'?'Esta versión no incluye Proton':'No se pudo comprobar')
    ].join('\n');
  }

  function close() {
    if (!panel || panel.hidden) return;
    panel.hidden = true;
    if (previousFocus && previousFocus.focus) previousFocus.focus();
    previousFocus = null;
  }

  function open() {
    if (!panel) {
      panel = document.createElement('section');
      panel.id = 'app-diagnostics';
      panel.className = 'diagnostics-overlay';
      panel.setAttribute('role', 'dialog');
      panel.setAttribute('aria-modal', 'true');
      panel.setAttribute('aria-labelledby', 'diagnostics-title');
      panel.innerHTML = '<div class="diagnostics-card"><h1 id="diagnostics-title">Diagnóstico</h1><p>Comprueba la red, la biblioteca y el reproductor. Puedes copiar el resultado para pedir ayuda.</p><textarea class="diagnostics-report" readonly aria-label="Informe de diagnóstico"></textarea><div class="diagnostics-actions"><button type="button" data-action="refresh">Actualizar</button><button type="button" data-action="copy">Copiar informe</button><button type="button" data-action="close">Volver</button></div><p class="diagnostics-message" role="status" aria-live="polite"></p></div>';
      document.body.appendChild(panel);
      refreshButton = panel.querySelector('[data-action="refresh"]');
      reportText = panel.querySelector('textarea');
      panel.querySelector('[data-action="refresh"]').onclick = render;
      panel.querySelector('[data-action="close"]').onclick = close;
      panel.querySelector('[data-action="copy"]').onclick = copyReport;

    }
    previousFocus = document.activeElement;
    panel.hidden = false;
    panel.querySelector('.diagnostics-message').textContent='';
    render();
    refreshButton.focus();
  }

  function copyReport() {
    var message = panel.querySelector('.diagnostics-message');
    reportText.focus();
    reportText.select();
    var copied = false;
    try { copied = document.execCommand('copy'); } catch (e) {}
    message.textContent = copied ? 'Informe copiado.' : 'Selecciona el informe y cópialo desde el menú del dispositivo.';
    if (copied) panel.querySelector('[data-action="copy"]').focus();
    else reportText.focus();
  }

  function keyHandler(event) {
    if (!panel || panel.hidden) return;
    var key = event.keyCode;
    event.stopImmediatePropagation();
    if (key === 27 || key === 10009 || key === 65385) { event.preventDefault(); close(); return; }
    if ([9, 13, 37, 38, 39, 40].indexOf(key) < 0) return;
    event.preventDefault();
    var buttons = panel.querySelectorAll('button');
    var at = Array.prototype.indexOf.call(buttons, document.activeElement);
    if (key === 13 && at >= 0) { buttons[at].click(); return; }
    if (key === 37 || key === 38 || key === 9 && event.shiftKey) at--;
    else if (key === 39 || key === 40 || key === 9) at++;
    if (at < 0) at = buttons.length - 1;
    if (at >= buttons.length) at = 0;
    buttons[at].focus();
  }

  document.addEventListener('keydown', keyHandler, true);
  window.AceDiagnosticsUI = { open: open, close: close };
}());
