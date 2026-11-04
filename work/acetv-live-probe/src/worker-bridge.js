if(typeof importScripts==='function'){
  var playbackAhead=0;
  Module.onCustomMessage=function(e){var d=e.data.userData;if(d&&d.start){Module.requestedConfig=d.start;if(Module.acceptConfig){Module.acceptConfig(d.start);Module.acceptConfig=null;}}if(d&&d.stop&&Module.cancelWire)Module.cancelWire();if(d&&typeof d.bufferedAhead==='number')playbackAhead=d.bufferedAhead};
  Module.startWire=async function(){
    var peer=null,ptr=0,pending=new Uint8Array(0),connected=false,done=false,lastProgress=Date.now(),start=Date.now(),sent=0,received=0;
    var mediaParts=[],mediaLength=0,mediaTotal=0,cfg=null,lastVerified=Date.now(),verifiedCount=0;
    var nativeMode=false,streamUrl=null,streamAnnounced=false,streamPending=new Uint8Array(0);
    function report(d){postMessage({target:'custom',userData:d})}
    function drainStream(){
      while(streamPending.length){var part=streamPending.subarray(0,65536);Module.HEAPU8.set(part,ptr);var n=Module._stream_enqueue(ptr,part.length);if(n<0)throw Error('Local stream enqueue failed '+n);if(!n)return false;streamPending=streamPending.subarray(n);}
      if(!streamAnnounced&&mediaTotal){streamAnnounced=true;report({type:'local-stream',url:streamUrl});}
      return true;
    }
    function flushMedia(){if(!mediaLength)return;var bytes=new Uint8Array(mediaLength),at=0;mediaParts.forEach(function(p){bytes.set(p,at);at+=p.length});mediaParts=[];mediaLength=0;postMessage({target:'custom',userData:{type:'media',bytes:bytes.buffer,verifiedPieces:JSON.parse(peer.status_json()).verified_pieces}},[bytes.buffer])}
    function finish(error){if(done)return;done=true;Module.peerTick=null;Module._net_close();
      if(nativeMode){if(error)Module._stream_close();else Module._stream_end();}else if(!error)flushMedia();
      if(ptr)Module._free(ptr);
      report({type:'result',ok:!error,error:error||null,peer:peer?JSON.parse(peer.status_json()):null,sentBytes:sent,receivedBytes:received,elapsedMs:Date.now()-start});if(peer)peer.free();
    }
    Module.cancelWire=function(){if(done){if(nativeMode)Module._stream_close();}else finish('Playback stopped')};
    try{
      if(typeof document!=='undefined'&&typeof document.currentScript==='undefined')document.currentScript=null;
      importScripts('core/ace_wire.js');var r=await fetch('core/ace_wire_bg.wasm');if(!r.ok)throw Error('Bundled WASM unavailable');await wasm_bindgen({module_or_path:await r.arrayBuffer()});
      cfg=await(await fetch('fixture-config.json')).json();
      if(cfg.externalControl)cfg=Module.requestedConfig||await new Promise(function(resolve){Module.acceptConfig=resolve});
      if(done)return;
      nativeMode=cfg.nativePlayback===true;report({type:'playback-mode',mode:nativeMode?'native':'mse'});
      if(nativeMode){var nonce=new Uint8Array(16);self.crypto.getRandomValues(nonce);var token=Array.from(nonce).map(function(v){return ('0'+v.toString(16)).slice(-2)}).join('');var port=Module.ccall('stream_open','number',['string'],[token]);if(port<=0)throw Error('Local stream listener failed '+port);streamUrl='http://127.0.0.1:'+port+'/'+token+'.ts';}
      var descriptor,candidates=null,activeAddress=null,reportedPeer=false,preferredCandidate=false,seed=new Uint8Array(32);self.crypto.getRandomValues(seed);
      if(cfg.contentId){importScripts('discovery.js');var resolved=await AceDiscovery.resolve(cfg.contentId,cfg.identifierKind,seed);descriptor=resolved.descriptor;candidates=resolved.peers;}
      else descriptor=Uint8Array.from(atob(cfg.descriptorBase64),function(c){return c.charCodeAt(0)});
      if(candidates){
        var hint=cfg.preferredPeer;if(hint&&typeof hint.host==='string'&&AceDiscovery.isPublicIPv4(hint.host)&&Number.isInteger(hint.port)&&hint.port>0&&hint.port<65536){candidates=candidates.filter(function(p){return p.host!==hint.host||p.port!==hint.port});candidates.unshift({host:hint.host,port:hint.port});preferredCandidate=true;}
        importScripts('peer-selector.js');
        candidates=await AcePeerSelector.select(descriptor,candidates,function(p){report({type:'peer-selection',stage:p.stage,count:p.count,head:p.head,attempted:p.attempted,total:p.total})},{maxUsable:preferredCandidate?1:2,budgetMs:20000,isCancelled:function(){return done}});
        if(!candidates.length)throw Error('No peer completed a valid live handshake');
      }
      if(done)return;
      peer=new wasm_bindgen.LivePeer(descriptor,seed);ptr=Module._malloc(65536);if(!ptr)throw Error('No network buffer');
      if(candidates){
        report({type:'progress',stage:'connecting-to-peer',candidates:candidates.length});
        for(var candidate=0;candidate<Math.min(candidates.length,8);candidate++){
          try{
            var address=candidates[candidate];var code=Module.ccall('net_connect','number',['string','number'],[address.host,address.port]);
            if(code<0)throw Error('Peer connection refused');
            if(code!==1)await new Promise(function(resolve,reject){var began=Date.now();Module.peerTick=function(){var ready=Module._net_ready();if(ready===1){Module.peerTick=null;resolve()}else if(ready<0||Date.now()-began>4000){Module.peerTick=null;reject(Error('Peer unavailable'))}}});
            connected=true;activeAddress=address;break;
          }catch(e){Module._net_close();}
        }
        if(!connected)throw Error('No reachable peer in tracker results');
      } else {
        var rc=Module.ccall('net_connect','number',['string','number'],[cfg.host,cfg.port]);if(rc<0)throw Error('connect errno '+(-rc));connected=rc===1;
      }
      lastProgress=Date.now();lastVerified=Date.now();report({type:'progress',stage:'connecting'});
      Module.peerTick=function(){try{
        if(done)return;if(cfg.expectedPieces&&Date.now()-start>150000)throw Error('Fixture test exceeded 150 seconds');
        if(nativeMode&&(!drainStream()||Module._stream_buffered()>6*1024*1024)){lastProgress=lastVerified=Date.now();return;}
        if(Date.now()-lastProgress>20000&&playbackAhead<12)throw Error('Peer made no progress for 20 seconds');
        if(Date.now()-lastVerified>30000&&playbackAhead<12)throw Error('No authenticated media piece completed for 30 seconds');
        if(playbackAhead>12){lastProgress=Date.now();return;}
        if(!connected){var ready=Module._net_ready();if(ready<0)throw Error('connect errno '+(-ready));if(!ready)return;connected=true;}
        if(!pending.length)pending=peer.take_outgoing();
        if(pending.length){var b=pending.subarray(0,65536);Module.HEAPU8.set(b,ptr);var n=Module._net_write(ptr,b.length);if(n<0)throw Error('send errno '+(-n));pending=pending.subarray(n);sent+=n;}
        for(var i=0;i<4;i++){
          var n=Module._net_read(ptr,65536);if(n<0)throw Error('receive errno '+(-n));if(!n)break;lastProgress=Date.now();received+=n;
          peer.feed(Module.HEAPU8.slice(ptr,ptr+n));
          var media=peer.take_media();if(media.length){mediaTotal+=media.length;if(nativeMode){streamPending=media;drainStream();}else{mediaParts.push(media);mediaLength+=media.length;if(mediaLength>=188000)flushMedia();}}
          var state=JSON.parse(peer.status_json());if(state.verified_pieces>verifiedCount){verifiedCount=state.verified_pieces;lastVerified=Date.now();}
          if(state.verified_pieces>0&&activeAddress&&!reportedPeer){reportedPeer=true;report({type:'peer-verified',peer:{host:activeAddress.host,port:activeAddress.port}});}
          if(nativeMode&&media.length)report({type:'media-progress',bytes:mediaTotal,verifiedPieces:verifiedCount,localBuffered:Module._stream_buffered()});
          if(cfg.expectedPieces&&state.verified_pieces>=cfg.expectedPieces){if(mediaTotal!==cfg.expectedMediaBytes)throw Error('Fixture media length mismatch');if(streamPending.length)throw Error('Fixture pending local media at completion');finish();return;}
          if(nativeMode&&streamPending.length)break;
        }
      }catch(e){finish(String(e.stack||e))}};
    }catch(e){finish(String(e.stack||e))}
  };
}
