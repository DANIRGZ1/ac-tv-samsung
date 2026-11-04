window.VideoProbeState={status:'starting',userAgent:navigator.userAgent,events:[],appAssetsOnly:true};
var video=document.getElementById('player'),player=null;
function event(data){VideoProbeState.events.push(data);if(VideoProbeState.events.length>40)VideoProbeState.events.shift();if(data.type==='error'){VideoProbeState.status='FAIL';VideoProbeState.error=data.error;}render()}
function render(){document.getElementById('status').textContent=JSON.stringify({status:VideoProbeState.status,codec:VideoProbeState.codec,time:video.currentTime,decoded:VideoProbeState.decoded,audioBytes:video.webkitAudioDecodedByteCount,error:VideoProbeState.error},null,2)}
['playing','waiting','stalled','canplay','ended'].forEach(function(name){video.addEventListener(name,function(){event({type:name,time:video.currentTime});if(name==='playing')VideoProbeState.status='playing';if(name==='ended'){VideoProbeState.status='PASS';VideoProbeState.ended=true;render()}})});
video.addEventListener('error',function(){event({type:'error',error:'Video error '+(video.error?video.error.code:'unknown')})});
function play(){video.play().catch(function(e){event({type:'play-request',error:String(e)});document.getElementById('start').style.display='block'})}
document.getElementById('start').onclick=play;
document.addEventListener('keydown',function(e){if(e.keyCode===13)play();if(e.keyCode===10009){if(player)player.destroy();tizen.application.getCurrentApplication().exit()}});
(async function(){try{
  if(typeof MediaSource==='undefined')throw Error('MediaSource unavailable');
  player=new TsMsePlayer(video,function(data){if(data.type==='configured'){VideoProbeState.codec=data.codec;VideoProbeState.width=data.width;VideoProbeState.height=data.height;}event(data)});
  await player.ready;
  for(var i=0;i<16;i++){
    while(video.buffered.length&&video.buffered.end(video.buffered.length-1)-video.currentTime>12){await new Promise(function(r){setTimeout(r,250)});if(VideoProbeState.status==='FAIL')throw Error(VideoProbeState.error);}
    var response=await fetch('media/test-'+String(i).padStart(2,'0')+'.ts');if(!response.ok)throw Error('Media asset read failed');
    player.push(new Uint8Array(await response.arrayBuffer()));if(i===0)play();VideoProbeState.segments=i+1;
  }
  player.end();
}catch(e){event({type:'error',error:String(e.stack||e)})}})();
setInterval(function(){
  VideoProbeState.currentTime=video.currentTime;VideoProbeState.readyState=video.readyState;VideoProbeState.muted=video.muted;VideoProbeState.volume=video.volume;
  VideoProbeState.audioDecodedBytes=video.webkitAudioDecodedByteCount;
  var quality=video.getVideoPlaybackQuality?video.getVideoPlaybackQuality():null;
  VideoProbeState.decoded={totalVideoFrames:quality?quality.totalVideoFrames:video.webkitDecodedFrameCount,droppedVideoFrames:quality?quality.droppedVideoFrames:null};
  render();
},1000);
