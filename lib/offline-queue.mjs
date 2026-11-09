export const queueKey=row=>JSON.stringify([row.space,row.sessionId,row.token]);
export const SCAN_SYNC_TAG='mealcheck-pending-scans';
// Calls arriving during one pass request one further pass, sharing one promise.
export function coalescedTask(run){
 let active=null,again=false;
 return ()=>{
  if(active){again=true;return active;}
  active=Promise.resolve().then(async()=>{
   try{let result;do{again=false;result=await run();}while(again);return result;}
   finally{active=null;}
  });
  return active;
 };
}
export async function enqueueScan(store,scan,now=Date.now()){
 if(!['live','demo'].includes(scan.space)||typeof scan.token!=='string'||scan.token.length>600||!/^AFYLLX:1:[\w-]+$/.test(scan.token)||!new RegExp('^'+scan.space+':\\d{4}-\\d{2}-\\d{2}:(sang|trua|toi)$').test(scan.sessionId))throw Error('Lượt quét không hợp lệ.');
 const row=await store.enqueue({key:queueKey(scan),id:crypto.randomUUID(),space:scan.space,sessionId:scan.sessionId,token:scan.token,createdAt:now,state:'pending',error:''});
 if(row.state==='failed')throw Error(row.error||'Lượt quét trước đã bị từ chối. Kiểm tra lượt chờ trước khi quét lại.');
 return row;
}
export async function syncScans(store,send,onAck=(row,result)=>{void row;void result;},isOnline=()=>true,onFailure=(row,error)=>{void row;void error;}){
 let needsRetry=false;
 for(const row of (await store.all()).sort((a,b)=>a.createdAt-b.createdAt)){
  if(row.state!=='pending')continue;
  if(!isOnline())return true;
  try{
   const response=await send(row);
   if(response.ok&&['recorded','already'].includes(response.data?.status)){
    if(await store.settle(row))onAck(row,response.data);
   }else if(response.status===403&&response.data?.code==='scanner_not_ready'){
    needsRetry=true; // A local tab may still be enrolling this space. Other spaces can drain.
   }else if([408,425,429].includes(response.status)){
    return true; // Temporary failures retain the original id for retry.
   }else if(response.status>=400&&response.status<500){
    const error=response.data?.error||'Máy chủ từ chối lượt quét. Kiểm tra ngày, thẻ hoặc thiết bị.';
    if(await store.settle(row,error))onFailure(row,error);
   }else return true;
  }catch{return true;}
 }
 return needsRetry;
}

export async function sendScan(row){
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),15000);
 try{
  const response=await fetch('/api/qr/scan?space='+row.space,{
   method:'POST',mode:'same-origin',credentials:'same-origin',cache:'no-store',redirect:'error',
   headers:{'Content-Type':'application/json'},
   body:JSON.stringify({token:row.token,id:row.id,sessionId:row.sessionId}),signal:controller.signal,
  });
  const data=await response.json().catch(()=>null);
  return data?{ok:response.ok,status:response.status,data}:{ok:false,status:503,data:null};
 }finally{clearTimeout(timeout);}
}

export function drainScans(store,notify,isOnline=()=>true){
 const run=()=>syncScans(store,sendScan,
  (row,result)=>notify('mealcheck-scan-ack',{space:row.space,requestId:row.id,capturedAt:row.createdAt,result}),
  isOnline,
  (row,error)=>notify('mealcheck-scan-failed',{space:row.space,requestId:row.id,sessionId:row.sessionId,error}),
 );
 // Foreground pages and the service worker share the lock when supported.
 return globalThis.navigator?.locks?.request(SCAN_SYNC_TAG,{ifAvailable:true},lock=>lock?run():true)??run();
}
