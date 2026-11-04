(function () {
'use strict';
var root, active=false, full=false, xhr=null, request=0, page=0, total=0;
var rows=[], items=[], sourceItems=[], cachedItems=[], localResults=[], index=0, query='', sport=false, onlyFavorites=false;
var homeMode=true,genre='';
var current=null, favorites=[], zapTimer=null, lastSection='guide-home';
try { favorites=FavoritesCore.normalize(JSON.parse(localStorage.getItem('ace-tv.favorites')||'[]')); } catch(e) {}
var CHANNEL_CACHE_KEY='ace-tv.channels', CHANNEL_CACHE_LIMIT=5000;
function cleanText(value,limit){return typeof value==='string'?value.replace(/[\x00-\x1f\x7f-\x9f]/g,'').slice(0,limit):'';}
function normalizeChannels(value){var result=[],seen={},i,item,id,name,category,status,key;if(Object.prototype.toString.call(value)!=='[object Array]')return result;for(i=0;i<value.length&&result.length<CHANNEL_CACHE_LIMIT;i++){item=value[i];if(!item||typeof item!=='object'||typeof item.id!=='string'||! /^[0-9a-f]{40}$/i.test(item.id))continue;id=item.id.toLowerCase();key='$'+id;if(seen[key])continue;name=cleanText(item.name,120).trim();if(!name)continue;seen[key]=true;status=typeof item.status==='number'&&isFinite(item.status)?item.status:cleanText(item.status,40);category=cleanText(item.category||item.group||'',60);result.push({id:id,name:name,status:status,category:category});}return result;}
function persistChannels(){try{localStorage.setItem(CHANNEL_CACHE_KEY,JSON.stringify(cachedItems));return true;}catch(e){return false;}}
try{var storedChannels=JSON.parse(localStorage.getItem(CHANNEL_CACHE_KEY)||'[]');cachedItems=normalizeChannels(favorites.concat(storedChannels));}catch(e){cachedItems=normalizeChannels(favorites);}
persistChannels();
function normalizeText(value){var text=String(value||'').toLowerCase();try{if(text.normalize)text=text.normalize('NFD').replace(/[\u0300-\u036f]/g,'');}catch(e){}return text;}
function matchesName(name,value){
  function words(text){return normalizeText(text).replace(/[._-]+/g,' ').replace(/\bmovistar\b/g,'m').replace(/\bla\s+liga\b/g,'laliga').replace(/\s+/g,' ').trim();}
  var queryText=words(value);if(!queryText)return true;var channelText=words(name);
  if(queryText.split(' ').indexOf('m')>=0&&!/^m(?:\s|$)/.test(channelText))return false;
  if(channelText.replace(/\s/g,'').indexOf(queryText.replace(/\s/g,''))>=0)return true;
  return queryText.split(' ').every(function(part){return channelText.indexOf(part)>=0;});
}
function categoryMatches(item){
  var category=normalizeText(item.category),name=normalizeText(item.name);
  if(sport)return /sport|deport/.test(category)||/dazn|liga|eurosport|sport/.test(name);
  if(genre==='football')return /football|soccer|futbol/.test(category)||/liga|futbol|football|soccer|champions|campeones/.test(name);
  if(genre==='movies')return /movie|film|cine/.test(category)||/cine|cinema|movie/.test(name);
  if(genre==='news')return /news|notici/.test(category)||/news|notici|24h|informacion/.test(name);
  return true;
}
function channelBrand(item,target){
  target.textContent='';var realLogo=window.ChannelLogos&&ChannelLogos.resolve(item&&item.name);if(realLogo){var image=node('img','','',target,'channel-logo');image.alt=item.name;image.src=realLogo;image.onerror=function(){target.textContent='';node('span','',item.name,target,'brand-mark brand-generic');};return;}node('span','',item?item.name:'AC TV',target,'brand-mark brand-generic');
}
function openCategory(value){homeMode=false;genre=value;sport=value==='sport';onlyFavorites=false;query='';page=0;index=0;lastSection='guide-live';$('guide-query').value='';load();}
function $(id) { return document.getElementById(id); }
function node(tag,id,text,parent,cls) {
  var n=document.createElement(tag); if(id)n.id=id; if(text)n.textContent=text;
  if(cls)n.className=cls; (parent||root).appendChild(n); return n;
}
function button(id,text,parent,fn) { var b=node('button',id,text,parent); b.type='button'; b.onclick=fn; return b; }
function saved(id) { return favorites.some(function(f){return f.id===id;}); }
function status(text) { if(root)$('guide-status').textContent=text; }
function cancelRequest() { request++; if(xhr)xhr.abort(); xhr=null; if(root)root.setAttribute('aria-busy','false'); }
function size(){var w=document.documentElement.clientWidth||1920,h=document.documentElement.clientHeight||1080;if(root){root.style.width='1920px';root.style.height='1080px';root.style.right='auto';root.style.bottom='auto';root.style.transformOrigin='0 0';root.style.transform='scale('+Math.min(w/1920,h/1080)+')';}AceTV.setViewport({left:0,top:0,width:w,height:h});}
function fullscreen(value) {
  full=value;
  if(!value){ clearTimeout(zapTimer); zapTimer=null; AceTV.stop(); current=null; }
  root.hidden=value; document.body.classList.toggle('guide-active',!value); size();
  if(!value)focusIndex(index);
}
function playerPhase(phase) {
  if(!root)return;
  if(phase==='idle'&&full)setTimeout(function(){
    if(active&&full&&AceTV.diagnostics().phase==='idle'){
      full=false; root.hidden=false; document.body.classList.add('guide-active'); if(!$('channel-loading')||$('channel-loading').hidden)focusIndex(index);
    }
  },0);
}
function heading(){
  var titles={football:'Fútbol',movies:'Cine',news:'Noticias'};
  $('guide-heading').textContent=homeMode?'Mis favoritos':onlyFavorites?'Mis favoritos':query?'Resultados para «'+query+'»':sport?'Deportes':titles[genre]||'En directo';
  $('guide-breadcrumb').textContent=homeMode?'TU TELEVISIÓN, A TU MANERA':query?'BÚSQUEDA':'TUS CANALES';
  $('guide-count').textContent=homeMode||onlyFavorites?items.length+' favoritos':'Página '+(page+1)+' · '+total+' canales';
  ['guide-home','guide-live','guide-favorites','guide-sport'].forEach(function(id){var on=id==='guide-home'?homeMode:id==='guide-favorites'?onlyFavorites:id==='guide-sport'?sport:!homeMode&&!onlyFavorites&&!sport;$(id).classList.toggle('enabled',on);$(id).setAttribute('aria-pressed',String(on));});
  $('guide-favorites').textContent='Mis favoritos';$('guide-prev').disabled=homeMode||page===0||onlyFavorites||!!xhr;$('guide-next').disabled=homeMode||onlyFavorites||!!xhr||(page+1)*50>=total;
  $('guide-page').hidden=homeMode||onlyFavorites;root.classList.toggle('home-view',homeMode);root.classList.toggle('browse-view',!homeMode);$('guide-categories').hidden=!homeMode;
}
function details(){
  var item=items[index],isSaved=!!(item&&saved(item.id)),football=!!(item&&/liga|futbol|dazn|campeon/i.test(item.name));
  $('guide-title').textContent=homeMode?(football?'Tu noche de fútbol':'Tu televisión, a tu manera'):item?item.name:onlyFavorites?'Tus favoritos empiezan aquí':'Encuentra tu próximo canal';
  $('guide-kicker').textContent='EN DIRECTO';channelBrand(item,$('guide-hero-brand'));$('guide-hero-brand').hidden=!item;
  $('guide-description').textContent=homeMode?'Tus canales favoritos, a un toque.':item?'Pulsa Ver canal para disfrutarlo a pantalla completa.':'Busca por nombre y guarda los canales que más te gustan.';
  $('guide-watch').disabled=!item;$('guide-star').disabled=!item;$('guide-star').textContent=isSaved?'★  Quitar de favoritos':'☆  Añadir a favoritos';$('guide-star').setAttribute('aria-pressed',String(isSaved));$('guide-watch').setAttribute('aria-label',item?'Ver '+item.name:'Ver canal');
}
function select(value) {
  if(!items.length)return;
  index=Math.max(0,Math.min(items.length-1,value));
  rows.forEach(function(row,i){row.classList.toggle('selected',i===index);row.setAttribute('aria-selected',String(i===index));});
  details();if($('guide-count'))$('guide-count').textContent=(index+1)+' / '+items.length+(homeMode||onlyFavorites?' favoritos':' canales de esta página');
}
function focusIndex(value){
  if(!items.length){$(onlyFavorites?'guide-empty-search':'guide-search').focus();return;}select(value);rows[index].focus();
  var list=$('guide-list'),row=rows[index];if(homeMode){var left=list.scrollLeft||0;if(row.offsetLeft<left)list.scrollLeft=row.offsetLeft;else if(row.offsetLeft+row.offsetWidth>left+list.clientWidth)list.scrollLeft=row.offsetLeft+row.offsetWidth-list.clientWidth;}
  else if(row.offsetTop<list.scrollTop)list.scrollTop=row.offsetTop;else if(row.offsetTop+row.offsetHeight>list.scrollTop+list.clientHeight)list.scrollTop=row.offsetTop+row.offsetHeight-list.clientHeight;
}
function candidates() {
  if(onlyFavorites||homeMode)return favorites.slice();
  var out=sourceItems.slice();
  if(!query&&page===0&&!sport&&!genre)favorites.forEach(function(f){if(!out.some(function(i){return i.id===f.id;}))out.unshift(f);});
  return out;
}
function render(keep,focusId) {
  var list=$('guide-list'); list.textContent=''; rows=[];
  items=FavoritesCore.order(candidates(),favorites);
  if(keep){var found=items.findIndex(function(i){return i.id===keep;});if(found>=0)index=found;}
  index=Math.max(0,Math.min(index,items.length-1));
  items.forEach(function(item,i){
    var b=button('', '',list,function(){select(i);play(false);});
    b.className='guide-channel'; b.setAttribute('role','option');
    b.setAttribute('aria-label',item.name+(saved(item.id)?', en favoritos':''));
    var art=node('span','','',b,'channel-art');channelBrand(item,art);node('span','',saved(item.id)?'★':'',b,'channel-favorite').setAttribute('aria-hidden','true');
    var text=node('span','','',b,'channel-text');node('strong','',item.name,text);node('small','','●  En directo',text);
    b.onfocus=function(){select(i);}; rows.push(b);
  });
  if(homeMode&&items.length)button('guide-add-favorite','＋  Buscar más canales',list,showSearch).className='guide-channel guide-add';
  $('guide-empty').hidden=items.length>0;
  $('guide-empty-title').textContent=onlyFavorites||homeMode?'Tu lista empieza aquí':'No encontramos ese canal';
  $('guide-empty-copy').textContent=onlyFavorites||homeMode?'Busca un canal, selecciónalo y pulsa Añadir a favoritos. Después lo tendrás aquí.':cachedItems.length?'Prueba con otro nombre o pulsa Actualizar catálogo para importar canales del motor Ace Stream.':'Busca canales guardados en la TV o pulsa Actualizar catálogo para importar el catálogo del motor Ace Stream.';
  heading(); details();
  if(focusId&&$(focusId)&&!$(focusId).disabled)$(focusId).focus();
  else if(items.length)focusIndex(index);
  else $(onlyFavorites?'guide-empty-search':'guide-search').focus();
}
function searchVisible(value) {
  $('guide-searchbox').hidden=!value; root.classList.toggle('search-open',value);
}
function showSearch() {
  clearTimeout(zapTimer);
  if(!$('guide-query').value)$('guide-query').value=query;
  searchVisible(true); $('guide-query').focus();
}
function submitSearch() {
  homeMode=false;genre='';query=$('guide-query').value.trim().slice(0,80); $('guide-query').value=query;
  page=0; onlyFavorites=false; sport=false; lastSection='guide-home';
  $('guide-query').blur(); searchVisible(false); $('guide-search').focus(); load();
}
function load(forceRemote, useEngine) {
  clearTimeout(zapTimer); cancelRequest();
  if(onlyFavorites){render(null,'guide-favorites');status(items.length?'Selecciona un favorito y pulsa OK para verlo.':'Añade tus primeros canales a Mis favoritos.');return;}
  var token=request,typing=!$('guide-searchbox').hidden?document.activeElement.id:null;
  if(!forceRemote){
    localResults=cachedItems.filter(function(item){var match=matchesName(item.name,query);return match&&categoryMatches(item);});
    total=localResults.length;sourceItems=localResults.slice(page*50,(page+1)*50);items=[];rows=[];$('guide-list').textContent='';$('guide-empty').hidden=true;
    heading();details();root.setAttribute('aria-busy','false');index=0;render(null,typing);
    status(items.length?'Canales guardados en la TV. Selecciona uno para verlo o añádelo a favoritos.':cachedItems.length?'No hay resultados guardados para esta búsqueda. Pulsa Actualizar catálogo para importar todos los canales.':'El catálogo está vacío. Pulsa Actualizar catálogo para descargar los canales desde Internet.');return;
  }
  var engine=useEngine?AceCore.engine($('engine').value):null;
  if(useEngine&&!engine){status('Configura la dirección del catálogo de respaldo en Ajustes.');$('guide-options').focus();return;}
  var groups=[],imported=[],groupCount=0,reportedTotal=null,pageNumber=0,pageSize=200,maxPages=20;
  items=[];rows=[];$('guide-list').textContent='';$('guide-empty').hidden=true;
  heading();details();root.setAttribute('aria-busy','true');status('Importando catálogo completo desde Ace Stream…');
  function restore(text){
    if(token!==request)return;
    xhr=null;root.setAttribute('aria-busy','false');page=0;localResults=cachedItems.filter(function(item){var match=matchesName(item.name,query);return match&&categoryMatches(item);});total=localResults.length;sourceItems=localResults.slice(0,50);index=0;render(null,typing);status(text+' Se conserva el catálogo guardado en la TV.');
  }
  function finish(){
    if(token!==request)return;
    xhr=null;var merged=imported.concat(cachedItems.filter(function(cached){return !imported.some(function(item){return item.id===cached.id;});}));
    var savedNames=favorites.map(function(favorite){var metadata=merged.find(function(item){return item.id===favorite.id;});return {id:favorite.id,name:favorite.name,status:favorite.status,category:metadata&&metadata.category||favorite.category||''};});
    var previousCache=cachedItems;cachedItems=normalizeChannels(savedNames.concat(merged));
    if(!persistChannels()){cachedItems=previousCache;restore('No se pudo guardar el catálogo. Comprueba el espacio disponible.');return;}
    localResults=cachedItems.filter(function(item){var match=matchesName(item.name,query);return match&&categoryMatches(item);});
    total=localResults.length;page=0;sourceItems=localResults.slice(0,50);index=0;root.setAttribute('aria-busy','false');render(null,typing);
    status('Catálogo actualizado: '+imported.length+' canales importados y guardados en la TV.');
  }
  function fetchPage(){
    if(token!==request)return;
    if(pageNumber>=maxPages){restore('El catálogo supera el límite de 4.000 canales y no se ha aplicado una importación incompleta.');return;}
    var x=new XMLHttpRequest();xhr=x;x.open('GET',useEngine?engine+'/search?page='+pageNumber+'&page_size='+pageSize:'https://search.acestream.net/?method=search&api_version=1&api_key=test_api_key&group_by_channels=1&page='+pageNumber+'&page_size='+pageSize);x.timeout=15000;
    x.onload=function(){
      if(token!==request)return;
      if(x.status!==200)return restore('No se ha podido importar el catálogo · HTTP '+x.status);
      var data;try{data=JSON.parse(x.responseText);}catch(e){return restore('El catálogo ha devuelto una respuesta no válida.');}
      if(!data.result&&Array.isArray(data.results))data={result:data};
      if(data.error||!data.result||!Array.isArray(data.result.results))return restore('El servicio no ha devuelto un catálogo válido.');
      var result=data.result,normalized=CatalogCore.normalizeAll(data),incoming=normalized.items,i,found,overflow=false,groupRows=result.results;
      if(typeof result.total==='number'&&isFinite(result.total)&&result.total>=0)reportedTotal=result.total;
      for(i=0;i<incoming.length;i++){
        found=imported.find(function(item){return item.id===incoming[i].id;});
        if(found){if(!found.category&&incoming[i].category)found.category=incoming[i].category;}
        else if(imported.length<4000)imported.push(incoming[i]);
        else overflow=true;
      }
      if(overflow){restore('El catálogo supera el límite de 4.000 canales y no se ha aplicado una importación incompleta.');return;}
      groups=groupRows;groupCount+=groups.length;pageNumber++;xhr=null;
      status('Importando catálogo… '+imported.length+' canales · '+groupCount+(reportedTotal===null?'':' / '+reportedTotal)+' grupos');
      if(!groups.length||groups.length<pageSize||(reportedTotal!==null&&groupCount>=reportedTotal)){finish();return;}
      if(imported.length>=4000){restore('El catálogo supera el límite de 4.000 canales y no se ha aplicado una importación incompleta.');return;}
      fetchPage();
    };
    x.onerror=function(){restore('No se puede actualizar el catálogo. Comprueba Internet e inténtalo de nuevo.');};
    x.ontimeout=function(){restore('El catálogo no ha respondido a tiempo.');};
    x.onabort=function(){};x.send();
  }
  fetchPage();
}
function section(name){searchVisible(false);$('guide-query').blur();query='';genre='';$('guide-query').value='';page=0;index=0;homeMode=name==='guide-home';onlyFavorites=name==='guide-favorites';sport=name==='guide-sport';lastSection=name;$(name).focus();load();}
function toggleFavorite(override) {
  var item=override&&typeof override.id==='string'?override:items[index];if(!item)return;
  var had=saved(item.id), next=FavoritesCore.toggle(favorites,item);
  if(!had&&next.length===favorites.length){status('Puedes guardar hasta 100 canales. Quita alguno antes de añadir otro.');if(full&&AceTV.notify)AceTV.notify('Tu lista de favoritos está llena. Quita un canal para añadir otro.');return;}
  try{localStorage.setItem('ace-tv.favorites',JSON.stringify(next));}
  catch(e){status('No se han podido guardar los favoritos. Inténtalo otra vez.');if(full&&AceTV.notify)AceTV.notify('No se han podido guardar los favoritos. Inténtalo otra vez.');return;}
  favorites=next;
  var focus=document.activeElement&&document.activeElement.id;
  render(item.id,focus==='guide-star'?'guide-star':null);
  var message=had?'Quitado de Mis favoritos: '+item.name:'Añadido a Mis favoritos: '+item.name;status(message);if(full&&AceTV.notify)AceTV.notify(message);
  if(!items.length)$('guide-empty-search').focus();
}
function play(force) {
  var item=items[index];if(!item)return;
  var phase=AceTV.diagnostics().phase;
  if(!force&&current&&current.id===item.id&&(phase==='playing'||phase==='paused')){fullscreen(true);return;}
  current={id:item.id,name:item.name};fullscreen(true);$('source').value='infohash:'+item.id;AceTV.play();
}
function zap(delta) {
  if(!items.length)return;
  var at=zapTimer?index:current?items.findIndex(function(i){return i.id===current.id;}):index;
  select(Math.max(0,Math.min(items.length-1,at+delta)));clearTimeout(zapTimer);
  zapTimer=setTimeout(function(){zapTimer=null;if(active)play(true);},280);
}
function options() {
  active=false;cancelRequest();clearTimeout(zapTimer);full=false;
  AceTV.stop('Configuración de la conexión y apertura manual de enlaces.');root.hidden=true;
  document.body.classList.remove('guide-active');size();$('source').focus();
}
function sidebar(){return ['guide-home','guide-live','guide-sport','guide-favorites','guide-search','guide-reload','guide-options'];}
function focusAction(id) { if(!$(id).disabled)$(id).focus();else focusIndex(index); }
function keys(e){
  var k=e.keyCode,focused=document.activeElement,id=focused&&focused.id;
  if(!active){if((k===10009||k===27)&&AceTV.diagnostics().phase==='idle'){e.preventDefault();e.stopImmediatePropagation();open();}return;}
  if(full){if(k===405&&current){e.preventDefault();e.stopImmediatePropagation();toggleFavorite(current);}else if(k===10009||k===27){e.preventDefault();e.stopImmediatePropagation();fullscreen(false);}else if(k===427||k===428||k===38||k===40){e.preventDefault();e.stopImmediatePropagation();zap(k===427||k===40?1:-1);}return;}
  e.stopImmediatePropagation();if(id==='guide-query'){if(k===13||k===65376){e.preventDefault();submitSearch();}else if(k===10009||k===27||k===65385){e.preventDefault();searchVisible(false);$('guide-search').focus();}return;}
  if([13,27,37,38,39,40,10009,405,427,428].indexOf(k)<0)return;e.preventDefault();
  if(k===405){toggleFavorite();return;}if(k===427||k===428){zap(k===427?1:-1);return;}
  var nav=sidebar(),at=nav.indexOf(id),categoryIds=['category-football','category-sport','category-movies','category-news'],cat=categoryIds.indexOf(id);
  if(k===10009||k===27){if(!$('guide-searchbox').hidden){searchVisible(false);$('guide-search').focus();}else if(at<0)$(lastSection).focus();else if(!homeMode)section('guide-home');else if(window.tizen)tizen.application.getCurrentApplication().exit();return;}
  if(k===13){if(focused&&!focused.disabled)focused.click();return;}
  if(at>=0){if(k===37)$(nav[Math.max(0,at-1)]).focus();if(k===39)$(nav[Math.min(nav.length-1,at+1)]).focus();if(k===40){if(!$('guide-searchbox').hidden)$('guide-query').focus();else if(items.length)focusAction('guide-watch');else $('guide-empty-search').focus();}return;}
  var row=rows.indexOf(focused),cols=homeMode?Math.max(1,rows.length):5;
  if(row>=0){if(k===37&&row>0)focusIndex(row-1);if(k===39){if(row+1<items.length)focusIndex(row+1);else if(homeMode&&$('guide-add-favorite'))$('guide-add-favorite').focus();}
    if(k===38){if(row<cols)focusAction('guide-watch');else focusIndex(row-cols);}if(k===40){if(homeMode)$(categoryIds[Math.min(row,3)]).focus();else if(row+cols<items.length)focusIndex(row+cols);else if(!$('guide-next').disabled)$('guide-next').focus();else if(!$('guide-prev').disabled)$('guide-prev').focus();}return;}
  if(cat>=0){if(k===37)$(categoryIds[Math.max(0,cat-1)]).focus();if(k===39)$(categoryIds[Math.min(3,cat+1)]).focus();if(k===38){if(items.length)focusIndex(Math.min(cat,items.length-1));else $('guide-empty-search').focus();}return;}
  if(id==='guide-add-favorite'){if(k===37)focusIndex(items.length-1);if(k===38)focusAction('guide-star');if(k===40)$('category-news').focus();return;}
  if(id==='guide-watch'||id==='guide-star'){if(k===37)focusAction('guide-watch');if(k===39)focusAction('guide-star');if(k===38)$(lastSection).focus();if(k===40)focusIndex(index);return;}
  if(id==='guide-search-submit'){if(k===37)$('guide-query').focus();if(k===38)$('guide-search').focus();if(k===40)focusIndex(index);return;}
  if(id==='guide-prev'||id==='guide-next'){if(k===38)focusIndex(index);if(k===37&&!$('guide-prev').disabled)$('guide-prev').focus();if(k===39&&!$('guide-next').disabled)$('guide-next').focus();return;}
  if(id==='guide-empty-search'){if(k===38)$(lastSection).focus();if(k===40&&homeMode)$('category-football').focus();}
}
function open() {
  if(!root)build();if(AceTV.diagnostics().phase!=='idle')AceTV.stop();
  active=true;full=false;root.hidden=false;document.body.classList.add('guide-active');size();
  if(!sourceItems.length&&!onlyFavorites)load();else render();
}
function build(){
  root=node('section','tvguide','',document.body);root.setAttribute('aria-label','Canales de AC TV');
  node('div','guide-backdrop','',root);var header=node('header','','',root,'guide-header');
  var brand=node('div','','',header,'guide-brand');node('span','','▶',brand,'brand-play');node('strong','','AC TV',brand);
  var nav=node('nav','','',header,'guide-nav');nav.setAttribute('aria-label','Secciones');button('guide-home','Inicio',nav,function(){section('guide-home')});button('guide-live','En directo',nav,function(){section('guide-live')});button('guide-sport','Deportes',nav,function(){section('guide-sport')});button('guide-favorites','Mis favoritos',nav,function(){section('guide-favorites')});
  var tools=node('div','','',header,'guide-tools');button('guide-search','⌕  Buscar',tools,function(){if($('guide-searchbox').hidden)showSearch();else submitSearch()});button('guide-reload','↻',tools,function(){load(true)}).setAttribute('aria-label','Actualizar catálogo');button('guide-options','⚙',tools,options).setAttribute('aria-label','Ajustes');node('span','guide-clock','',tools);
  function clock(){var d=new Date();$('guide-clock').textContent=('0'+d.getHours()).slice(-2)+':'+('0'+d.getMinutes()).slice(-2)}clock();if(typeof setInterval==='function')setInterval(clock,30000);
  var content=node('main','','',root,'guide-content');var hero=node('section','','',content,'guide-hero');var meta=node('div','','',hero,'guide-hero-meta');node('p','guide-kicker','EN DIRECTO',meta);node('div','guide-hero-brand','',meta);node('h1','guide-title','',hero);node('p','guide-description','',hero);
  var actions=node('div','','',hero,'guide-actions');button('guide-watch','▶  Ver canal',actions,function(){play(false)});button('guide-star','☆  Añadir a favoritos',actions,toggleFavorite);
  var searchbox=node('div','guide-searchbox','',content);searchbox.hidden=true;var input=node('input','guide-query','',searchbox);input.type='search';input.maxLength=80;input.placeholder='¿Qué canal quieres ver?';input.setAttribute('aria-label','Nombre del canal');button('guide-search-submit','Buscar',searchbox,submitSearch);
  var library=node('section','','',content,'guide-library');var line=node('div','','',library,'guide-section-top');node('h2','guide-heading','Mis favoritos',line);node('span','guide-breadcrumb','',line);node('span','guide-count','',line);
  var empty=node('div','guide-empty','',library);empty.hidden=true;node('h3','guide-empty-title','',empty);node('p','guide-empty-copy','',empty);button('guide-empty-search','Buscar canales',empty,showSearch);
  var list=node('div','guide-list','',library);list.setAttribute('role','listbox');list.setAttribute('aria-label','Canales');
  var categories=node('section','guide-categories','',content);node('h2','','Explora tus canales',categories);var tiles=node('div','','',categories,'category-list');[['football','Fútbol'],['sport','Deportes'],['movies','Cine'],['news','Noticias']].forEach(function(c){button('category-'+c[0],c[1],tiles,function(){openCategory(c[0])}).className='category-card category-'+c[0]});
  var pages=node('div','guide-page','',content,'guide-page');button('guide-prev','←  Anterior',pages,function(){if(page>0){page--;load()}});button('guide-next','Siguiente  →',pages,function(){if((page+1)*50<total){page++;load()}});
  var footer=node('footer','','',root,'guide-footer');node('p','guide-status','Preparando canales…',footer).setAttribute('role','status');node('span','','Flechas · Explorar    OK · Ver    Amarillo · Favorito    CH+/− · Canal    Atrás · Volver',footer,'guide-help');document.addEventListener('keydown',keys,true);
}
if($('import-pc'))$('import-pc').onclick=function(){open();load(true,true)};
$('explore').onclick=open;$('backguide').onclick=open;
document.addEventListener('visibilitychange',function(){if(document.hidden){clearTimeout(zapTimer);cancelRequest();}else if(active){fullscreen(false);if(!items.length)load();}});
window.AceGuide={preparePlayback:function(){if(active&&current)fullscreen(true);},currentName:function(){return current?current.name:"Tu canal";},open:open,status:status,onPlayer:playerPhase,isPreview:function(){return false;}};
window.AceCatalog={open:open,close:options,search:function(text){open();$('guide-query').value=String(text).slice(0,80);submitSearch();},diagnostics:function(){return {open:active,fullscreen:full,loading:!!xhr,page:page,items:items.length,cachedChannels:cachedItems.length,favorites:favorites.length,index:index,current:!!current,section:homeMode?'home':onlyFavorites?'favorites':sport?'sport':query?'search':genre||'live'};}};
open();
}());
