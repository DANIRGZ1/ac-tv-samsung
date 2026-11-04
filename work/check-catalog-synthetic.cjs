// External health check with a synthetic all-zero ID; never reads user links/settings.
const fs=require('fs'),vm=require('vm'),net=require('net'),crypto=require('crypto');
globalThis.self=globalThis;
vm.runInThisContext(fs.readFileSync('work/acetv-wire-probe/app/core/ace_wire.js','utf8'));
(async()=>{
 await wasm_bindgen({module_or_path:fs.readFileSync('work/acetv-wire-probe/app/core/ace_wire_bg.wasm')});
 const results=[];
 for(const host of ['5.252.161.191','77.120.105.88','64.227.119.64','163.172.187.185']){
  const nonce=String(crypto.randomInt(1,2**47));
  try{const response=await new Promise((resolve,reject)=>{
    let size=0,parts=[];const socket=net.connect({host,port:8081},()=>socket.write(wasm_bindgen.catalog_request('0'.repeat(40),nonce,host)));
    const timer=setTimeout(()=>socket.destroy(Error('timeout')),5000);
    socket.on('data',data=>{size+=data.length;if(size>1050000)socket.destroy(Error('oversize response'));else parts.push(data)});
    socket.on('end',()=>{clearTimeout(timer);resolve(Buffer.concat(parts))});socket.on('error',e=>{clearTimeout(timer);reject(e)});
   });
   const status=response.subarray(0,Math.min(response.length,100)).toString().split('\r\n')[0];results.push({host,reachable:true,status,bytes:response.length});
  }catch(e){results.push({host,reachable:false,error:e.message})}
 }
 fs.writeFileSync('work/catalog-synthetic-health.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results));
})().catch(e=>{console.error(e.message);process.exitCode=1});
