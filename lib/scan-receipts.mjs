export const RECEIPT_LIMIT=1000;

// Session-only display data. QR ciphertext and signing material never enter this list.
export function scanReceipt(result,sequence,now=Date.now()){
 if(!['recorded','already'].includes(result?.status)||!result.student?.id||!result.student?.name||!['sang','trua','toi'].includes(result.meal)||!/^\d{4}-\d{2}-\d{2}$/.test(result.date||''))return null;
 return {key:JSON.stringify([result.date,result.meal,result.student.id]),sequence,date:result.date,meal:result.meal,duplicate:result.status==='already',observedAt:now,student:{id:result.student.id,name:result.student.name,code:result.student.code||'',class:result.student.class||''}};
}

export function addReceipt(rows,receipt){
 if(!receipt)return rows;
 const old=rows.find(row=>row.key===receipt.key);
 const next={...receipt,duplicate:receipt.duplicate&&(old?.duplicate??true)};
 return [next,...rows.filter(row=>row.key!==receipt.key)].slice(0,RECEIPT_LIMIT);
}

// One compositor animation; geometry is read once, never on every frame.
export function flyReceiptIntoTray(node,target,onLand,reduced=false){
 let animation=null,done=false,timer=null;
 if(node?.style)node.style.opacity='1';
 const finish=()=>{if(done)return;done=true;clearTimeout(timer);if(node?.style)node.style.opacity='0';animation?.cancel();onLand();};
 const cancel=()=>{if(done)return;done=true;clearTimeout(timer);animation?.cancel();};
 if(!node?.animate||reduced){timer=setTimeout(finish,3000);return {cancel,finishSoon:finish};}
 const a=node.getBoundingClientRect(),b=target.getBoundingClientRect();
 if(!a.width||!a.height||!b.width||!b.height){finish();return {cancel,finishSoon:finish};}
 const dx=b.left+b.width/2-a.left-a.width/2,dy=b.top+b.height/2-a.top-a.height/2;
 const base='translate(-50%, -50%)';
 const landing=base+' translate('+dx+'px, '+dy+'px) scale(0.46)';
 const easing=getComputedStyle(node).getPropertyValue('--ease-out').trim()||'cubic-bezier(0.23, 1, 0.32, 1)';
 const play=(frames,duration,curve=easing)=>{
  try{const current=node.animate(frames,{duration,easing:curve,fill:'both'});animation=current;void current.finished.then(()=>{if(animation===current)finish();}).catch(()=>{});}
  catch{finish();}
 };
 play([{opacity:0,transform:base+' translateY(-8px) scale(0.96)',offset:0,easing},{opacity:1,transform:base,offset:.06},{opacity:1,transform:base,offset:.9,easing},{opacity:0,transform:landing,offset:1}],3000,'linear');
 return {cancel,finishSoon(){
  if(done)return;
  const style=getComputedStyle(node),from={opacity:style.opacity,transform:style.transform};
  animation?.cancel();play([from,{opacity:0,transform:landing}],160);
 }};
}
