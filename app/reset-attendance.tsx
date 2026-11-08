'use client';
import {useEffect,useRef,useState} from 'react';
import {RotateCcw,X,LoaderCircle,ArchiveRestore} from 'lucide-react';
type Row=Record<string,any>;
async function call(path:string,body?:Row):Promise<any>{const response=await fetch('/api/attendance/'+path,{method:body?'POST':'GET',cache:'no-store',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined});const result:any=await response.json();if(!response.ok)throw Error(result.error||'Không xử lý được yêu cầu.');return result;}
export function ResetAttendance({space,onReset}:{space:string;onReset:()=>Promise<void>}){
 const dialog=useRef<HTMLDialogElement>(null),cancel=useRef<HTMLButtonElement>(null);
 const [preview,setPreview]=useState<Row|null>(null),[backups,setBackups]=useState<Row[]>([]),[mode,setMode]=useState('reset'),[chosen,setChosen]=useState<Row|null>(null),[busy,setBusy]=useState(false),[loading,setLoading]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const suffix='?space='+space;
 useEffect(()=>{dialog.current?.close();setError('');setNotice('');},[space]);
 async function open(next:string){setMode(next);setChosen(null);setPreview(null);setBackups([]);setError('');setNotice('');setLoading(true);dialog.current?.showModal();cancel.current?.focus();try{if(next==='reset')setPreview(await call('reset-preview'+suffix));else setBackups(await call('reset-backups'+suffix));}catch(e){setError((e as Error).message);}finally{setLoading(false);}}
 async function submit(){
  if(busy||loading||(!preview&&mode==='reset')||(!chosen&&mode==='restore'))return;setBusy(true);setError('');
  try{
   const result=mode==='reset'?await call('reset-today'+suffix,{confirmDate:preview!.date}):await call('restore-reset'+suffix,{backupId:chosen!.id});
   dialog.current?.close();setNotice(mode==='reset'?`Đã đặt lại ${result.removed} lượt. Bản sao đã lưu trong hệ thống.`:`Đã khôi phục ${result.restored} lượt; ${result.skipped} lượt đã có hoặc không còn phù hợp được giữ nguyên.`);
   try{await onReset();}catch{setNotice('Đã xử lý. Vui lòng tải lại trang để cập nhật số liệu.');}
  }catch(e){setError((e as Error).message);}finally{setBusy(false);}
 }
 return <div className="reset-attendance"><button className="secondary reset-trigger" onClick={()=>void open('reset')}><RotateCcw size={16}/>Đặt lại</button><button className="secondary" onClick={()=>void open('restore')}><ArchiveRestore size={16}/>Khôi phục sau đặt lại</button>{notice&&<p className="reset-notice" role="status">{notice}</p>}
 <dialog ref={dialog} className="reset-dialog" aria-labelledby="reset-title" aria-describedby="reset-description" onCancel={e=>{if(busy)e.preventDefault();}}>
 <div className="reset-dialog-heading"><span className="reset-dialog-icon"><RotateCcw size={25}/></span><button className="text-button" aria-label="Đóng xác nhận đặt lại" disabled={busy} onClick={()=>dialog.current?.close()}><X size={20}/></button></div>
 <h2 id="reset-title">{mode==='reset'?'Xác nhận đặt lại trạng thái điểm danh ngày hôm nay?':'Khôi phục điểm danh từ bản sao'}</h2>
 <p id="reset-description">{mode==='reset'?<>Đặt lại cả ba buổi ngày <strong>{preview?.date||'hôm nay'}</strong> trong <strong>{space==='demo'?'môi trường thử nghiệm':'dữ liệu chính thức'}</strong>. Hệ thống lưu bản sao trước khi xóa; nếu lưu thất bại, việc đặt lại sẽ dừng.</>:<>Chỉ bổ sung các lượt còn thiếu. Các lượt mới phát sinh, danh sách học sinh và thẻ QR được giữ nguyên. Yêu cầu cũ không được mở lại để chờ duyệt.</>}</p>
 {loading&&<p role="status"><LoaderCircle className="spin" size={18}/>Đang kiểm tra dữ liệu…</p>}
 {mode==='reset'&&preview&&<p className="reset-preview"><strong>{preview.attendance} lượt điểm danh</strong> sẽ được đặt lại. Số lượt được kiểm tra lại khi thực hiện.</p>}
 {mode==='restore'&&!loading&&<div className="backup-list">{backups.length?backups.map(b=><label key={b.id}><input type="radio" name="backup" disabled={busy||!!b.restored} checked={chosen?.id===b.id} onChange={()=>setChosen(b)}/><span><b>{b.date} · {b.attendance} lượt</b><small>Lưu lúc {new Date(b.at).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'})}{b.restored?' · Đã khôi phục':''}</small></span></label>):<p>Chưa có bản sao từ thao tác đặt lại. Bản sao sẽ tự tạo cho những lần đặt lại từ bây giờ.</p>}</div>}
 {error&&<p className="alert" role="alert">{error}</p>}
 <div className="reset-dialog-actions"><button ref={cancel} className="secondary" disabled={busy} onClick={()=>dialog.current?.close()}>Hủy</button><button className={'primary '+(mode==='reset'?'reset-confirm':'')} disabled={busy||loading||(mode==='reset'?!preview:!chosen)} onClick={()=>void submit()}>{busy?<LoaderCircle className="spin" size={17}/>:<RotateCcw size={17}/>} {busy?'Đang xử lý…':mode==='reset'?'Xác nhận đặt lại':'Khôi phục bản đã chọn'}</button></div></dialog></div>;
}
