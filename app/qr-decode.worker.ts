import jsQR from 'jsqr';
self.onmessage=(event:MessageEvent)=>{
 const {buffer,width,height}=event.data;
 try{const qr=jsQR(new Uint8ClampedArray(buffer),width,height,{inversionAttempts:'dontInvert'});self.postMessage({token:qr?.data||''});}
 catch{self.postMessage({token:''});}
};
