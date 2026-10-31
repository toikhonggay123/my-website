export async function createCameraDecoder(canvas:HTMLCanvasElement){
 let detector:any=null,worker:Worker|null=null,pending:((value:string)=>void)|null=null,closed=false,frame=0;
 const Native=(window as any).BarcodeDetector;
 try{if(Native&&(await Native.getSupportedFormats()).includes('qr_code'))detector=new Native({formats:['qr_code']});}catch{}
 const ctx=canvas.getContext('2d',{willReadFrequently:true})!;
 const useWorker=()=>{if(!worker){worker=new Worker(new URL('./qr-decode.worker.ts',import.meta.url),{type:'module'});worker.onmessage=e=>{const resolve=pending;pending=null;resolve?.(e.data.token||'');};worker.onerror=()=>{const resolve=pending;pending=null;resolve?.('');};}};
 if(!detector)useWorker();
 return {
  async decode(video:HTMLVideoElement){
   if(closed||!video.videoWidth||!video.videoHeight)return '';
   if(detector){try{return (await detector.detect(video))[0]?.rawValue||'';}catch{detector=null;useWorker();}}
   // Alternate a detailed central crop with the full view, without blocking the UI.
   const crop=frame++%2===0,side=Math.min(video.videoWidth,video.videoHeight)*.8;
   const sw=crop?side:video.videoWidth,sh=crop?side:video.videoHeight,sx=(video.videoWidth-sw)/2,sy=(video.videoHeight-sh)/2;
   const width=Math.min(crop?640:800,sw),height=Math.round(sh*width/sw);
   if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}
   ctx.drawImage(video,sx,sy,sw,sh,0,0,width,height);
   const pixels=ctx.getImageData(0,0,width,height);
   return new Promise<string>(resolve=>{pending=resolve;worker!.postMessage({buffer:pixels.data.buffer,width,height},[pixels.data.buffer]);});
  },
  close(){closed=true;worker?.terminate();pending?.('');pending=null;}
 };
}
