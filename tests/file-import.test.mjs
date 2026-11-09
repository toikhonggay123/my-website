import test from 'node:test';
import assert from 'node:assert/strict';
import {readXlsx,makeXlsx,parseCsv} from '../lib/files.mjs';
import {utils,write} from 'xlsx';
import {readSchoolRoster} from '../lib/student-import.mjs';
test('CSV xác định dấu phân cách ngoài dấu ngoặc kép',()=>{
 assert.deepEqual(parseCsv('code;"Tên, mã, khối, lớp, trạng thái, ghi chú";class\r\n001;"Học sinh mẫu";9A'),[['code','Tên, mã, khối, lớp, trạng thái, ghi chú','class'],['001','Học sinh mẫu','9A']]);
});

function schoolFile(rows, title='Lớp: 9B - GVCN: Giáo viên mẫu', formats={}){
 const sheet=utils.aoa_to_sheet([
  ['TRƯỜNG MẪU'],[],['DANH SÁCH HỌC SINH'],[title],[],[],
  ['STT','Mã học sinh','Họ và tên','Ngày sinh'],[],...rows
 ]);
 sheet['!merges']=[0,1,2,3].map(c=>({s:{r:6,c},e:{r:7,c}}));
 for(const [address,format] of Object.entries(formats))sheet[address].z=format;
 const book=utils.book_new();
 utils.book_append_sheet(book,sheet,'ds học sinh');
 utils.book_append_sheet(book,utils.aoa_to_sheet([['Mã học sinh','Họ và tên'],['unused','Danh mục']]),'Danh mục');
 return new Blob([write(book,{type:'array',bookType:'biff8'})]);
}

test('Đọc danh sách XLS của trường, giữ mã có số 0 và suy ra khối từ tên lớp',async()=>{
 const roster=await readSchoolRoster(schoolFile([
  [1,'000123','Nguyễn Văn Mẫu','01/01/2012'],[],[2,789,'Hoàng Thị Mẫu','02/01/2012']
 ],undefined,{B11:'000000'}));
 assert.deepEqual(roster,{grade:'9',className:'9B',rows:[
  {code:'000123',name:'Nguyễn Văn Mẫu',grade:'9',class:'9B'},
  {code:'000789',name:'Hoàng Thị Mẫu',grade:'9',class:'9B'}
 ]});
});

test('Danh sách XLS lỗi ghi đúng dòng và không trả về dữ liệu nhập một phần',async()=>{
 await assert.rejects(readSchoolRoster(schoolFile([[1,'000123','Học sinh mẫu'],[2,'000123','Học sinh khác']])),/Dòng 10.*trùng/);
 await assert.rejects(readSchoolRoster(schoolFile([[1,'','Học sinh mẫu']])),/Dòng 9.*mã học sinh/i);
 await assert.rejects(readSchoolRoster(schoolFile([[1,789,'Học sinh mẫu']],undefined,{B9:'"HS"0000'})),/Dòng 9.*văn bản/);
 await assert.rejects(readSchoolRoster(schoolFile([[1,'000123','Học sinh mẫu']],'Năm học 2026')),/tên lớp/i);
 await assert.rejects(readSchoolRoster(new Blob(['STT,Mã học sinh,Họ và tên'])),/Excel/);
});
test('Excel ngắn, thiếu cấu trúc ZIP hoặc sai offset được báo lỗi dễ hiểu',async()=>{
 for(const size of [0,8,21,22,40,65558])await assert.rejects(readXlsx(new Blob([new Uint8Array(size)])),/Excel không hợp lệ/);
 const bytes=makeXlsx([['Mã học sinh'],['001']]);
 const offset=bytes.slice();new DataView(offset.buffer).setUint32(offset.length-6,0xffffffff,true);
 await assert.rejects(readXlsx(new Blob([offset])),/Excel không hợp lệ/);
 const corrupt=bytes.slice();corrupt[30+new DataView(corrupt.buffer).getUint16(26,true)]^=1;
 await assert.rejects(readXlsx(new Blob([corrupt])),/Excel không hợp lệ/);
});
