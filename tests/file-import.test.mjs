import test from 'node:test';
import assert from 'node:assert/strict';
import {readXlsx,makeXlsx,parseCsv} from '../lib/files.mjs';
test('CSV xác định dấu phân cách ngoài dấu ngoặc kép',()=>{
 assert.deepEqual(parseCsv('code;"Tên, mã, khối, lớp, trạng thái, ghi chú";class\r\n001;"Học sinh mẫu";9A'),[['code','Tên, mã, khối, lớp, trạng thái, ghi chú','class'],['001','Học sinh mẫu','9A']]);
});
test('Excel ngắn, thiếu cấu trúc ZIP hoặc sai offset được báo lỗi dễ hiểu',async()=>{
 for(const size of [0,8,21,22,40,65558])await assert.rejects(readXlsx(new Blob([new Uint8Array(size)])),/Excel không hợp lệ/);
 const bytes=makeXlsx([['Mã học sinh'],['001']]);
 const offset=bytes.slice();new DataView(offset.buffer).setUint32(offset.length-6,0xffffffff,true);
 await assert.rejects(readXlsx(new Blob([offset])),/Excel không hợp lệ/);
 const corrupt=bytes.slice();corrupt[30+new DataView(corrupt.buffer).getUint16(26,true)]^=1;
 await assert.rejects(readXlsx(new Blob([corrupt])),/Excel không hợp lệ/);
});
