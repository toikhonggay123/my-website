import test from 'node:test';
import assert from 'node:assert/strict';
import {scanReceipt,addReceipt,flyReceiptIntoTray,RECEIPT_LIMIT} from '../lib/scan-receipts.mjs';
import {coalescedTask} from '../lib/offline-queue.mjs';
const result={status:'recorded',date:'2026-11-03',meal:'sang',student:{id:'demo:1',name:'Học sinh mẫu',code:'QA001',class:'9A',token:'never-retain-this'}};
test('receipt list only accepts confirmed results and never retains QR material',()=>{
 for(const status of ['pending','failed','rejected',undefined])assert.equal(scanReceipt({...result,status},1),null);
 const row=scanReceipt(result,1,100);assert.equal(row.observedAt,100);assert.equal('token' in row.student,false);
 let rows=addReceipt([],row);rows=addReceipt(rows,scanReceipt({...result,status:'already'},2,200));
 assert.equal(rows.length,1);assert.equal(rows[0].duplicate,false);assert.equal(rows[0].observedAt,200);
 rows=addReceipt(rows,scanReceipt({...result,meal:'trua'},3));assert.equal(rows.length,2);
 rows=addReceipt(rows,scanReceipt({...result,date:'2026-11-04'},4));assert.equal(rows.length,3);
});
test('receipt history is bounded without changing its newest confirmed result',()=>{
 let rows=[];for(let i=0;i<RECEIPT_LIMIT+5;i++)rows=addReceipt(rows,scanReceipt({...result,student:{...result.student,id:'demo:'+i}},i));
 assert.equal(rows.length,RECEIPT_LIMIT);assert.equal(rows[0].sequence,RECEIPT_LIMIT+4);
});
test('receipt flight can accelerate into its tray once and does not animate layout',async()=>{
 const previous=globalThis.getComputedStyle;globalThis.getComputedStyle=()=>({opacity:'1',transform:'matrix(1,0,0,1,0,0)',getPropertyValue:()=>''});
 try{
  let lands=0;const calls=[];
  const node={getBoundingClientRect:()=>({left:100,top:100,width:200,height:100}),animate(frames,options){let finish,reject;const finished=new Promise((a,b)=>{finish=a;reject=b;});const animation={finished,cancel(){reject(Error('cancel'));}};calls.push({frames,options,animation,finish});return animation;}};
  const target={getBoundingClientRect:()=>({left:80,top:400,width:240,height:70})};
  const flight=flyReceiptIntoTray(node,target,()=>lands++);flight.finishSoon();
  for(const call of calls)for(const frame of call.frames)assert.ok(Object.keys(frame).every(key=>['opacity','transform','offset','easing'].includes(key)));
  calls[1].finish();await Promise.resolve();await Promise.resolve();assert.equal(lands,1);flight.cancel();assert.equal(lands,1);
  const reduced=flyReceiptIntoTray(node,target,()=>lands++,true);assert.equal(lands,1,'reduced motion still shows confirmation instead of immediately hiding it');reduced.finishSoon();assert.equal(lands,2);reduced.cancel();
 }finally{globalThis.getComputedStyle=previous;}
});
test('many sync triggers share one active task and coalesce into one following pass',async()=>{
 let count=0,release;const task=coalescedTask(async()=>{count++;if(count===1)await new Promise(resolve=>release=resolve);return count;});
 const first=task();await Promise.resolve();for(let i=0;i<30;i++)assert.equal(task(),first);assert.equal(count,1);
 release();assert.equal(await first,2);assert.equal(count,2);assert.equal(await task(),3);
});

test('a failed sync task releases its lock so the next connection can retry',async()=>{
 let attempts=0;const task=coalescedTask(()=>{if(++attempts===1)throw Error('offline');return 'retried';});
 await assert.rejects(task(),/offline/);assert.equal(await task(),'retried');assert.equal(attempts,2);
});

test('confirmation remains visible for three seconds without WAAPI and resets reused popup opacity',()=>{
 const oldSet=globalThis.setTimeout,oldClear=globalThis.clearTimeout;let scheduled;
 globalThis.setTimeout=(fn,ms)=>{scheduled={fn,ms};return 1;};globalThis.clearTimeout=()=>{};
 try{
  let landed=0;const node={style:{opacity:'0'}};
  const flight=flyReceiptIntoTray(node,null,()=>landed++,true);
  assert.equal(node.style.opacity,'1');assert.equal(landed,0);assert.equal(scheduled.ms,3000);
  scheduled.fn();assert.equal(landed,1);flight.finishSoon();assert.equal(landed,1);
 }finally{globalThis.setTimeout=oldSet;globalThis.clearTimeout=oldClear;}
});
