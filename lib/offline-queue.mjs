export const queueKey=row=>JSON.stringify([row.space,row.sessionId,row.token]);
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
 if(!['live','demo'].includes(scan.space)||typeof scan.token!=='string'||scan.token.length>600||!scan.token.startsWith('AFYLLX:1:')||!new RegExp('^'+scan.space+':\\d{4}-\\d{2}-\\d{2}:(sang|trua|toi)$').test(scan.sessionId))throw Error('Lượt quét không hợp lệ.');
 const key=queueKey(scan),old=await store.get(key);if(old){if(old.state==='failed')throw Error(old.error||'Lượt quét trước đã bị từ chối. Kiểm tra lượt chờ trước khi quét lại.');return old;}
 if((await store.all()).length>=500)throw Error('Đã có 500 lượt trên máy. Kết nối mạng để đồng bộ trước khi quét tiếp.');
 const row={key,id:crypto.randomUUID(),space:scan.space,sessionId:scan.sessionId,token:scan.token,createdAt:now,state:'pending',error:''};
 await store.put(row);return row;
}
export async function syncScans(store,send,onAck=(row,result)=>{void row;void result;},isOnline=()=>true,onFailure=(row,error)=>{void row;void error;}){
 const outcomes=[];
 for(const row of (await store.all()).sort((a,b)=>a.createdAt-b.createdAt)){
  if(row.state!=='pending'||!isOnline())continue;
  try{
   const response=await send(row);
   if(response.ok&&['recorded','already'].includes(response.data?.status)){
    await store.remove(row.key);outcomes.push({row,result:response.data});onAck(row,response.data);
   }else if([408,425,429].includes(response.status)){
    break; // Temporary failures must retain the original id and remain retryable.
   }else if(response.status>=400&&response.status<500){
    const error=response.data?.error||'Máy chủ từ chối lượt quét. Kiểm tra ngày, thẻ hoặc thiết bị.';
    await store.put({...row,state:'failed',error});onFailure(row,error);
   }else break; // Network/server failures retain the original id for a safe retry.
  }catch{break;}
 }
 return outcomes;
}
