// Map the visible guide through object-fit: cover into source video pixels.
export function cameraRegion(width,height,video,guide){
 if(!width||!height||!video?.width||!video?.height||!guide?.width||!guide?.height)return null;
 const scale=Math.max(video.width/width,video.height/height),pad=Math.min(guide.width,guide.height)*.08;
 const left=(guide.left-video.left+(width*scale-video.width)/2-pad)/scale;
 const top=(guide.top-video.top+(height*scale-video.height)/2-pad)/scale;
 const x=Math.max(0,Math.floor(left)),y=Math.max(0,Math.floor(top));
 const right=Math.min(width,Math.ceil(left+(guide.width+pad*2)/scale)),bottom=Math.min(height,Math.ceil(top+(guide.height+pad*2)/scale));
 return right>x&&bottom>y?{x,y,width:right-x,height:bottom-y}:null;
}

export function videoFramePump(video,decode,{onError=()=>{},minimumInterval=80}={}){
 let stopped=false,callback=null,timer=null,busy=false,next=0,lastMediaTime=-1;
 const schedule=()=>{
  if(stopped)return;
  if(typeof video.requestVideoFrameCallback==='function')callback=video.requestVideoFrameCallback(tick);
  else timer=setTimeout(()=>void tick(performance.now(),{mediaTime:video.currentTime}),Math.max(16,next-performance.now()));
 };
 async function tick(now,metadata={}){
  callback=null;timer=null;
  if(stopped)return;
  const mediaTime=metadata.mediaTime??video.currentTime;
  if(busy||now<next||mediaTime===lastMediaTime){schedule();return;}
  lastMediaTime=mediaTime;busy=true;const started=performance.now();
  try{await decode();}catch(error){onError(error);}
  finally{busy=false;next=performance.now()+Math.max(0,minimumInterval-(performance.now()-started));schedule();}
 }
 schedule();
 return()=>{stopped=true;if(timer!==null)clearTimeout(timer);if(callback!==null)video.cancelVideoFrameCallback?.(callback);};
}
