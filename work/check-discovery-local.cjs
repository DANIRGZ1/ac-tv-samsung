const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),crypto=require('crypto');
globalThis.self=globalThis;
vm.runInThisContext(fs.readFileSync('work/acetv-wire-probe/app/core/ace_wire.js','utf8'));
(async()=>{
 await wasm_bindgen({module_or_path:fs.readFileSync('work/acetv-wire-probe/app/core/ace_wire_bg.wasm')});
 const wasm=wasm_bindgen,heap=new Uint8Array(65536),writes=[];let udp=false,responses=[],delivered=false,connects=0,announces=0,frees=0,closes=0;
 const module={HEAPU8:heap,_malloc:()=>1,_free:()=>{frees++},_net_close:()=>{closes++},_net_ready:()=>1,
  ccall(name,type,types,args){udp=name==='net_connect_udp';delivered=false;responses=[];connects++;return 1},
  _net_write(ptr,len){const data=Buffer.from(heap.slice(ptr,ptr+len));writes.push(data);
   if(!udp)responses.push(Buffer.from('catalog-test-response'));
   else if(data.readUInt32BE(8)===0){assert.equal(data.length,16);const r=Buffer.alloc(16);r.writeUInt32BE(data.readUInt32BE(12),4);r.fill(7,8);responses.push(r)}
   else {assert.equal(data.length,98);assert.equal(data.readUInt32BE(8),1);assert.equal(data.readUInt32BE(80),2);announces++;const r=Buffer.alloc(26);r.writeUInt32BE(1,0);r.writeUInt32BE(data.readUInt32BE(12),4);r.writeUInt32BE(30,8);r.set([198,51,100,22,33,173],20);responses.push(r)}return len},
  _net_read(ptr,len){if(responses.length){const r=responses.shift();heap.set(r,ptr);delivered=true;return r.length}return !udp&&delivered?-104:0}
 };
 const events=[];const context={Module:module,crypto:crypto.webcrypto,Uint8Array,Uint32Array,URL,AbortController,setTimeout,clearTimeout,postMessage:m=>events.push(m),fetch:async()=>({ok:true,json:async()=>({Answer:[{type:1,data:'203.0.113.12'}]})})};
 context.self=context;context.wasm_bindgen={
   catalog_request:()=>new Uint8Array([1]),catalog_response:()=>new Uint8Array([2]),
   descriptor_info_json:()=>JSON.stringify({infohash:'01'.repeat(20),is_live:true,trackers:['udp://tracker.example.invalid:6969/announce']}),
   tracker_connect_request:wasm.tracker_connect_request,tracker_connection_id:wasm.tracker_connection_id,
   tracker_announce_request:wasm.tracker_announce_request,tracker_peers_json:wasm.tracker_peers_json
 };
 vm.createContext(context);vm.runInContext(fs.readFileSync('work/acetv-live-probe/app/discovery.js','utf8'),context);
 const timer=setInterval(()=>{if(module.peerTick)module.peerTick()},1);
 try{const result=await context.AceDiscovery.resolve('00'.repeat(20));assert.equal(result.peers.length,1);assert.equal(result.peers[0].host,'198.51.100.22');assert.equal(result.peers[0].port,8621);assert.equal(connects,2);assert.equal(announces,1);
   const bad=Buffer.alloc(21);bad.writeUInt32BE(1);bad.writeUInt32BE(5,4);assert.throws(()=>wasm.tracker_peers_json(bad,5));assert.throws(()=>wasm.tracker_connection_id(Buffer.alloc(16),42));
   assert.equal(frees,2);assert.equal(closes,2);
   console.log(JSON.stringify({ok:true,mode:'mock-sockets-real-tracker-codec',connects,announces,checks:['sequential catalog and UDP exchange','DNS answer validation','BEP15 transaction validation','malformed compact peers rejected','resource cleanup']}));
 }finally{clearInterval(timer)}
})().catch(e=>{console.error(e);process.exitCode=1});
