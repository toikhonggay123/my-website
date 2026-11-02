import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const source=ts.transpileModule(fs.readFileSync('app/qr-image.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const {openQrImage}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
function setup(t){
 const bitmap=globalThis.createImageBitmap,image=globalThis.Image;
 t.after(()=>{globalThis.createImageBitmap=bitmap;globalThis.Image=image;});
}
test('Ảnh QR dùng ImageBitmap khi khả dụng và giải phóng sau khi đọc',async t=>{
 setup(t);let closed=false;globalThis.createImageBitmap=async()=>({width:200,height:150,close(){closed=true;}});
 const image=await openQrImage(new Blob());assert.equal(image.width,200);image.close();assert.equal(closed,true);
});
test('Safari thiếu ImageBitmap hoặc từ chối định dạng vẫn dùng được phần tử ảnh',async t=>{
 setup(t);let revoked=0;t.mock.method(URL,'revokeObjectURL',()=>revoked++);
 globalThis.Image=class{naturalWidth=200;naturalHeight=150;set src(value){if(value)queueMicrotask(()=>this.onload?.());}};
 for(const native of [undefined,async()=>{throw Error('unsupported bitmap');}]){
  globalThis.createImageBitmap=native;const image=await openQrImage(new Blob());assert.equal(image.width,200);assert.equal(image.height,150);image.close();
 }
 assert.equal(revoked,2);
});
test('Ảnh hỏng được báo bằng tiếng Việt và thu hồi blob URL',async t=>{
 setup(t);globalThis.createImageBitmap=undefined;let revoked=false;t.mock.method(URL,'revokeObjectURL',()=>revoked=true);
 globalThis.Image=class{set src(value){if(value)queueMicrotask(()=>this.onerror?.());}};
 await assert.rejects(openQrImage(new Blob()),/Không đọc được ảnh QR/);assert.equal(revoked,true);
});
