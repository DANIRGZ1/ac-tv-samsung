(function () {
  'use strict';
  var dialog, draft = '', launcher, reader;
  var MAX_BYTES = 2 * 1024 * 1024;

  function $(id) { return document.getElementById(id); }

  function action(id, text, callback) {
    var button = document.createElement('button');
    button.id = id;
    button.type = 'button';
    button.textContent = text;
    button.addEventListener('click', callback);
    $('m3u-actions').appendChild(button);
    return button;
  }

  function cancelRead() {
    if (!reader) return;
    var previous = reader;
    reader = null;
    previous.abort();
  }

  function close() {
    cancelRead();
    draft = '';
    $('m3u-content').textContent = '';
    $('m3u-actions').textContent = '';
    $('m3u-message').textContent = '';
    dialog.hidden = true;
    launcher.focus();
  }

  function readFile(event) {
    cancelRead();
    var file = event.target.files && event.target.files[0];
    if (!file) return;
    if (file.size > MAX_BYTES) {
      $('m3u-message').textContent = 'El archivo supera el límite de 2 MiB.';
      return;
    }
    var current = new FileReader();
    reader = current;
    current.onload = function () {
      if (reader !== current) return;
      reader = null;
      $('m3u-text').value = String(current.result || '');
      $('m3u-message').textContent = 'Archivo listo para revisar.';
      $('m3u-preview').focus();
    };
    current.onerror = function () {
      if (reader !== current) return;
      reader = null;
      $('m3u-message').textContent = 'No se pudo leer el archivo.';
    };
    current.readAsText(file);
  }

  function reset(title, copy) {
    $('m3u-title').textContent = title;
    $('m3u-copy').textContent = copy;
    $('m3u-content').textContent = '';
    $('m3u-actions').textContent = '';
    $('m3u-message').textContent = '';
  }

  function editor() {
    reset('Importar lista M3U', 'Elige un archivo de hasta 2 MiB o pega una lista de enlaces Ace Stream.');
    var content = $('m3u-content');
    content.innerHTML = '<input id="m3u-file" type="file" accept=".m3u,.m3u8" hidden>' +
      '<button id="m3u-choose" type="button">Elegir archivo</button>' +
      '<label for="m3u-text">O pega el contenido de la lista</label>' +
      '<textarea id="m3u-text" spellcheck="false" autocomplete="off" placeholder="#EXTM3U"></textarea>';
    $('m3u-file').addEventListener('change', readFile);
    $('m3u-choose').addEventListener('click', function () { $('m3u-file').click(); });
    $('m3u-text').value = draft;
    $('m3u-text').addEventListener('input', cancelRead);
    action('m3u-preview', 'Revisar lista', preview);
    action('m3u-cancel', 'Cancelar', close);
    $('m3u-choose').focus();
  }

  function preview() {
    if (reader) {
      $('m3u-message').textContent = 'Espera a que termine la lectura del archivo.';
      return;
    }
    draft = $('m3u-text').value;
    var result = AceCatalog.previewM3U(draft);
    if (!result.ok) {
      $('m3u-message').textContent = result.message;
      return;
    }
    reset('Revisar importación', 'Los canales se añaden a tu biblioteca cuando confirmes.');
    var summary = document.createElement('dl');
    summary.className = 'm3u-summary';
    [['Nuevos', result.newCount], ['Duplicados', result.duplicates], ['No compatibles', result.unsupported],
      ['Inválidos', result.invalid], ['Sobre el límite', result.overLimit]].forEach(function (entry) {
      var name = document.createElement('dt');
      var value = document.createElement('dd');
      name.textContent = entry[0];
      value.textContent = entry[1];
      summary.appendChild(name);
      summary.appendChild(value);
    });
    $('m3u-content').appendChild(summary);
    if (result.names.length) {
      var list = document.createElement('ul');
      result.names.forEach(function (name) {
        var row = document.createElement('li');
        row.textContent = name;
        list.appendChild(row);
      });
      $('m3u-content').appendChild(list);
    } else {
      $('m3u-message').textContent = 'No hay canales nuevos que puedas importar.';
    }
    action('m3u-back', 'Volver', editor).focus();
    action('m3u-confirm', 'Importar', function () {
      var imported = AceCatalog.importM3U(draft);
      if (!imported.ok || !imported.newCount) {
        $('m3u-message').textContent = imported.message || 'No quedan canales nuevos en esta lista.';
        return;
      }
      close();
      AceCatalog.showImported(imported.message);
    }).disabled = result.newCount === 0;
    action('m3u-cancel', 'Cancelar', close);
  }

  launcher = $('import-m3u');
  launcher.addEventListener('click', function () {
    if (!dialog) {
      dialog = document.createElement('section');
      dialog.id = 'm3u-dialog';
      dialog.setAttribute('role', 'dialog');
      dialog.setAttribute('aria-modal', 'true');
      dialog.setAttribute('aria-labelledby', 'm3u-title');
      dialog.innerHTML = '<div class="m3u-card"><span class="library-brand">▶ AC TV</span>' +
        '<h1 id="m3u-title"></h1><p id="m3u-copy"></p><div id="m3u-content"></div>' +
        '<p id="m3u-message" role="status" aria-live="polite"></p><div id="m3u-actions"></div>' +
        '<p class="library-hint">Flechas · Mover &nbsp; OK · Elegir &nbsp; Atrás · Volver</p></div>';
      document.body.appendChild(dialog);
    }
    dialog.hidden = false;
    editor();
  });

  window.addEventListener('keydown', function (event) {
    if (!dialog || dialog.hidden) return;
    var key = event.keyCode, focused = document.activeElement;
    event.stopImmediatePropagation();
    if (key === 27 || key === 10009 || key === 65385) {
      event.preventDefault();
      if (focused.id === 'm3u-text') $('m3u-preview').focus();
      else close();
      return;
    }
    if (key === 13 && focused.tagName === 'BUTTON') {
      event.preventDefault();
      focused.click();
      return;
    }
    if (key !== 9 && (focused.id === 'm3u-text' || [37, 38, 39, 40].indexOf(key) < 0)) return;
    event.preventDefault();
    var fields = Array.from(dialog.querySelectorAll('button:not(:disabled), textarea'));
    var step = key === 37 || key === 38 || (key === 9 && event.shiftKey) ? -1 : 1;
    fields[(fields.indexOf(focused) + step + fields.length) % fields.length].focus();
  }, true);
})();
