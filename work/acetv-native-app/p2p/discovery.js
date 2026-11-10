/* Caller-driven discovery. Every socket and protocol operation runs in the TV Worker. */
(function(){
  function progress(stage){postMessage({target:'custom',userData:{type:'progress',stage:stage}})}
  function random32(){var a=new Uint32Array(1);crypto.getRandomValues(a);return a[0]}
  function publicIPv4(host){var n=host.split('.').map(Number);return /^\d+\.\d+\.\d+\.\d+$/.test(host)&&n.every(function(v){return v>=0&&v<=255})&&n[0]>0&&n[0]<224&&n[0]!==10&&n[0]!==127&&!(n[0]===169&&n[1]===254)&&!(n[0]===172&&n[1]>=16&&n[1]<=31)&&!(n[0]===192&&n[1]===168)}
  async function address(host){
    if(publicIPv4(host))return host;
    if(/^\d+\.\d+\.\d+\.\d+$/.test(host))throw Error('Non-public tracker address');
    var abort=new AbortController(),timer=setTimeout(function(){abort.abort()},5000);
    try{var r=await fetch('https://dns.google/resolve?type=A&name='+encodeURIComponent(host),{signal:abort.signal,credentials:'omit'});if(!r.ok)throw Error('DNS HTTP status');
      var result=await r.json(),answers=(result.Answer||[]).filter(function(a){return a.type===1&&publicIPv4(a.data)});if(!answers.length)throw Error('No public IPv4 tracker address');return answers[0].data;
    }finally{clearTimeout(timer)}
  }
  function open(host,port,udp){
    var ptr=Module._malloc(65536),closed=false,connected=false;
    if(!ptr)throw Error('No discovery socket buffer');
    var rc=Module.ccall(udp?'net_connect_udp':'net_connect','number',['string','number'],[host,port]);
    function close(){if(closed)return;closed=true;Module.peerTick=null;Module._net_close();Module._free(ptr)}
    if(rc<0){close();throw Error('Discovery connect failed')};connected=rc===1;
    return {close:close,request:function(request){return new Promise(function(resolve,reject){
      var start=Date.now(),sent=0,parts=[],size=0;
      function done(error){Module.peerTick=null;if(error){close();reject(error);return;}var bytes=new Uint8Array(size),at=0;parts.forEach(function(p){bytes.set(p,at);at+=p.length});resolve(bytes)}
      Module.peerTick=function(){try{
        if(Date.now()-start>5000)throw Error('Discovery request timeout');
        if(!connected){var ready=Module._net_ready();if(ready<0)throw Error('Discovery connection refused');if(!ready)return;connected=true;}
        if(sent<request.length){var chunk=request.subarray(sent,sent+65536);Module.HEAPU8.set(chunk,ptr);var n=Module._net_write(ptr,chunk.length);if(n<0)throw Error('Discovery send failed');if(udp&&n!==chunk.length)throw Error('Partial UDP datagram');sent+=n;return;}
        for(var i=0;i<4;i++){var n=Module._net_read(ptr,65536);if(!n)return;
          if(n<0){if(!udp&&n===-4096&&size){done();return;}throw Error('Discovery receive failed ('+n+')');}
          if(size+n>1024*1024+16384)throw Error('Discovery response too large');parts.push(Module.HEAPU8.slice(ptr,ptr+n));size+=n;
          if(udp){done();return;}
        }
      }catch(e){done(e)}};
    })}};
  }
  self.AceDiscovery={isPublicIPv4:publicIPv4,resolve:async function(contentId,identifierKind,identitySeed){
    if(!/^[0-9a-fA-F]{40}$/.test(contentId))throw Error('Invalid content link');
    var descriptor=null,hosts=['5.252.161.191','64.227.119.64'];
    progress('resolving-content');
    for(var i=0;i<hosts.length;i++){
      var socket=null;try{var nonce=String(random32()+1);socket=open(hosts[i],8081,false);
        var infohashMode=identifierKind==='infohash';
        var request=infohashMode?wasm_bindgen.catalog_request_infohash(contentId,nonce,hosts[i]):wasm_bindgen.catalog_request(contentId,nonce,hosts[i]);
        var response=await socket.request(request);descriptor=infohashMode?wasm_bindgen.catalog_response_infohash(response,nonce,contentId):wasm_bindgen.catalog_response(response,nonce);break;
      }catch(e){postMessage({target:'custom',userData:{type:'discovery-diagnostic',stage:'catalog',reason:String(e.message||e).slice(0,160)}});}finally{if(socket)socket.close()}
    }
    if(!descriptor)throw Error('No authenticated descriptor returned by the content catalog');
    postMessage({target:'custom',userData:{type:'milestone',stage:'descriptor-ready'}});
    var info=JSON.parse(wasm_bindgen.descriptor_info_json(descriptor));if(!info.is_live)throw Error('This receiver supports live streams');
    var infohash=Uint8Array.from(info.infohash.match(/../g),function(h){return parseInt(h,16)}),peerid=new Uint8Array(20);
    var seed=identitySeed;if(!(seed instanceof Uint8Array)||seed.length!==32){seed=new Uint8Array(32);crypto.getRandomValues(seed);}
    var prefix='R30------',alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for(var p=0;p<9;p++)peerid[p]=prefix.charCodeAt(p);for(var p=9;p<20;p++)peerid[p]=alphabet.charCodeAt(seed[p-9]%alphabet.length);
    var peers=[],peerGroups=[];progress('finding-peers');
    var trackers=[];info.trackers.forEach(function(entry){String(entry).trim().split(/\s+/).forEach(function(url){if(url&&trackers.indexOf(url)<0)trackers.push(url)})});
    progress('tracker-candidates-'+trackers.length);
    for(var i=0;i<Math.min(trackers.length,4);i++){
      var socket=null;try{
        // The SDK proxy supplies a minimal URL shim in Workers. Parse the narrow
        // supported UDP authority explicitly instead of relying on that shim.
        var parsed=/^udp:\/\/([^\/:?#\s]+):(\d+)(?:[\/?#].*)?$/.exec(trackers[i]);if(!parsed)continue;
        var port=Number(parsed[2]);if(!port||port>65535)continue;
        var ip=await address(parsed[1]);socket=open(ip,port,true);
        var tx=random32(),reply=await socket.request(wasm_bindgen.tracker_connect_request(tx)),cid=wasm_bindgen.tracker_connection_id(reply,tx);
        tx=random32();var announce=wasm_bindgen.tracker_announce_request(cid,infohash,peerid,tx,8621);
        var result=JSON.parse(wasm_bindgen.tracker_peers_json(await socket.request(announce),tx));
        var group=[];result.peers.forEach(function(p){var pair=p.split(':'),port=Number(pair[1]);if(publicIPv4(pair[0])&&port>0&&port<=65535&&!group.some(function(x){return x.host===pair[0]&&x.port===port})&&group.length<64)group.push({host:pair[0],port:port})});
        peerGroups.push(group);postMessage({target:'custom',userData:{type:'discovery-diagnostic',stage:'tracker-result',peerCount:group.length}});
      }catch(e){postMessage({target:'custom',userData:{type:'discovery-diagnostic',stage:'tracker',reason:String(e.message||e).slice(0,160)}});}finally{if(socket)socket.close()}
    }
    // Alternate trackers so a large stale result from the first one cannot hide
    // all of the second tracker's candidates behind the connection-probe budget.
    for(var index=0;index<64&&peers.length<32;index++){for(var g=0;g<peerGroups.length&&peers.length<32;g++){var next=peerGroups[g][index];if(next&&!peers.some(function(p){return p.host===next.host&&p.port===next.port}))peers.push(next);}}
    if(!peers.length)throw Error('No peers found through supported UDP trackers; DHT and HTTP trackers remain pending');
    postMessage({target:'custom',userData:{type:'milestone',stage:'peers-ready'}});
    return {descriptor:descriptor,peers:peers};
  }};
})();
