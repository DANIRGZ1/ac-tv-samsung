/* TS->fragmented MP4 stays on the TV. mux.js 6.3.0, Apache-2.0. */
function TsMsePlayer(video,onEvent){
  var self=this;self.video=video;self.queue=[];self.bytes=0;self.initialized=false;self.closed=false;self.eof=false;
  self.media=new MediaSource();self.url=URL.createObjectURL(self.media);video.src=self.url;
  self.transmuxer=new muxjs.mp4.Transmuxer({remux:true});
  function fail(e){onEvent({type:'error',error:String(e.message||e)});self.closed=true;}
  self.transmuxer.on('data',function(segment){try{
    if(self.closed)return;
    if(!self.sourceBuffer){
      if(segment.type!=='combined')throw Error('Expected H264 video and AAC audio');
      var info=segment.info;function h(n){return n.toString(16).padStart(2,'0')}
      var codec='video/mp4; codecs="avc1.'+h(info.profileIdc)+h(info.profileCompatibility)+h(info.levelIdc)+', mp4a.40.2"';
      if(!MediaSource.isTypeSupported(codec))throw Error('Unsupported codecs: '+codec);
      self.sourceBuffer=self.media.addSourceBuffer(codec);
      self.sourceBuffer.addEventListener('updateend',drain);
      self.sourceBuffer.addEventListener('error',function(){fail(Error('MSE append error'))});
      onEvent({type:'configured',codec:codec,width:info.width,height:info.height});
    }
    var bytes;
    if(!self.initialized){bytes=new Uint8Array(segment.initSegment.length+segment.data.length);bytes.set(segment.initSegment);bytes.set(segment.data,segment.initSegment.length);self.initialized=true;}
    else bytes=segment.data;
    if(self.bytes+bytes.length>16*1024*1024)throw Error('Playback queue exceeds 16 MiB');
    self.queue.push(bytes);self.bytes+=bytes.length;drain();
  }catch(e){fail(e)}});
  function drain(){try{
    var sb=self.sourceBuffer;if(self.closed||!sb||sb.updating)return;
    // Trim played media before appending more, keeping memory bounded for live playback.
    if(video.currentTime>20&&sb.buffered.length&&sb.buffered.start(0)<video.currentTime-15){sb.remove(sb.buffered.start(0),video.currentTime-10);return;}
    if(self.queue.length){var next=self.queue.shift();self.bytes-=next.length;sb.appendBuffer(next);return;}
    if(self.eof&&self.media.readyState==='open')self.media.endOfStream();
  }catch(e){fail(e)}}
  self.ready=new Promise(function(resolve,reject){
    self.media.addEventListener('sourceopen',function(){resolve()},{once:true});
    self.media.addEventListener('sourceclose',function(){if(!self.closed)reject(Error('MSE closed before playback'))},{once:true});
  });
  self.push=function(bytes){if(self.closed)throw Error('Player closed');if(self.media.readyState!=='open')throw Error('Player not ready');self.transmuxer.push(bytes);self.transmuxer.flush();};
  self.end=function(){self.eof=true;drain()};
  self.destroy=function(){self.closed=true;video.pause();video.removeAttribute('src');video.load();URL.revokeObjectURL(self.url);self.queue=[];self.transmuxer.dispose()};
}
