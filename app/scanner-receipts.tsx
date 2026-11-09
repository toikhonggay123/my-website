'use client';

import {useEffect,useLayoutEffect,useRef,useState,type RefObject} from 'react';
import {createPortal} from 'react-dom';
import {Check,ChevronUp,Clock3,History,Users,X} from 'lucide-react';
import {addReceipt,scanReceipt,flyReceiptIntoTray,RECEIPT_LIMIT} from '@/lib/scan-receipts.mjs';
import {LABELS,localClock} from '@/lib/mealcheck.mjs';
import './scanner-receipts.css';

type Receipt=NonNullable<ReturnType<typeof scanReceipt>>;
type Popup={requestId:string;meal:string;receipt:Receipt|null};
const time=new Intl.DateTimeFormat('vi-VN',{hour:'2-digit',minute:'2-digit',second:'2-digit',timeZone:'Asia/Ho_Chi_Minh'});
const reduce=()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function ScannerReceipts({space,meal,date='',target,onOpenChange}:{space:string;meal:string;date?:string;target:RefObject<HTMLDivElement|null>;onOpenChange:(open:boolean)=>void}){
 const [rows,setRows]=useState<Receipt[]>([]),[active,setActive]=useState<Popup|null>(null),[open,setOpen]=useState(false),[limit,setLimit]=useState(50);
 const trigger=useRef<HTMLButtonElement>(null),popup=useRef<HTMLDivElement>(null),dialog=useRef<HTMLDialogElement>(null);
 const sequence=useRef(0),sheetAnimation=useRef<Animation|null>(null);
 const context=useRef({meal,open,onOpenChange});context.current={meal,open,onOpenChange};
 const today=date||localClock().date,filtered=rows.filter(row=>row.date===today&&(!meal||row.meal===meal));
 const latest=filtered[0],activeId=active?.requestId;

 useEffect(()=>{
  const saved=(event:Event)=>{
   const detail=(event as CustomEvent).detail;
   if(detail?.space!==space||context.current.open||typeof detail.requestId!=='string')return;
   const scanMeal=String(detail.sessionId).split(':')[2];
   if(scanMeal===context.current.meal)setActive({requestId:detail.requestId,meal:scanMeal,receipt:null});
  };
  const ack=(event:Event)=>{
   const detail=(event as CustomEvent).detail;
   if(detail?.space!==space)return;
   const receipt=scanReceipt(detail.result,++sequence.current,Number.isFinite(detail.capturedAt)?detail.capturedAt:Date.now());
   if(!receipt)return;
   setRows(old=>addReceipt(old,receipt));
   setActive(current=>current&&current.requestId===detail.requestId?{...current,receipt}:current);
  };
  const failed=(event:Event)=>{
   const detail=(event as CustomEvent).detail;
   if(detail?.space===space)setActive(current=>current?.requestId===detail.requestId?null:current);
  };
  window.addEventListener('mealcheck-scan-saved',saved);
  window.addEventListener('mealcheck-scan-ack',ack);
  window.addEventListener('mealcheck-scan-failed',failed);
  return()=>{
   window.removeEventListener('mealcheck-scan-saved',saved);
   window.removeEventListener('mealcheck-scan-ack',ack);
   window.removeEventListener('mealcheck-scan-failed',failed);
  };
 },[space]);

 useLayoutEffect(()=>{
  if(!activeId||!popup.current||!trigger.current)return;
  const running=flyReceiptIntoTray(popup.current,trigger.current,()=>setActive(current=>current?.requestId===activeId?null:current),reduce());
  const resize=()=>running.finishSoon();
  window.addEventListener('resize',resize);document.addEventListener('fullscreenchange',resize);
  return()=>{running.cancel();window.removeEventListener('resize',resize);document.removeEventListener('fullscreenchange',resize);};
 },[activeId]);

 useEffect(()=>{setActive(null);},[meal]);
 useEffect(()=>()=>{sheetAnimation.current?.cancel();context.current.onOpenChange(false);},[]);

 function show(){
  if(!dialog.current||dialog.current.open)return;
  setActive(null);
  setLimit(50);dialog.current.showModal();setOpen(true);onOpenChange(true);
  const panel=dialog.current;
  sheetAnimation.current?.cancel();
  if(panel.animate)sheetAnimation.current=panel.animate(reduce()?[{opacity:0},{opacity:1}]:[{opacity:0,transform:'translateY(28px) scale(0.96)'},{opacity:1,transform:'translateY(-3px) scale(1.012)',offset:.74},{opacity:1,transform:'none'}],{duration:reduce()?90:250,easing:'cubic-bezier(0.32, 0.72, 0, 1)'});
 }
 function close(){
  const panel=dialog.current;if(!panel?.open)return;
  const style=getComputedStyle(panel),from={opacity:style.opacity,transform:style.transform};
  sheetAnimation.current?.cancel();
  const finish=()=>{panel.close();setOpen(false);onOpenChange(false);trigger.current?.focus({preventScroll:true});};
  if(!panel.animate){finish();return;}
  const animation=panel.animate(reduce()?[{opacity:from.opacity},{opacity:0}]:[from,{opacity:0,transform:'translateY(18px) scale(0.98)'}],{duration:reduce()?90:160,easing:'cubic-bezier(0.23, 1, 0.32, 1)'});
  sheetAnimation.current=animation;void animation.finished.then(finish).catch(()=>{});
 }

 return <div className="scan-receipts">
  <button ref={trigger} className="scan-receipt-tray" aria-haspopup="dialog" aria-expanded={open} aria-controls="scan-receipts-dialog" onClick={show}>
   <span className={'scan-receipt-icon '+(latest?'has-receipt':'')}><History size={22} aria-hidden="true"/></span>
   <span className="scan-receipt-summary"><span>Vừa quét <b>{filtered.length}</b></span><strong>{latest?latest.student.name:'Danh sách học sinh đã quét'}</strong><small>{latest?'Lớp '+latest.student.class+' · '+latest.student.code:'Kết quả đã được máy chủ xác nhận'}</small></span>
   <ChevronUp size={19} aria-hidden="true"/>
  </button>
  {active&&target.current&&createPortal(<div ref={popup} className={'scan-receipt-flight '+(active.receipt?.duplicate?'duplicate':'')} role="status" aria-live="polite" aria-atomic="true">
   <span className="receipt-confirm-icon"><Check size={24} strokeWidth={2.5} aria-hidden="true"/></span>
   {active.receipt?<div><span className="receipt-confirm-label">{active.receipt.duplicate?'Đã điểm danh buổi này':'Điểm danh thành công'}</span><strong>{active.receipt.student.name}</strong><span>Lớp {active.receipt.student.class} · {LABELS[active.meal as keyof typeof LABELS]}</span><small>{active.receipt.student.code}</small></div>
   :<div><strong>Đã quét thành công</strong><span>Đã lưu trên máy · Chờ đồng bộ</span><small>{LABELS[active.meal as keyof typeof LABELS]}</small></div>}
  </div>,target.current)}
  <dialog ref={dialog} id="scan-receipts-dialog" className="scan-receipts-dialog" aria-labelledby="scan-receipts-title" onCancel={event=>{event.preventDefault();close();}} onClick={event=>{if(event.target===event.currentTarget)close();}} onClose={()=>{setOpen(false);onOpenChange(false);}}>
   <header><div><span className="receipt-sheet-eyebrow">AFYLLX EDU MEALCHECK</span><h2 id="scan-receipts-title">Học sinh đã quét <span>{filtered.length}</span></h2></div><button className="receipt-sheet-close" aria-label="Đóng danh sách đã quét" onClick={close}><X size={21}/></button></header>
   <p className="receipt-sheet-note">{meal?LABELS[meal as keyof typeof LABELS]:'Các buổi hôm nay'} · Trong lần mở máy quét này. Đóng danh sách để tiếp tục quét.</p>
   <div className="receipt-sheet-list">{filtered.length?<><ul>{filtered.slice(0,limit).map(row=><li key={row.key}><span className={'receipt-row-check '+(row.duplicate?'duplicate':'')}><Check size={19} aria-hidden="true"/></span><div><strong>{row.student.name}</strong><span>Lớp {row.student.class} · {row.student.code}</span><small>{row.duplicate?'Đã có điểm danh':'Đã ghi nhận'} · {LABELS[row.meal as keyof typeof LABELS]}</small></div><time dateTime={new Date(row.observedAt).toISOString()}><Clock3 size={11} aria-hidden="true"/>{time.format(row.observedAt)}</time></li>)}</ul>{filtered.length>limit&&<button className="receipt-more" onClick={()=>setLimit(n=>n+50)}>Xem thêm {Math.min(50,filtered.length-limit)} học sinh</button>}</>:<div className="receipt-sheet-empty"><Users size={30} aria-hidden="true"/><strong>Chưa có học sinh được xác nhận</strong><p>Kết quả sẽ xuất hiện sau khi quét và được máy chủ ghi nhận.</p></div>}</div>
   <footer>{rows.length>=RECEIPT_LIMIT?'Hiển thị '+RECEIPT_LIMIT+' kết quả gần nhất. ':'Mỗi học sinh hiển thị một lần cho mỗi buổi. '}Lượt chờ mạng chưa được tính vào danh sách.</footer>
  </dialog>
 </div>;
}
