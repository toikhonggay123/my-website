import {utils,write} from 'xlsx';
import {MEALS,LABELS,SCHOOL} from './mealcheck.mjs';
import {formatDailyBiff} from './daily-report-biff.mjs';

const clock=at=>new Date(at).toLocaleTimeString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',hour:'2-digit',minute:'2-digit',second:'2-digit'});
const text=value=>({t:'s',v:String(value??'')});
const range=(r,c,er,ec)=>({s:{r,c},e:{r:er,c:ec}});
export function dailyWorkbook({date,space,students,records}){
 const wb=utils.book_new(),used=new Set(),displayDate=date.split('-').reverse().join('/');
 const append=(name,rows,widths,merges,report)=>{
  const base=name.replace(/[\\/?*\[\]:]/g,'-').slice(0,31)||'Lớp';let unique=base,index=2;
  while(used.has(unique.toLowerCase()))unique=base.slice(0,26)+'-'+index++;
  used.add(unique.toLowerCase());
  // Explicit strings retain leading zeroes and keep user text out of formulas.
  const ws=utils.aoa_to_sheet(rows.map(row=>Array.from({length:widths.length},(_,c)=>typeof row[c]==='number'?row[c]:text(row[c]))));
  ws['!cols']=widths.map(wch=>({wch}));
  ws['!rows']=rows.map((_,i)=>({hpt:i===1?32:i===4?10:i===5||i===6?29:i<4?24:23}));
  ws['!margins']={left:.3,right:.3,top:.4,bottom:.4,header:.2,footer:.2};
  ws['!merges']=[...Array.from({length:4},(_,r)=>range(r,0,r,widths.length-1)),...merges];
  ws['!report']=report;
  utils.book_append_sheet(wb,ws,unique);
 };
 const heading=(title,description)=>[[SCHOOL],[title],[`Ngày ${displayDate}  ·  ${space==='demo'?'DỮ LIỆU THỬ NGHIỆM':'DỮ LIỆU CHÍNH THỨC'}`],[description],[]];
 const hits=new Map(records.map(r=>[r.student_id+'|'+r.meal,r]));
 const active=students.filter(s=>s.active),ids=new Set(active.map(s=>s.id));
 const people=[...active];for(const r of records)if(!ids.has(r.student_id)){ids.add(r.student_id);people.push({id:r.student_id,code:r.code,name:r.name,grade:r.grade,class:r.class,active:0});}
 const compare=new Intl.Collator('vi',{numeric:true});
 people.sort((a,b)=>compare.compare(a.grade,b.grade)||compare.compare(a.class,b.class)||compare.compare(a.code,b.code));
 const groups=new Map();for(const s of people){const key=s.grade+'|'+s.class;if(!groups.has(key))groups.set(key,{grade:s.grade,class:s.class,students:[]});groups.get(key).students.push(s);}
 const tally=list=>MEALS.flatMap(m=>[list.filter(s=>hits.has(s.id+'|'+m)).length,list.filter(s=>s.active&&!hits.has(s.id+'|'+m)).length]);
 const summary=heading('BÁO CÁO ĐIỂM DANH SUẤT ĂN',`Học sinh đang theo dõi: ${active.length}  ·  Mỗi học sinh được ghi nhận một lượt cho mỗi bữa.`);
 summary.push(['Khối','Lớp','Học sinh đang theo dõi','Bữa sáng','','Bữa trưa','','Bữa tối',''],['','','','Đã điểm danh','Chưa điểm danh','Đã điểm danh','Chưa điểm danh','Đã điểm danh','Chưa điểm danh']);
 for(const g of groups.values())summary.push([g.grade,g.class,g.students.filter(s=>s.active).length,...tally(g.students)]);
 const totalRow=summary.length;
 summary.push(['TỔNG CỘNG','',active.length,...tally(people)],[],['Đã điểm danh: số học sinh có lượt ghi nhận cho từng bữa.'],['Chưa điểm danh: học sinh đang được theo dõi chưa có lượt ghi nhận cho bữa đó.']);
 if(people.some(s=>!s.active))summary.push(['Học sinh đã ngừng theo dõi vẫn có trong báo cáo nếu đã điểm danh trong ngày.']);
 summary.push(['AFYLLX MealCheck · Báo cáo theo giờ Việt Nam']);
 const summaryMerges=[range(5,0,6,0),range(5,1,6,1),range(5,2,6,2),...MEALS.map((_,i)=>range(5,3+2*i,5,4+2*i)),range(totalRow,0,totalRow,1),...summary.slice(totalRow+2).map((_,i)=>range(totalRow+2+i,0,totalRow+2+i,8))];
 append('Tổng hợp',summary,[9,12,19,17,17,17,17,17,17],summaryMerges,{kind:'summary',lastData:totalRow-1,totalRow});
 for(const m of MEALS){
  const [done,missing]=tally(people).slice(MEALS.indexOf(m)*2,MEALS.indexOf(m)*2+2);
  const rows=heading(`DANH SÁCH ĐIỂM DANH ${LABELS[m].toLocaleUpperCase('vi-VN')}`,`Đã điểm danh: ${done}  ·  Chưa điểm danh: ${missing}  ·  Học sinh đang theo dõi: ${active.length}`);
  rows.push(['THÔNG TIN HỌC SINH','','','','','KẾT QUẢ ĐIỂM DANH','',''],['STT','Mã học sinh','Họ và tên','Khối','Lớp','Trạng thái điểm danh','Giờ ghi nhận','Người ghi nhận']);
  people.forEach((s,i)=>{const r=hits.get(s.id+'|'+m);rows.push([i+1,s.code,s.name,s.grade,s.class,r?'Đã điểm danh':'Chưa điểm danh',r?clock(r.confirmed_at):'',r?.teacher||'']);});
  append(LABELS[m],rows,[7,18,30,8,10,23,17,28],[range(5,0,5,4),range(5,5,5,7)],{kind:'meal',lastData:rows.length-1});
 }
 const detail=(list,title)=>{
  const out=heading(title,`Danh sách: ${list.length} học sinh  ·  Đối chiếu trạng thái và giờ ghi nhận của từng bữa.`);
  out.push(['THÔNG TIN HỌC SINH','','','','','Bữa sáng','','Bữa trưa','','Bữa tối',''],['STT','Mã học sinh','Họ và tên','Khối','Lớp','Trạng thái','Giờ ghi nhận','Trạng thái','Giờ ghi nhận','Trạng thái','Giờ ghi nhận']);
  list.forEach((s,i)=>out.push([i+1,s.code,s.name,s.grade,s.class,...MEALS.flatMap(m=>{const r=hits.get(s.id+'|'+m);return [r?'Đã điểm danh':'Chưa điểm danh',r?clock(r.confirmed_at):''];})]));
  return out;
 };
 const detailMerges=[range(5,0,5,4),...MEALS.map((_,i)=>range(5,5+2*i,5,6+2*i))];
 for(const g of groups.values()){
  const rows=detail(g.students,`ĐIỂM DANH SUẤT ĂN · LỚP ${g.class}`);
  append('Lớp '+g.class,rows,[7,18,30,8,10,21,16,21,16,21,16],detailMerges,{kind:'detail',lastData:rows.length-1});
 }
 const missing=active.filter(s=>MEALS.some(m=>!hits.has(s.id+'|'+m))).sort((a,b)=>compare.compare(a.grade,b.grade)||compare.compare(a.class,b.class)||compare.compare(a.code,b.code));
 const rows=detail(missing,'HỌC SINH CHƯA ĐIỂM DANH ĐỦ BA BỮA');
 append('Chưa đủ ba bữa',rows,[7,18,30,8,10,21,16,21,16,21,16],detailMerges,{kind:'detail',lastData:rows.length-1});
 return wb;
}
export function makeDailyXls(data){
 const wb=dailyWorkbook(data);
 return formatDailyBiff(new Uint8Array(write(wb,{bookType:'biff8',type:'array'})),wb);
}
