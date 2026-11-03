import jsQR from 'jsqr';
self.onmessage=(event:MessageEvent)=>{
 const {buffer,width,height,invert}=event.data;
 try{const qr=jsQR(new Uint8ClampedArray(buffer),width,height,{inversionAttempts:invert?'attemptBoth':'dontInvert'});self.postMessage({token:qr?.data||''});}
 catch{self.postMessage({token:''});}
};
