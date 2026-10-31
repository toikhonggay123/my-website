import {utils,write} from 'xlsx';
import {MEALS,LABELS,SCHOOL} from './mealcheck.mjs';

const clock=at=>new Date(at).toLocaleTimeString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',hour:'2-digit',minute:'2-digit',second:'2-digit'});
// Explicit string cells preserve leading zeroes and never execute user text as formulas.
const text=value=>({t:'s',v:String(value??'')});
export function dailyWorkbook({date,space,students,records}){
 const wb=utils.book_new(),used=new Set();
 const append=(name,rows,widths)=>{
  const base=name.replace(/[\\/?*\[\]:]/g,'-').slice(0,31)||'Lop';let unique=base,index=2;
  while(used.has(unique.toLowerCase()))unique=base.slice(0,26)+'-'+index++;
  used.add(unique.toLowerCase());
  const ws=utils.aoa_to_sheet(rows.map(row=>row.map(v=>typeof v==='number'?v:text(v))));
  ws['!cols']=widths.map(wch=>({wch}));ws['!rows']=rows.map((_,i)=>({hpt:i<2?24:20}));
  ws['!margins']={left:.3,right:.3,top:.4,bottom:.4,header:.2,footer:.2};
  utils.book_append_sheet(wb,ws,unique);
 };
 const heading=title=>[[`AFYLLX MealCheck · ${title}`],[SCHOOL],[`Ngày ${date} · ${space==='demo'?'Dữ liệu thử nghiệm':'Dữ liệu chính thức'} · Giờ Việt Nam`],[]];
 const hits=new Map(records.map(r=>[r.student_id+'|'+r.meal,r]));
 const active=students.filter(s=>s.active),ids=new Set(active.map(s=>s.id));
 // Retain students with historical attendance even if they were disabled later today.
 const people=[...active];for(const r of records)if(!ids.has(r.student_id)){ids.add(r.student_id);people.push({id:r.student_id,code:r.code,name:r.name,grade:r.grade,class:r.class,active:0});}
 const compare=new Intl.Collator('vi',{numeric:true});
 people.sort((a,b)=>compare.compare(a.grade,b.grade)||compare.compare(a.class,b.class)||compare.compare(a.code,b.code));
 const groups=new Map();for(const s of people){const key=s.grade+'|'+s.class;if(!groups.has(key))groups.set(key,{grade:s.grade,class:s.class,students:[]});groups.get(key).students.push(s);}
 const summary=heading('Tổng hợp ngày');summary.push(['Khối','Lớp','HS đang học','Sáng đã','Sáng chưa','Trưa đã','Trưa chưa','Tối đã','Tối chưa']);
 const tally=rows=>MEALS.flatMap(m=>[rows.filter(s=>hits.has(s.id+'|'+m)).length,rows.filter(s=>s.active&&!hits.has(s.id+'|'+m)).length]);
 for(const g of groups.values())summary.push([g.grade,g.class,g.students.filter(s=>s.active).length,...tally(g.students)]);
 summary.push(['','TỔNG',active.length,...tally(people)],[],['Đã: gồm các lượt thực tế; Chưa: chỉ học sinh đang hoạt động chưa có lượt.'],['Danh sách bao gồm học sinh đã dừng hoạt động nếu có điểm danh hôm nay.']);
 append('TONG_HOP',summary,[12,16,18,14,14,14,14,14,14]);
 for(const m of MEALS){const rows=heading(LABELS[m]);rows.push(['STT','Mã học sinh','Họ tên','Khối','Lớp','Trạng thái','Giờ điểm danh','Người ghi nhận']);
  people.forEach((s,i)=>{const r=hits.get(s.id+'|'+m);rows.push([i+1,s.code,s.name,s.grade,s.class,r?'Đã điểm danh':'Chưa điểm danh',r?clock(r.confirmed_at):'',r?.teacher||'']);});
  append({sang:'BUA_SANG',trua:'BUA_TRUA',toi:'BUA_TOI'}[m],rows,[8,22,32,10,12,22,20,30]);
 }
 const detail=(rows,title)=>{const out=heading(title);out.push(['STT','Mã học sinh','Họ tên','Khối','Lớp','Bữa sáng','Giờ sáng','Bữa trưa','Giờ trưa','Bữa tối','Giờ tối']);rows.forEach((s,i)=>out.push([i+1,s.code,s.name,s.grade,s.class,...MEALS.flatMap(m=>{const r=hits.get(s.id+'|'+m);return [r?'Đã điểm danh':'Chưa điểm danh',r?clock(r.confirmed_at):''];})]));return out;};
 for(const g of groups.values())append('LOP_'+g.class,detail(g.students,'Lớp '+g.class),[8,22,32,10,12,22,16,22,16,22,16]);
 append('CHUA_DIEM_DANH',detail(active.filter(s=>MEALS.some(m=>!hits.has(s.id+'|'+m))),'Học sinh còn thiếu bữa'),[8,22,32,10,12,22,16,22,16,22,16]);
 return wb;
}
export function makeDailyXls(data){return new Uint8Array(write(dailyWorkbook(data),{bookType:'biff8',type:'array'}));}
