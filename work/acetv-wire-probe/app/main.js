window.WireProbeState = {status:'starting', userAgent:navigator.userAgent, events:[]};
var worker = new Worker('worker.js');
function update(message) {
  WireProbeState.events.push(message);
  if(message.type==='result') {WireProbeState.status=message.result.ok?'PASS':'FAIL';WireProbeState.result=message.result;WireProbeState.elapsedMs=message.elapsedMs;}
  if(message.type==='error') {WireProbeState.status='ERROR';WireProbeState.error=message.error;}
  document.getElementById('status').textContent=WireProbeState.status;
  document.getElementById('result').textContent=JSON.stringify(WireProbeState,null,2);
}
worker.onmessage=function(e){update(e.data)};
worker.onerror=function(e){update({type:'error',error:e.message+' at '+e.filename+':'+e.lineno})};
document.addEventListener('keydown',function(e){if(e.keyCode===10009){try{tizen.application.getCurrentApplication().exit()}catch(x){}}});
