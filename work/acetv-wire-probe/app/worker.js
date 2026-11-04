(async function(){
  var started=Date.now();
  try {
    postMessage({type:'progress',stage:'load-module',webCrypto:!!(self.crypto&&self.crypto.getRandomValues)});
    importScripts('core/ace_wire.js');
    var response=await fetch('core/ace_wire_bg.wasm');
    if(!response.ok)throw Error('WASM HTTP '+response.status);
    var bytes=await response.arrayBuffer();
    postMessage({type:'progress',stage:'instantiate',bytes:bytes.byteLength});
    await wasm_bindgen({module_or_path:bytes});
    postMessage({type:'progress',stage:'crypto-tests'});
    var result=JSON.parse(wasm_bindgen.self_test_json());
    var signed=wasm_bindgen.encode_handshake_hex('07'.repeat(32));
    var decoded=JSON.parse(wasm_bindgen.decode_handshake_json(signed));
    result.signed_extended_handshake=decoded.ok&&decoded.signature_valid===true;
    result.invalid_unicode_rejected=JSON.parse(wasm_bindgen.decode_handshake_json('é')).ok===false;
    result.ok=result.ok&&result.signed_extended_handshake&&result.invalid_unicode_rejected;
    postMessage({type:'result',result:result,elapsedMs:Date.now()-started});
  } catch(e) {postMessage({type:'error',error:String(e.stack||e),elapsedMs:Date.now()-started});}
})();
