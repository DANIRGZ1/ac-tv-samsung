var controlKey=null,queued=null;
var Module={canvas:document.getElementById('canvas'),onCustomMessage:function(e){if(controlKey)parent.postMessage({aceNativeEvent:true,key:controlKey,payload:e.data.userData},'*')},printErr:function(){if(controlKey)parent.postMessage({aceNativeEvent:true,key:controlKey,payload:{type:'transport-error'}},'*')}};
window.addEventListener('message',function(event){
  if(event.source!==parent)return;var d=event.data;if(!d||d.aceNativeControl!==true||typeof d.key!=='string'||!/^[a-f0-9]{32}$/.test(d.key))return;
  if(controlKey&&controlKey!==d.key)return;controlKey=d.key;
  if(d.start)queued=d.start;
  if(d.stop){if(typeof postCustomMessage==='function')postCustomMessage({stop:true});setTimeout(function(){if(typeof worker!=='undefined')worker.terminate()},50);return;}
  if(queued&&typeof postCustomMessage==='function'){postCustomMessage({start:queued});queued=null}
});
