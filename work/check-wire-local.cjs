const fs=require('fs'),vm=require('vm');
globalThis.self=globalThis;
vm.runInThisContext(fs.readFileSync('work/acetv-wire-probe/app/core/ace_wire.js','utf8'));
(async()=>{
 await wasm_bindgen({module_or_path:fs.readFileSync('work/acetv-wire-probe/app/core/ace_wire_bg.wasm')});
 const result=JSON.parse(wasm_bindgen.self_test_json());
 const handshake=JSON.parse(wasm_bindgen.decode_handshake_json(wasm_bindgen.encode_handshake_hex('07'.repeat(32))));
 result.signed_extended_handshake=handshake.ok&&handshake.signature_valid===true;
 result.ok=result.ok&&result.signed_extended_handshake;
 console.log(JSON.stringify(result));
 if(!result.ok)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1});
