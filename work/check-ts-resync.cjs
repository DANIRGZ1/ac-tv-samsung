const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const sandbox={window:{},console};vm.createContext(sandbox);
vm.runInContext(fs.readFileSync('work/toolchain/muxjs/package/dist/mux.min.js','utf8'),sandbox);
vm.runInContext(fs.readFileSync('work/acetv-live-probe/app/ts-gop-splitter.js','utf8'),sandbox);
const dir='work/acetv-video-probe/app/media';
const input=Buffer.concat(fs.readdirSync(dir).filter(n=>/^test-\d+\.ts$/.test(n)).sort((a,b)=>Number(a.match(/\d+/)[0])-Number(b.match(/\d+/)[0])).map(n=>fs.readFileSync(path.join(dir,n))));
function split(bytes,sizes){const out=[],s=new sandbox.TsGopSplitter(x=>out.push(Buffer.from(x)));let at=0,i=0;while(at<bytes.length){const end=Math.min(bytes.length,at+sizes[i++%sizes.length]);s.push(bytes.subarray(at,end));at=end}s.end();return out}
const baseline=split(input,[196224]);
for(const chunks of [[1,7,183,509,4093],[13,188,189,8191]]){
  const prefixed=Buffer.concat([Buffer.alloc(37,0x22),input]);
  const actual=split(prefixed,chunks);
  if(actual.length!==baseline.length||actual.some((g,i)=>!g.equals(baseline[i])))throw Error('Resync changed GOP contents');
}
let failed=false;try{const s=new sandbox.TsGopSplitter(()=>{});for(let i=0;i<1100;i++)s.push(Buffer.alloc(1024,0x22));}catch(e){failed=/1 MiB/.test(e.message)}
if(!failed)throw Error('Bad input did not hit the unsynced byte cap');
console.log(JSON.stringify({status:'PASS',gops:baseline.length,bytes:input.length,chunkPatterns:2,badInputCap:true}));
