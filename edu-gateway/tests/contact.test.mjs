import test from 'node:test';
import assert from 'node:assert/strict';
import worker, {isMealCheckPath} from '../worker/index.mjs';

const origin = 'https://edu.afyllx.com';
const path = '/api/edu/contact';
const form = {
 institutionName: 'Trường kiểm thử',
 contactPerson: 'Người kiểm thử',
 contactChannel: 'qa@example.com',
 inquiryTopic: 'Trải nghiệm MealCheck',
 message: 'Nội dung kiểm thử chức năng gửi liên hệ.',
};

function post(body = form, requestOrigin = origin) {
 return new Request(origin + path, {
  method: 'POST',
  headers: {'Content-Type': 'application/json', Origin: requestOrigin},
  body: JSON.stringify(body),
 });
}

test('contact is handled by Edu and advertises availability only with both bindings', async () => {
 assert.equal(isMealCheckPath(path), false);
 const request = new Request(origin + path);
 assert.deepEqual(await (await worker.fetch(request, {})).json(), {available: false});
 assert.equal((await worker.fetch(post(), {})).status, 503);
});

test('one valid submission sends to the fixed inbox and uses the supplied email for replies', async () => {
 let calls = 0;
 const response = await worker.fetch(post({...form, to: 'other@example.com'}), {
  CONTACT_RATE_LIMIT: {limit: async () => ({success: true})},
  CONTACT_EMAIL: {send: async email => {
   calls++;
   assert.equal(email.to, 'contact.afyllx@gmail.com');
   assert.equal(email.from.email, 'contact-form@afyllx.com');
   assert.equal(email.replyTo, form.contactChannel);
   assert.match(email.text, /Trường kiểm thử/);
   assert.ok(email.text.endsWith(form.message));
  }},
 });
 assert.equal(response.status, 200);
 assert.deepEqual(await response.json(), {ok: true});
 assert.equal(calls, 1);
});

test('cross-origin, invalid, honeypot, oversized and rate-limited posts never call the mail binding', async () => {
 const env = {
  CONTACT_RATE_LIMIT: {limit: async () => ({success: false})},
  CONTACT_EMAIL: {send: () => assert.fail('email sent unexpectedly')},
 };
 for (const [request, status] of [
  [post(form, 'https://example.com'), 403],
  [post({...form, contactChannel: 'not a phone'}), 400],
  [post({...form, website: 'spam'}), 400],
  [post({...form, message: 'a'.repeat(20_000)}), 400],
  [post(), 429],
 ]) assert.equal((await worker.fetch(request, env)).status, status);
});

test('a rejected mail does not report success', async () => {
 const response = await worker.fetch(post({...form, contactChannel: '0901234567'}), {
  CONTACT_RATE_LIMIT: {limit: async () => ({success: true})},
  CONTACT_EMAIL: {send: async email => {
   assert.equal(email.replyTo, undefined);
   throw Error('provider unavailable');
  }},
 });
 assert.equal(response.status, 502);
 assert.deepEqual(await response.json(), {ok: false});
});
