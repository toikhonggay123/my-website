'use client';
import {useState} from 'react';
import {Download,LoaderCircle} from 'lucide-react';
import {SCHOOL} from '@/lib/mealcheck.mjs';
import {downloadStudentCard} from './student-card-image';

export type StudentCard={id:string;code:string;name:string;grade:string;class:string;image:string};
export function StudentQRCard({card,demo=false,onReissue}:{card:StudentCard;demo?:boolean;onReissue?:()=>void}){
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 async function download(){setBusy(true);setError('');try{await downloadStudentCard(card,demo);}catch{setError('Chưa tải được ảnh thẻ. Vui lòng thử lại.');}finally{setBusy(false);}}
 return <div className="qr-card-item">
  <article className="student-id-card" aria-label={'Thẻ học sinh '+card.name}>
   <div className="qr-card-code-area"><div className="qr-card-qr"><img src={card.image} alt={'QR điểm danh của '+card.name} width={600} height={600}/></div><span>QUÉT MÃ ĐỂ ĐIỂM DANH</span></div>
   <div className="qr-card-info"><div className="qr-card-brand"><img src="/brand/afyllx-logo.png" alt="" width="24" height="24"/><span>AFYLLX <em>MealCheck</em></span></div><p className="qr-card-school">{SCHOOL}</p><span className="qr-card-type">THẺ HỌC SINH</span><h2 className={card.name.length>30?'long-name':''}>{card.name}</h2><div className="qr-card-class"><span>LỚP <b>{card.class}</b></span><span>KHỐI <b>{card.grade}</b></span></div><div className="qr-card-student-code"><span>MÃ HỌC SINH</span><b>{card.code}</b></div>{demo&&<span className="qr-card-footer">DỮ LIỆU THỬ NGHIỆM</span>}</div>
  </article>
  <div className="qr-card-actions"><button className="secondary" disabled={busy} onClick={()=>void download()}>{busy?<LoaderCircle className="spin" size={15}/>:<Download size={15}/>}Tải thẻ PNG</button>{onReissue&&<button className="text-button" onClick={onReissue}>Cấp lại QR</button>}</div>
  {error&&<p className="qr-card-download-error" role="alert">{error}</p>}
 </div>;
}
