(function(){'use strict';
  var frame=null,generation=0,pendingReject=null,deadline=null,last={state:'idle'},bridgeKey=null,receiver=null;
  var peerCache={},activeCacheKey=null;
  function remember(key,peer){if(!peer||typeof peer.host!=='string'||!/^\d{1,3}(\.\d{1,3}){3}$/.test(peer.host)||!Number.isInteger(peer.port)||peer.port<1||peer.port>65535)return;peerCache[key]={host:peer.host,port:peer.port,verifiedAt:Date.now()};var keys=Object.keys(peerCache).sort(function(a,b){return peerCache[a].verifiedAt-peerCache[b].verifiedAt});while(keys.length>8)delete peerCache[keys.shift()];}
  function stop(){generation++;clearTimeout(deadline);if(receiver){window.removeEventListener('message',receiver);receiver=null}if(pendingReject){pendingReject(Error('Reproducción cancelada'));pendingReject=null}if(frame){var old=frame;frame=null;try{old.contentWindow.postMessage({aceNativeControl:true,key:bridgeKey,stop:true},'*')}catch(_){}setTimeout(function(){old.remove()},150)}bridgeKey=null;activeCacheKey=null;last={state:'idle'}}
  function start(config,onProgress,onError){
    stop();
    if(!config||!/^[a-f0-9]{40}$/i.test(config.contentId))return Promise.reject(Error('Enlace no válido'));
    var token=generation,keyBytes=new Uint8Array(16);crypto.getRandomValues(keyBytes);bridgeKey=Array.from(keyBytes).map(function(n){return ('0'+n.toString(16)).slice(-2)}).join('');
    var cacheKey=String(config.identifierKind)+':'+config.contentId,preferred=peerCache[cacheKey];if(preferred&&Date.now()-preferred.verifiedAt>120000){delete peerCache[cacheKey];preferred=null;}
    activeCacheKey=cacheKey;var startedAt=Date.now();last={state:'connecting',verifiedPieces:0,receivedMediaBytes:0,peerCacheHit:!!preferred,milestones:{}};
    return new Promise(function(resolve,reject){
      pendingReject=reject;var settled=false,currentKey=bridgeKey;
      function failure(message){if(token!==generation)return;delete peerCache[cacheKey];last.state='error';last.error=String(message);clearTimeout(deadline);if(!settled){settled=true;pendingReject=null;reject(Error(last.error))}else if(onError)onError(last.error)}
      var child=document.createElement('iframe');frame=child;child.hidden=true;child.setAttribute('aria-hidden','true');child.src='p2p/transport.html';
      child.onload=function(){if(token!==generation)return;child.contentWindow.postMessage({aceNativeControl:true,key:currentKey,start:{contentId:config.contentId,identifierKind:config.identifierKind,nativePlayback:true,preferredPeer:preferred?{host:preferred.host,port:preferred.port}:null}},'*')};
      function receive(event){
        if(token!==generation){window.removeEventListener('message',receive);return}
        if(event.source!==child.contentWindow)return;
        var d=event.data;if(!d||d.aceNativeEvent!==true||d.key!==currentKey||!d.payload)return;d=d.payload;
        last.stage=d.stage||d.type;last.eventAt=Date.now();if(typeof d.count==='number')last.candidates=d.count;
        // Record milestone names and elapsed time without peer addresses.
        var milestone=d.type==='milestone'?d.stage:(d.type==='peer-selection'&&d.stage==='verified'?'peer-authenticated':(d.type==='progress'&&/^(resolving-content|finding-peers|connecting-to-peer|connecting)$/.test(d.stage)?d.stage:null));
        if(milestone&&last.milestones[milestone]===undefined&&/^(descriptor-ready|peers-ready|peer-connected|first-media|peer-authenticated|resolving-content|finding-peers|connecting-to-peer|connecting)$/.test(milestone))last.milestones[milestone]=Date.now()-startedAt;
        if(d.type==='local-stream')last.milestones['local-stream-ready']=Date.now()-startedAt;
        if(d.type==='peer-verified'){remember(cacheKey,d.peer);}
        else if(d.type==='local-stream'){
          if(!/^http:\/\/127\.0\.0\.1:([0-9]{1,5})\/[a-f0-9]{32}\.ts$/.test(d.url))return failure('Dirección local no válida');
          clearTimeout(deadline);last.state='streaming';if(!settled){settled=true;pendingReject=null;resolve(d.url)}
        }else if(d.type==='media-progress'){last.verifiedPieces=d.verifiedPieces;last.receivedMediaBytes=d.bytes;last.localBuffered=d.localBuffered}
        else if(d.type==='result'&&!d.ok)failure('El emisor dejó de responder. Vuelve a abrir el canal.');
        else if(d.type==='transport-error')failure('No se pudo iniciar el motor de la TV.');
        else if(onProgress)onProgress(d);
      }
      receiver=receive;window.addEventListener('message',receive);deadline=setTimeout(function(){failure('No se encontró un emisor disponible para este enlace.')},150000);document.body.appendChild(child);
    });
  }
  window.NativeP2PTransport={start:start,stop:stop,invalidate:function(){if(activeCacheKey)delete peerCache[activeCacheKey]},diagnostics:function(){return Object.assign({},last)}};
})();
