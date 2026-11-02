// Drain small rejected bodies so the local HTTP proxy can reuse the connection.
// Large bodies are cancelled without buffering or parsing untrusted JSON.
export async function discardRequestBody(request){
  if(!request.body||request.bodyUsed)return;
  const reader=request.body.getReader();let bytes=0;
  try{while(bytes<=65536){const chunk=await reader.read();if(chunk.done)return;bytes+=chunk.value.byteLength;}await reader.cancel();}catch{}finally{reader.releaseLock();}
}
import {AppError} from './mealcheck.mjs';

export async function readJsonBody(request,limit=2_000_000){
 if(!request.body)return {};
 const reader=request.body.getReader(),chunks=[];let size=0;
 try{
  while(true){
   const {done,value}=await reader.read();if(done)break;
   size+=value.byteLength;
   if(size>limit){await reader.cancel();throw new AppError('Dữ liệu quá lớn.',413);}
   chunks.push(value);
  }
 }finally{reader.releaseLock();}
 if(!size)return {};
 const bytes=new Uint8Array(size);let offset=0;
 for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
 let body;
 try{body=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}
 catch{throw new AppError('Dữ liệu JSON không hợp lệ.');}
 if(!body||typeof body!=='object'||Array.isArray(body))throw new AppError('Dữ liệu JSON phải là một đối tượng.');
 return body;
}
