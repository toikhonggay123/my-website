'use client';
import {useState} from 'react';
import {makeDailyXls} from '@/lib/daily-report.mjs';

export default function ExportToday(){
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[done,setDone]=useState(false);
 async function download(){
  setBusy(true);setError('');setDone(false);
  try{
   const response=await fetch('/api/daily/today',{cache:'no-store'}),data:any=await response.json();
   if(!response.ok)throw Error(data.error||'Không tải được dữ liệu.');
   const bytes=makeDailyXls(data),url=URL.createObjectURL(new Blob([bytes as BlobPart],{type:'application/vnd.ms-excel'}));
   const link=document.createElement('a');link.href=url;link.download=`CheckIn-${data.space}-${data.date}.xls`;link.click();
   setTimeout(()=>URL.revokeObjectURL(url),60000);setDone(true);
  }catch(error:any){setError(error.message||'Không tạo được file Excel.');}finally{setBusy(false);}
 }
 return <main className="export-page"><section className="panel"><h1>Xuất danh sách Excel ngày hôm nay</h1><button className="primary" disabled={busy} onClick={()=>void download()}>{busy?'Đang tạo file…':'Tải danh sách .xls'}</button>{error&&<p role="alert">{error}</p>}{done&&<p role="status">Đã tạo file Excel. Nếu chưa thấy file, kiểm tra mục tải xuống của trình duyệt.</p>}<p><a className="text-button" href="/mealcheck">Về quản trị</a></p></section></main>;
}
