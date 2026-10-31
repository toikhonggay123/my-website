import test from 'node:test';
import assert from 'node:assert/strict';
import {read,utils} from 'xlsx';
import {makeDailyXls} from '../lib/daily-report.mjs';
const students=[{id:'demo:1',code:'0001',name:'Nguyễn Thị Ánh',grade:'9',class:'9B',active:1},{id:'demo:2',code:'=1+1',name:'Đặng Văn Đạt',grade:'10',class:'10A',active:1},{id:'demo:3',code:'003',name:'Đã nghỉ',grade:'9',class:'9B',active:0}];
const records=[{student_id:'demo:1',code:'0001',name:'Nguyễn Thị Ánh',grade:'9',class:'9B',meal:'sang',confirmed_at:Date.parse('2026-10-31T00:15:00Z'),teacher:'Giáo viên thử'}];
test('XLS nhị phân có tổng hợp, từng bữa/lớp và thiếu bữa; giữ Unicode, mã 0 đầu và chặn công thức',()=>{
 const bytes=makeDailyXls({date:'2026-10-31',space:'demo',students,records});
 assert.equal(Buffer.from(bytes.slice(0,8)).toString('hex'),'d0cf11e0a1b11ae1');
 const wb=read(bytes,{type:'array'}),rows=name=>utils.sheet_to_json(wb.Sheets[name],{header:1,defval:''});
 assert.deepEqual(wb.SheetNames,['TONG_HOP','BUA_SANG','BUA_TRUA','BUA_TOI','LOP_9B','LOP_10A','CHUA_DIEM_DANH']);
 assert.deepEqual(rows('TONG_HOP')[5],['9','9B',1,1,0,0,1,0,1]);
 assert.deepEqual(rows('TONG_HOP')[7],['','TỔNG',2,1,1,0,2,0,2]);
 assert.equal(rows('BUA_SANG')[5][1],'0001');assert.equal(rows('BUA_SANG')[5][2],'Nguyễn Thị Ánh');
 assert.equal(rows('BUA_SANG')[5][6],'07:15:00');assert.equal(rows('BUA_SANG')[6][5],'Chưa điểm danh');
 assert.equal(wb.Sheets.BUA_SANG.B7.v,'=1+1');assert.equal(wb.Sheets.BUA_SANG.B7.f,undefined);
 assert.equal(rows('CHUA_DIEM_DANH').length,7);
});
test('Ngày chưa có điểm danh vẫn xuất đủ danh sách và ba bữa, dữ liệu rỗng vẫn mở được',()=>{
 const wb=read(makeDailyXls({date:'2026-11-01',space:'live',students,records:[]}),{type:'array'});
 const rows=utils.sheet_to_json(wb.Sheets.BUA_TOI,{header:1});assert.equal(rows.length,7);assert.equal(rows[5][5],'Chưa điểm danh');
 const empty=read(makeDailyXls({date:'2026-11-01',space:'live',students:[],records:[]}),{type:'array'});assert.equal(empty.SheetNames.length,5);
});
