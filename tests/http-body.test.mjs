import test from 'node:test';
import assert from 'node:assert/strict';
import {readJsonBody} from '../lib/http-body.mjs';
const request=body=>new Request('https://example.test/api/students',{method:'POST',body});
test('JSON đầu vào phải là đối tượng; dữ liệu rỗng vẫn được hỗ trợ',async()=>{
 assert.deepEqual(await readJsonBody(request('')),{});
 assert.deepEqual(await readJsonBody(request('{"rows":[]}')),{rows:[]});
 for(const body of ['null','[]','42','"hello"','{'])await assert.rejects(readJsonBody(request(body)),e=>e.status===400);
});
test('Giới hạn POST được tính theo byte kể cả không có Content-Length',async()=>{
 let cancelled=false;
 const stream=new ReadableStream({pull(controller){controller.enqueue(new TextEncoder().encode('á'.repeat(100)));},cancel(){cancelled=true;}});
 const req=new Request('https://example.test/api/students',{method:'POST',body:stream,duplex:'half'});
 await assert.rejects(readJsonBody(req,300),e=>e.status===413);
 assert.equal(cancelled,true);
});
test('JSON UTF-8 tách giữa ký tự nhiều byte vẫn được đọc chính xác',async()=>{
 const bytes=new TextEncoder().encode('{"name":"Đặng Ánh"}');
 const stream=new ReadableStream({start(controller){for(const byte of bytes)controller.enqueue(Uint8Array.of(byte));controller.close();}});
 const req=new Request('https://example.test',{method:'POST',body:stream,duplex:'half'});
 assert.deepEqual(await readJsonBody(req),{name:'Đặng Ánh'});
});
