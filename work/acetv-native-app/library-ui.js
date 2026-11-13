(function(){'use strict';var box,mode='recent',selected=null,draft=null,editFrom='recent',editingLink=false;function $(id){return document.getElementById(id);}function api(){return window.AceCatalog;}function button(id,text,fn,parent){var b=document.createElement('button');b.id=id;b.type='button';b.textContent=text;b.onclick=fn;(parent||$('library-actions')).appendChild(b);return b;}function close(){box.hidden=true;api().restoreFocus();}function message(text){$('library-message').textContent=text;}function render(next,focusId){mode=next;var state=api().libraryState();$('library-title').textContent=next==='recent'?'Reproducidos recientemente':next==='order'?'Ordenar favoritos':next==='links'?'Enlaces del canal':next==='confirm'?(editingLink?'¿Eliminar este enlace?':'¿Eliminar este canal?'):editingLink?'Editar enlace':'Editar canal';$('library-copy').textContent=next==='recent'?'Los últimos 12 canales que han empezado a reproducirse en esta TV.':next==='order'?'Elige un canal con ↑ y ↓. Muévelo con ← y →.':next==='links'?'El primer enlace se usa al abrir el canal desde su tarjeta.':next==='confirm'?(editingLink?'Los otros enlaces del canal seguirán disponibles.':'También se quitará de favoritos y recientes. Los demás canales se conservan.'):'Cambia el nombre o corrige el enlace guardado.';$('library-content').textContent='';$('library-actions').textContent='';message('');
if(next==='recent'){if(!state.recent.length)message('Todavía no has reproducido ningún canal.');state.recent.forEach(function(i,n){var b=button('recent-'+n,i.name,function(){if(api().playSaved(i.id)){box.hidden=true;}else message('Este canal ya no está guardado.');},$('library-content'));b.className='library-row';});button('library-order','Ordenar favoritos',function(){render('order');});if(state.links.length>1)button('library-links','Enlaces del canal',function(){render('links');});
else button('library-edit','Editar canal',function(){draft=null;editFrom='recent';editingLink=false;render('edit');}).disabled=!selected;button('library-close','Volver',close);}
if(next==='links'){
  if(!state.links.length){render('recent');return;}
  state.links.forEach(function(link,index){
    var row=document.createElement('div');
    row.className='library-link';
    $('library-content').appendChild(row);
    var label=document.createElement('span');
    label.textContent='Enlace '+(index+1)+(index===0?' · Preferido':'');
    row.appendChild(label);
    var actions=document.createElement('div');
    actions.className='library-link-actions';
    row.appendChild(actions);
    var watch=button('link-watch-'+index,'Ver ahora',function(){
      if(api().playSaved(link.id))box.hidden=true;
      else message('Este enlace ya no está guardado.');
    },actions);
    watch.setAttribute('aria-label','Ver enlace '+(index+1)+' ahora');
    watch.className='library-row';
    if(index>0){
      var prefer=button('link-prefer-'+index,'Usar primero',function(){
        var result=api().preferLink(link.id);
        if(result.ok)render('links','link-watch-0');
        message(result.message);
      },actions);
      prefer.setAttribute('aria-label','Usar primero el enlace '+(index+1));
      prefer.className='library-row';
    }
    var editLink=button('link-edit-'+index,'Editar',function(){
      selected=link;draft=null;editFrom='links';editingLink=true;render('edit');
    },actions);
    editLink.setAttribute('aria-label','Editar enlace '+(index+1));
    editLink.className='library-row';
  });
  button('library-back','Volver a opciones',function(){selected=api().libraryState().selected;render('recent');});
  button('library-close','Cerrar',close);
}
if(next==='order'){if(!state.favorites.length)message('Añade canales a favoritos para ordenarlos.');state.favorites.forEach(function(i,n){var b=button('favorite-'+i.id,(n+1)+' · '+i.name,function(){message('Usa ← y → para mover este favorito.');},$('library-content'));b.className='library-row';b.setAttribute('data-favorite',i.id);});button('library-back','Volver a opciones',function(){render('recent');});button('library-close','Cerrar',close);}
if(next==='edit'){if(!selected){render('recent');return;}if(!draft)draft={name:selected.name,source:(selected.kind||'infohash')+':'+selected.id};[['library-name','Nombre del canal',draft.name],['library-source','Enlace o código',draft.source]].forEach(function(field){var label=document.createElement('label');label.htmlFor=field[0];label.textContent=field[1];$('library-content').appendChild(label);var input=document.createElement('input');input.id=field[0];input.type='text';input.value=field[2];input.maxLength=field[0]==='library-name'?120:200;$('library-content').appendChild(input);});button('library-save','Guardar cambios',function(){var r=api().editChannel(selected.id,$('library-name').value,$('library-source').value);if(r.ok)close();else message(r.message);});button('library-delete',editingLink?'Eliminar enlace':'Eliminar canal',function(){draft={name:$('library-name').value,source:$('library-source').value};render('confirm');});button('library-cancel','Volver',function(){if(editFrom==='links')render('links');else close();});}
if(next==='confirm'){var name=document.createElement('strong');name.textContent=selected.name;$('library-content').appendChild(name);button('library-keep','Cancelar',function(){render('edit');});button('library-confirm-delete',editingLink?'Eliminar enlace':'Eliminar canal',function(){var r=api().deleteChannel(selected.id);if(r.ok)close();else message(r.message);});}
box.setAttribute('data-mode',next);var focus=focusId&&$(focusId)||$('library-content').querySelector('button,input')||$('library-actions').querySelector('button');if(focus)focus.focus();}
function open(view){if(!api())return;if(!box){box=document.createElement('section');box.id='channel-library';box.hidden=true;box.setAttribute('role','dialog');box.setAttribute('aria-modal','true');box.setAttribute('aria-labelledby','library-title');box.innerHTML='<div class="library-card"><span class="library-brand">▶ AC TV</span><h1 id="library-title"></h1><p id="library-copy"></p><div id="library-content"></div><p id="library-message" role="status" aria-live="polite"></p><div id="library-actions"></div><p class="library-hint">Flechas · Mover &nbsp; OK · Elegir &nbsp; Atrás · Volver</p></div>';document.body.appendChild(box);}selected=api().libraryState().selected;draft=null;editFrom='recent';editingLink=false;box.hidden=false;render(view==='links'?'links':'recent');}
document.addEventListener('keydown',function(e){if(!box||box.hidden)return;var k=e.keyCode,active=document.activeElement;e.stopImmediatePropagation();if(active.tagName==='INPUT'){if(k===13||k===65376){e.preventDefault();$('library-save').focus();}else if(k===27||k===10009||k===65385){e.preventDefault();active.blur();$('library-save').focus();}else if(k===40){e.preventDefault();if(active.id==='library-name')$('library-source').focus();else $('library-save').focus();}else if(k===38&&active.id==='library-source'){e.preventDefault();$('library-name').focus();}return;}
if([9,13,27,37,38,39,40,10009].indexOf(k)<0)return;e.preventDefault();if(k===27||k===10009){if(mode==='confirm')render('edit');else if(mode==='edit'&&editFrom==='links')render('links');else if(mode!=='recent'){selected=api().libraryState().selected;render('recent');}else close();return;}if(k===13){if(active.tagName==='BUTTON'&&!active.disabled)active.click();return;}if(mode==='order'&&(k===37||k===39)&&active.getAttribute('data-favorite')){var id=active.getAttribute('data-favorite'),r=api().moveFavorite(id,k===37?-1:1);render('order','favorite-'+id);message(r.message);return;}var fields=Array.prototype.slice.call(box.querySelectorAll('button,input')).filter(function(b){return !b.disabled;}),at=fields.indexOf(active),step=k===37||k===38||k===9&&e.shiftKey?-1:1;var n=Math.max(0,Math.min(fields.length-1,at+step));if(fields[n]){fields[n].focus();if(fields[n].classList.contains('library-row'))fields[n].scrollIntoView({block:'nearest'});}},true);window.AceLibraryUI={open:open,close:close};}());
