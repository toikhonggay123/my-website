import {enqueueScan,syncScans,coalescedTask} from '@/lib/offline-queue.mjs';
let database:Promise<IDBDatabase>|null=null;
function open():Promise<IDBDatabase>{
 if(database)return database;
 const opening=new Promise<IDBDatabase>((resolve,reject)=>{
  const request=indexedDB.open('mealcheck-device',1);
  const reset=()=>{if(database===opening)database=null;};
  request.onupgradeneeded=()=>request.result.createObjectStore('scans',{keyPath:'key'});
  request.onsuccess=()=>{
   const db=request.result;
   db.onclose=reset;
   db.onversionchange=()=>{db.close();reset();};
   resolve(db);
  };
  request.onerror=()=>{reset();reject(Error('Không mở được bộ nhớ trên máy. Kiểm tra dung lượng hoặc chế độ riêng tư.'));};
 });
 database=opening;
 return opening;
}
async function operation(mode:IDBTransactionMode,method:'get'|'getAll'|'put'|'delete',value?:any,retry=true):Promise<any>{
 const db=await open();let tx:IDBTransaction;
 try{tx=db.transaction('scans',mode);}
 catch(error){
  // Safari can close the IndexedDB connection while an app is suspended.
  // Retry only before a transaction exists, so a write can never be replayed.
  if(retry&&(error as Error).name==='InvalidStateError'){database=null;return operation(mode,method,value,false);}
  throw Error('Không kết nối được bộ nhớ trên máy. Vui lòng mở lại ứng dụng.');
 }
 return new Promise((resolve,reject)=>{
  const store=tx.objectStore('scans'),request=method==='getAll'?store.getAll():method==='put'?store.put(value):method==='delete'?store.delete(value):store.get(value);let result:any;
  request.onsuccess=()=>{result=request.result;};tx.oncomplete=()=>resolve(result);
  tx.onerror=()=>reject(Error('Không lưu được lượt quét trên điện thoại.'));
  tx.onabort=()=>reject(Error('Lượt quét chưa được lưu. Vui lòng thử lại.'));
 });
}
export const scanStore={get:(key:string)=>operation('readonly','get',key),all:()=>operation('readonly','getAll'),put:(row:any)=>operation('readwrite','put',row),remove:(key:string)=>operation('readwrite','delete',key)};
export const queueChanged=()=>window.dispatchEvent(new Event('mealcheck-outbox-change'));
export async function saveScan(scan:any){const row=await enqueueScan(scanStore,scan);queueChanged();return row;}
export const flushScans=coalescedTask(()=>syncScans(scanStore,async(row:any)=>{
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),20000);
  try{
   const response=await fetch('/api/qr/scan?space='+row.space,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:row.token,id:row.id,sessionId:row.sessionId}),signal:controller.signal});
   let data:any;try{data=await response.json();}catch{return {ok:false,status:503,data:null};}
   return {ok:response.ok,status:response.status,data};
  }finally{clearTimeout(timeout);}
 },(row:any,result:any)=>window.dispatchEvent(new CustomEvent('mealcheck-scan-ack',{detail:{space:row.space,requestId:row.id,capturedAt:row.createdAt,result}})),()=>navigator.onLine,(row:any,error:string)=>window.dispatchEvent(new CustomEvent('mealcheck-scan-failed',{detail:{space:row.space,requestId:row.id,sessionId:row.sessionId,error}}))).finally(queueChanged));
export function readDevicePref(key:string,fallback:any){try{return JSON.parse(localStorage.getItem('mealcheck:'+key)||'null')??fallback;}catch{return fallback;}}
export function saveDevicePref(key:string,value:any){try{localStorage.setItem('mealcheck:'+key,JSON.stringify(value));}catch{}}
