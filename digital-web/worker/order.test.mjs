import test from 'node:test';
import assert from 'node:assert/strict';
import worker from './index.mjs';

const origin = 'https://digital.afyllx.com';
const path = '/api/dat-lam';
const form = {name: 'Người kiểm thử', contact: 'qa@example.com', need: 'Nhận đặt lịch', note: 'Tiệm tóc nhỏ, muốn khách đặt giờ online.'};

function post(body = form, requestOrigin = origin) {
 return new Request(origin + path, {
  method: 'POST',
  headers: {'Content-Type': 'application/json', Origin: requestOrigin},
  body: JSON.stringify(body),
 });
}

const okLimit = {limit: async () => ({success: true})};

test('báo không khả dụng khi thiếu binding', async () => {
 assert.deepEqual(await (await worker.fetch(new Request(origin + path), {})).json(), {available: false});
 assert.equal((await worker.fetch(post(), {})).status, 503);
});

test('một yêu cầu hợp lệ gửi đúng hộp thư cố định, trả lời về email khách', async () => {
 let calls = 0;
 const res = await worker.fetch(post({...form, to: 'other@example.com'}), {
  ORDER_RATE_LIMIT: okLimit,
  ORDER_EMAIL: {send: async email => {
   calls++;
   assert.equal(email.to, 'contact.afyllx@gmail.com');
   assert.equal(email.from.email, 'contact-form@afyllx.com');
   assert.equal(email.replyTo, form.contact);
   assert.match(email.subject, /Nhận đặt lịch — Người kiểm thử/);
   assert.match(email.text, /Tiệm tóc nhỏ/);
  }},
 });
 assert.equal(res.status, 200);
 assert.deepEqual(await res.json(), {ok: true});
 assert.equal(calls, 1);
});

test('số điện thoại được nhận, không đặt replyTo; xuống dòng trong tên bị bỏ khỏi tiêu đề', async () => {
 const res = await worker.fetch(post({...form, name: 'A\r\nBcc: x@y.z', contact: '0912 345 678', note: ''}), {
  ORDER_RATE_LIMIT: okLimit,
  ORDER_EMAIL: {send: async email => {
   assert.equal(email.replyTo, undefined);
   assert.doesNotMatch(email.subject, /[\r\n]/);
   assert.match(email.text, /Không có mô tả/);
  }},
 });
 assert.equal(res.status, 200);
});

test('khác nguồn, sai dữ liệu, bẫy bot, quá lớn và quá tần suất đều không gửi mail', async () => {
 const env = {ORDER_RATE_LIMIT: {limit: async () => ({success: false})}, ORDER_EMAIL: {send: () => assert.fail('email sent')}};
 for (const [req, status] of [
  [post(form, 'https://example.com'), 403],
  [post({...form, contact: 'abc'}), 400],
  [post({...form, need: 'Khác'}), 400],
  [post({...form, name: ''}), 400],
  [post({...form, website: 'spam'}), 400],
  [post({...form, note: 'a'.repeat(20_000)}), 400],
  [post(), 429],
 ]) assert.equal((await worker.fetch(req, env)).status, status);
});

test('route api khác trả 404, không đụng assets', async () => {
 const res = await worker.fetch(new Request(origin + '/api/khac'), {ASSETS: {fetch: () => assert.fail()}});
 assert.equal(res.status, 404);
});
