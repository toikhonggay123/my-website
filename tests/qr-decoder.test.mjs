import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import {pathToFileURL} from 'node:url';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
const path='app/qr-camera-decoder.ts';
const source=ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText.replace(/import workerUrl from [^;]+;/, 'const workerUrl = "/assets/qr-worker.js";').replace("import('jsqr')", 'import('+JSON.stringify(import.meta.resolve('jsqr'))+')');
const {createCameraDecoder}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const token='AFYLLX:1:test-camera-performance';
function pixels(width,height){const qr=QRCode.create(token,{errorCorrectionLevel:'M'}),out=new Uint8ClampedArray(width*height*4).fill(255),scale=Math.floor(Math.min(width,height)/(qr.modules.size+8)),ox=Math.floor((width-qr.modules.size*scale)/2),oy=Math.floor((height-qr.modules.size*scale)/2);for(let y=0;y<qr.modules.size;y++)for(let x=0;x<qr.modules.size;x++)if(qr.modules.get(y,x))for(let dy=0;dy<scale;dy++)for(let dx=0;dx<scale;dx++){const i=((oy+y*scale+dy)*width+ox+x*scale+dx)*4;out[i]=out[i+1]=out[i+2]=0;}return out;}
function canvas(){return {width:0,height:0,draws:[],getContext(){return {drawImage:(...args)=>this.draws.push(args),getImageData:(x,y,w,h)=>({data:pixels(w,h)})};}};}
const video={videoWidth:1280,videoHeight:720};
test('Dùng bộ đọc QR native khi thiết bị hỗ trợ, không sao chép khung hình',async()=>{globalThis.window={BarcodeDetector:class{static async getSupportedFormats(){return ['qr_code'];}async detect(input){assert.equal(input,video);return [{rawValue:token}];}}};const c=canvas(),decoder=await createCameraDecoder(c);assert.equal(await decoder.decode(video),token);assert.equal(c.draws.length,0);decoder.close();assert.equal(await decoder.decode(video),'');});
test('Fallback worker giải mã được QR ở vùng giữa và toàn khung; hủy không treo',async()=>{globalThis.window={};let terminated=false;globalThis.Worker=class{postMessage({buffer,width,height}){const result=jsQR(new Uint8ClampedArray(buffer),width,height);queueMicrotask(()=>this.onmessage({data:{token:result?.data||''}}));}terminate(){terminated=true;}};const c=canvas(),decoder=await createCameraDecoder(c);assert.equal(await decoder.decode(video),token);assert.equal(await decoder.decode(video),token);assert.equal(c.draws[0][3],576);assert.equal(c.draws[1][3],1280);decoder.close();assert.equal(terminated,true);});
test('Native lỗi chuyển sang worker và đóng worker giải phóng lời gọi đang đợi',async()=>{globalThis.window={BarcodeDetector:class{static async getSupportedFormats(){return ['qr_code'];}async detect(){throw Error('unsupported frame');}}};globalThis.Worker=class{postMessage(){}terminate(){}};const decoder=await createCameraDecoder(canvas()),reading=decoder.decode(video);await new Promise(resolve=>setTimeout(resolve,0));decoder.close();assert.equal(await reading,'');});

test('Worker bị chặn như file URL vẫn đọc QR bằng phương án dự phòng',async()=>{
 globalThis.window={};globalThis.Worker=class{constructor(){throw new DOMException('Blocked file URL','SecurityError');}};
 const decoder=await createCameraDecoder(canvas());assert.equal(await decoder.decode(video),token);decoder.close();
});
test('Worker lỗi tải hoặc lỗi truyền dữ liệu không làm treo máy quét',async()=>{
 for(const kind of ['error','messageerror','post']){
  globalThis.window={};let terminated=false;
  globalThis.Worker=class{postMessage(){if(kind==='post')throw Error('transfer failed');queueMicrotask(()=>kind==='error'?this.onerror({preventDefault(){}}):this.onmessageerror());}terminate(){terminated=true;}};
  const decoder=await createCameraDecoder(canvas());assert.equal(await decoder.decode(video),token);assert.equal(terminated,true);assert.equal(await decoder.decode(video),token);decoder.close();
 }
});
test('Worker không phản hồi được hủy và giải mã dự phòng',async()=>{
 globalThis.window={};let terminated=false;
 globalThis.Worker=class{postMessage(){}terminate(){terminated=true;}};
 const decoder=await createCameraDecoder(canvas());assert.equal(await decoder.decode(video),token);assert.equal(terminated,true);decoder.close();
});
test('Giải mã đồng thời và đóng khi native đang chạy không tạo worker mới',async()=>{
 let reject;globalThis.window={BarcodeDetector:class{static async getSupportedFormats(){return ['qr_code'];}detect(){return new Promise((_,r)=>reject=r);}}};
 globalThis.Worker=class{constructor(){throw Error('Must not start worker after closing');}};
 const decoder=await createCameraDecoder(canvas()),reading=decoder.decode(video);assert.equal(await decoder.decode(video),'');decoder.close();reject(Error('native failed'));assert.equal(await reading,'');
});

test('Native misses try the worker on the actual guide instead of remaining stuck on native',async()=>{
 globalThis.window={BarcodeDetector:class{static async getSupportedFormats(){return ['qr_code'];}async detect(){return [];}}};
 globalThis.Worker=class{postMessage(){queueMicrotask(()=>this.onmessage({data:{token}}));}terminate(){}};
 const c=canvas(),decoder=await createCameraDecoder(c,()=>({x:440,y:200,width:300,height:300}));
 assert.equal(await decoder.decode(video),'');assert.equal(await decoder.decode(video),'');assert.equal(await decoder.decode(video),token);
 assert.deepEqual(c.draws[0].slice(1,5),[440,200,300,300]);decoder.close();
});

test('A hanging native decode switches to the worker and can still be closed',async()=>{
 globalThis.window={BarcodeDetector:class{static async getSupportedFormats(){return ['qr_code'];}detect(){return new Promise(()=>{});}}};
 globalThis.Worker=class{postMessage(){queueMicrotask(()=>this.onmessage({data:{token}}));}terminate(){}};
 const decoder=await createCameraDecoder(canvas());assert.equal(await decoder.decode(video),token);decoder.close();
});
