import test from 'node:test';
import assert from 'node:assert/strict';
import {CFB,read,utils} from 'xlsx';
import {makeDailyXls} from '../lib/daily-report.mjs';
const students=[{id:'demo:1',code:'0001',name:'Nguyễn Thị Ánh',grade:'9',class:'9B',active:1},{id:'demo:2',code:'=1+1',name:'Đặng Văn Đạt',grade:'10',class:'10A',active:1},{id:'demo:3',code:'003',name:'Đã nghỉ',grade:'9',class:'9B',active:0}];
const records=[{student_id:'demo:1',code:'0001',name:'Nguyễn Thị Ánh',grade:'9',class:'9B',meal:'sang',confirmed_at:Date.parse('2026-10-31T00:15:00Z'),teacher:'Giáo viên thử'}];
test('XLS nhị phân có tổng hợp, từng bữa/lớp và thiếu bữa; giữ Unicode, mã 0 đầu và chặn công thức',()=>{
 const bytes=makeDailyXls({date:'2026-10-31',space:'demo',students,records});
 assert.equal(Buffer.from(bytes.slice(0,8)).toString('hex'),'d0cf11e0a1b11ae1');
 const wb=read(bytes,{type:'array'}),rows=name=>utils.sheet_to_json(wb.Sheets[name],{header:1,defval:''});
 assert.deepEqual(wb.SheetNames,['Tổng hợp','Bữa sáng','Bữa trưa','Bữa tối','Lớp 9B','Lớp 10A','Chưa đủ ba bữa']);
 assert.deepEqual(rows('Tổng hợp')[7],['9','9B',1,1,0,0,1,0,1]);
 assert.deepEqual(rows('Tổng hợp')[9],['TỔNG CỘNG','',2,1,1,0,2,0,2]);
 assert.equal(rows('Bữa sáng')[7][1],'0001');assert.equal(rows('Bữa sáng')[7][2],'Nguyễn Thị Ánh');
 assert.equal(rows('Bữa sáng')[7][6],'07:15:00');assert.equal(rows('Bữa sáng')[8][5],'Chưa điểm danh');
 assert.equal(wb.Sheets['Bữa sáng'].B9.v,'=1+1');assert.equal(wb.Sheets['Bữa sáng'].B9.f,undefined);
 assert.equal(rows('Chưa đủ ba bữa').length,9);
});
test('Ngày chưa có điểm danh vẫn xuất đủ danh sách và ba bữa, dữ liệu rỗng vẫn mở được',()=>{
 const wb=read(makeDailyXls({date:'2026-11-01',space:'live',students,records:[]}),{type:'array'});
 const rows=utils.sheet_to_json(wb.Sheets['Bữa tối'],{header:1});assert.equal(rows.length,9);assert.equal(rows[7][5],'Chưa điểm danh');
 const empty=read(makeDailyXls({date:'2026-11-01',space:'live',students:[],records:[]}),{type:'array'});assert.equal(empty.SheetNames.length,5);
});

test('Bố cục XLS giữ nhóm bữa, định dạng đọc được, cố định tiêu đề và chỉ chọn trang Tổng hợp',()=>{
 const bytes=makeDailyXls({date:'2026-10-31',space:'demo',students,records});
 const wb=read(bytes,{type:'array',cellStyles:true}),ws=wb.Sheets['Tổng hợp'];
 assert.equal(ws.A3.v,'Ngày 31/10/2026  ·  DỮ LIỆU THỬ NGHIỆM');
 assert.ok(ws['!merges'].some(r=>r.s.r===5&&r.s.c===3&&r.e.c===4));
 assert.equal(ws.D6.s.fgColor.rgb,'3264E6');assert.equal(ws.A10.s.fgColor.rgb,'EAF0FD');
 assert.equal(ws['!rows'][1].hpt,32);assert.equal(ws['!rows'][6].hpt,29);
 const stream=Buffer.from(CFB.find(CFB.read(bytes,{type:'array'}),'Workbook').content);
 const windows=[],panes=[];let pos=0;
 while(pos+4<=stream.length){const id=stream.readUInt16LE(pos),len=stream.readUInt16LE(pos+2);if(!id&&!len)break;if(id===0x023e)windows.push(stream.readUInt16LE(pos+4));if(id===0x0041)panes.push(stream.readUInt16LE(pos+6));pos+=len+4;}
 assert.equal(windows.filter(flags=>flags&0x0200).length,1);
 assert.ok(windows[0]&0x0200);assert.ok(windows.every(flags=>(flags&0x0108)===0x0108));
 assert.deepEqual(panes,wb.SheetNames.map(()=>7));
});

test('Tổng hợp giữ lượt đã ghi của học sinh ngừng theo dõi, không tính em đó vào số chưa điểm danh',()=>{
 const history={...records[0],student_id:'demo:3',code:'003',name:'Đã nghỉ'};
 const wb=read(makeDailyXls({date:'2026-10-31',space:'live',students,records:[...records,history]}),{type:'array'});
 const summary=utils.sheet_to_json(wb.Sheets['Tổng hợp'],{header:1});
 assert.deepEqual(summary[7],['9','9B',1,2,0,0,1,0,1]);
 assert.equal(utils.sheet_to_json(wb.Sheets['Bữa sáng'],{header:1}).length,10);
 assert.equal(utils.sheet_to_json(wb.Sheets['Chưa đủ ba bữa'],{header:1}).length,9);
});
