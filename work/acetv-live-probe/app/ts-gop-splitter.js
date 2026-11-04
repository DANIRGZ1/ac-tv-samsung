/* Bound flushes to transport random-access points, not arbitrary TCP/piece sizes. */
function TsGopSplitter(onSegment){
  var tail=new Uint8Array(0),parts=[],size=0,videoPid=null,started=false,locked=false,unsynced=0;
  var MAX_UNSYNCED=1024*1024;
  var parser;
  var frameStart=null,frameIdr=false,nalZeros=0,nalHeader=false;
  var pesHeader=null,pesSkip=0;
  var nalTypes={};
  function newParser(){
    parser=new muxjs.mp2t.TransportParseStream();
    parser.on('data',function(e){if(e.type==='pmt'&&e.programMapTable)videoPid=e.programMapTable.video});
  }
  function discardGop(){parts=[];size=0;started=false;videoPid=null;frameStart=null;frameIdr=false;nalZeros=0;nalHeader=false;}
  function emitPrefix(count){if(!count)return;var length=count*188,out=new Uint8Array(length),at=0;for(var i=0;i<count;i++){out.set(parts[i],at);at+=188;}parts=parts.slice(count);size-=length;if(frameStart!==null)frameStart-=count;onSegment(out)}
  function emit(){emitPrefix(parts.length)}
  function keyframe(){if(frameIdr||frameStart===null)return;if(started)emitPrefix(frameStart);started=true;frameIdr=true;}
  function scanNal(b){
    if(nalHeader){if((b&128)===0){var type=b&31;nalTypes[type]=(nalTypes[type]||0)+1;if(type===5)keyframe();}nalHeader=false;}
    if(b===0)nalZeros++;else if(b===1&&nalZeros>=2){nalHeader=true;nalZeros=0;}else nalZeros=0;
  }
  function valid(p){return p[0]===0x47&&((p[3]>>4)&3)!==0}
  newParser();
  this.push=function(bytes){
    var data=new Uint8Array(tail.length+bytes.length);data.set(tail);data.set(bytes,tail.length);var at=0;
    while(true){
      if(!locked){
        var found=-1;
        for(var s=0;s+2*188+3<data.length;s++){
          if(valid(data.subarray(s,s+188))&&valid(data.subarray(s+188,s+376))&&valid(data.subarray(s+376,s+564))){found=s;break}
        }
        if(found<0){
          var keep=Math.min(data.length,379);unsynced+=data.length-keep;tail=data.slice(data.length-keep);
          if(unsynced>MAX_UNSYNCED)throw Error('MPEG-TS synchronization not found within 1 MiB');
          return;
        }
        unsynced+=found;if(unsynced>MAX_UNSYNCED)throw Error('MPEG-TS synchronization not found within 1 MiB');
        data=data.slice(found);at=0;locked=true;unsynced=0;
      }
      if(at+188>data.length)break;
      if(!valid(data.subarray(at,at+188))){
        discardGop();locked=false;newParser();
        unsynced+=1;if(unsynced>MAX_UNSYNCED)throw Error('MPEG-TS synchronization not found within 1 MiB');
        data=data.slice(at+1);at=0;continue;
      }
      var p=data.slice(at,at+188),pid=((p[1]&31)<<8)|p[2];parser.push(p);
      var control=(p[3]>>4)&3,hasAdaptation=control===2||control===3;
      if(pid===videoPid&&(p[1]&0x40)!==0){frameStart=parts.length;frameIdr=false;nalZeros=0;nalHeader=false;pesHeader=[];pesSkip=0;}
      var randomAccess=pid===videoPid&&(p[1]&0x40)!==0&&hasAdaptation&&p[4]>0&&(p[5]&0x40)!==0;
      parts.push(p);size+=188;
      if(randomAccess)keyframe();
      // Annex-B IDR can span TS packet boundaries. Retain the complete PES from
      // its start so flushing at an IDR never discards SPS/PPS or the PES header.
      if(pid===videoPid&&(control===1||control===3)){
        var payload=hasAdaptation?5+p[4]:4;
        for(var n=payload;n<188;n++){
          var b=p[n];
          if(pesHeader){pesHeader.push(b);if(pesHeader.length===9){if(pesHeader[0]===0&&pesHeader[1]===0&&pesHeader[2]===1)pesSkip=pesHeader[8];else pesHeader.forEach(scanNal);pesHeader=null;}continue;}
          if(pesSkip){pesSkip--;continue;}scanNal(b);
        }
      }
      if(size>8*1024*1024)throw Error('No MPEG-TS video keyframe within 8 MiB');
      at+=188;
    }
    tail=data.slice(at);
  };
  this.end=function(){if(!started)throw Error('No video random-access point found');emit();tail=new Uint8Array(0);};
  this.status=function(){return {locked:locked,videoPid:videoPid,randomAccessFound:started,pendingGopBytes:size,pendingTailBytes:tail.length,unsyncedBytes:unsynced,nalTypes:nalTypes}};
}
