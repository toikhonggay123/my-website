export const contactPath = '/api/edu/contact';
const recipient = 'contact.afyllx@gmail.com';
const sender = 'contact-form@afyllx.com';
const topics = new Set(['Trải nghiệm MealCheck', 'Nhu cầu khác của nhà trường']);
const emailPattern = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+$/i;
const phonePattern = /^[0-9+\-\s()]{8,16}$/;
const maxBodyBytes = 16_384;

function json(body, status = 200, headers = {}) {
 return Response.json(body, {status, headers: {'Cache-Control': 'no-store', ...headers}});
}

async function readContact(request) {
 if (!request.body || Number(request.headers.get('Content-Length')) > maxBodyBytes) return null;
 const reader = request.body.getReader();
 const decoder = new TextDecoder();
 let bytes = 0;
 let raw = '';
 try {
  while (true) {
   const {value, done} = await reader.read();
   if (done) break;
   bytes += value.byteLength;
   if (bytes > maxBodyBytes) {
    await reader.cancel();
    return null;
   }
   raw += decoder.decode(value, {stream: true});
  }
  return JSON.parse(raw + decoder.decode());
 } catch {
  return null;
 } finally {
  reader.releaseLock();
 }
}

function textField(value, limit) {
 if (typeof value !== 'string') return '';
 const trimmed = value.trim();
 return trimmed.length <= limit ? trimmed : '';
}

export async function handleContact(request, env) {
 const available = Boolean(env.CONTACT_EMAIL && env.CONTACT_RATE_LIMIT);
 if (request.method === 'GET') return json({available});
 if (request.method !== 'POST') return json({ok: false}, 405, {Allow: 'GET, POST'});
 if (request.headers.get('Origin') !== new URL(request.url).origin) return json({ok: false}, 403);
 if (!available) return json({ok: false}, 503);
 if (request.headers.get('Content-Type')?.split(';', 1)[0].trim().toLowerCase() !== 'application/json') {
  return json({ok: false}, 415);
 }

 const body = await readContact(request);
 if (!body || typeof body !== 'object' || Array.isArray(body)) return json({ok: false}, 400);
 if (body.website) return json({ok: false}, 400);

 const institutionName = textField(body.institutionName, 160);
 const contactPerson = textField(body.contactPerson, 120);
 const contactChannel = textField(body.contactChannel, 254);
 const inquiryTopic = textField(body.inquiryTopic, 80);
 const message = textField(body.message, 3_000);
 const replyTo = emailPattern.test(contactChannel) ? contactChannel : undefined;
 const validPhone = phonePattern.test(contactChannel) && contactChannel.replace(/\D/g, '').length >= 8;
 if (!institutionName || !contactPerson || !(replyTo || validPhone) || !topics.has(inquiryTopic) || message.length < 10) {
  return json({ok: false}, 400);
 }

 try {
  const key = request.headers.get('CF-Connecting-IP') || 'unknown';
  const {success} = await env.CONTACT_RATE_LIMIT.limit({key});
  if (!success) return json({ok: false}, 429, {'Retry-After': '60'});

  await env.CONTACT_EMAIL.send({
   from: {email: sender, name: 'AFYLLX Edu'},
   to: recipient,
   subject: `[AFYLLX Edu] ${inquiryTopic}`,
   ...(replyTo ? {replyTo} : {}),
   text: [
    `Trường hoặc đơn vị: ${institutionName}`,
    `Người liên hệ: ${contactPerson}`,
    `Email / Điện thoại: ${contactChannel}`,
    `Nội dung trao đổi: ${inquiryTopic}`,
    '',
    message,
   ].join('\n'),
  });
  return json({ok: true});
 } catch (error) {
  const code = error?.code;
  console.warn('Edu contact email failed', typeof code === 'string' && /^E_[A-Z_]{1,64}$/.test(code) ? code : 'UNKNOWN');
  return json({ok: false}, 502);
 }
}
