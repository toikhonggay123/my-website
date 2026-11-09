/// <reference types="vite/client" />
import workerUrl from './qr-decode.worker?worker&url';

type Region={x:number;y:number;width:number;height:number};
const isToken=(token:unknown):token is string=>typeof token==='string'&&token.startsWith('AFYLLX:1:')&&token.length<=600;

export async function createCameraDecoder(canvas:HTMLCanvasElement,getRegion?:()=>Region|null){
 let detector:any=null,worker:Worker|null=null,closed=false,decoding=false,workerFailed=false,frame=0,misses=0,workerMisses=0;
 let pending:((value:string|null)=>void)|null=null,timeout:ReturnType<typeof setTimeout>|null=null,cancelNative:(()=>void)|null=null;
 const Native=(window as any).BarcodeDetector;
 try{if(Native&&(await Native.getSupportedFormats()).includes('qr_code'))detector=new Native({formats:['qr_code']});}catch{}
 const ctx=canvas.getContext('2d',{willReadFrequently:true});
 if(!ctx)throw Error('Không khởi tạo được bộ đọc QR. Hãy tải lại trang và thử lại.');
 function finish(value:string|null){if(timeout)clearTimeout(timeout);timeout=null;const resolve=pending;pending=null;resolve?.(value);}
 function failWorker(){workerFailed=true;worker?.terminate();worker=null;finish(null);}
 function useWorker(){
  if(worker||workerFailed||closed)return;
  try{worker=new Worker(workerUrl,{type:'module'});worker.onmessage=event=>finish(isToken(event.data?.token)?event.data.token:'');worker.onerror=event=>{event.preventDefault();failWorker();};worker.onmessageerror=failWorker;}catch{failWorker();}
 }
 if(!detector)useWorker();
 return {
  async decode(video:HTMLVideoElement):Promise<string>{
   if(closed||decoding||!video.videoWidth||!video.videoHeight)return '';
   decoding=true;
   try{
    const guide=getRegion?.(),wide=!!guide&&workerMisses>=3,region=wide?null:guide;let drawn=false;
    const draw=()=>{
     if(drawn)return;
     const crop=frame++%2===0&&!wide,side=Math.min(video.videoWidth,video.videoHeight)*.8;
     const sw=region?.width??(crop?side:video.videoWidth),sh=region?.height??(crop?side:video.videoHeight);
     const scale=Math.min(1,(region?768:crop?640:800)/Math.max(sw,sh));
     const width=Math.max(1,Math.round(sw*scale)),height=Math.max(1,Math.round(sh*scale));
     if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}
     ctx.drawImage(video,region?.x??(video.videoWidth-sw)/2,region?.y??(video.videoHeight-sh)/2,sw,sh,0,0,width,height);drawn=true;
    };
    if(detector){
     if(region)draw();let nativeTimer:ReturnType<typeof setTimeout>|undefined;
     try{
      const cancelled=new Promise<any[]>((resolve,reject)=>{cancelNative=()=>resolve([]);nativeTimer=setTimeout(()=>reject(Error('Native QR decoder timed out')),250);});
      const codes=await Promise.race([detector.detect(region?canvas:video),cancelled]);
      if(closed)return '';
      const candidates=codes.filter((code:any)=>isToken(code.rawValue));
      if(candidates.length){misses=0;workerMisses=0;return candidates[0].rawValue;}
      if(++misses<3)return '';
      misses=0;useWorker();
     }catch{detector=null;if(closed)return '';useWorker();}
     finally{clearTimeout(nativeTimer);cancelNative=null;}
    }
    draw();let pixels=ctx.getImageData(0,0,canvas.width,canvas.height);
    if(worker){
     const token=await new Promise<string|null>(resolve=>{
      pending=resolve;timeout=setTimeout(failWorker,1500);
      // Transfer ownership; reread only on the exceptional fallback path.
      try{worker!.postMessage({buffer:pixels.data.buffer,width:canvas.width,height:canvas.height,invert:frame%8===0},[pixels.data.buffer]);}catch{failWorker();}
     });
     if(closed)return '';
     if(token!==null){workerMisses=token||wide?0:workerMisses+1;return token;}
     pixels=ctx.getImageData(0,0,canvas.width,canvas.height);
    }
    const {default:jsQR}=await import('jsqr');if(closed)return '';
    const token=jsQR(pixels.data,canvas.width,canvas.height,{inversionAttempts:'attemptBoth'})?.data;
    workerMisses=isToken(token)||wide?0:workerMisses+1;
    return isToken(token)?token:'';
   }finally{decoding=false;}
  },
  close(){closed=true;cancelNative?.();worker?.terminate();worker=null;finish('');}
 };
}
