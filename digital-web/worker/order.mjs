import {formatOrderEmail, validateOrder} from './order-schema.mjs';

// Nhận yêu cầu "Đặt làm website" và gửi thẳng tới hộp thư AFYLLX qua Cloudflare Email Routing.
export const orderPath = '/api/dat-lam';
const recipient = 'contact.afyllx@gmail.com';
const sender = 'contact-form@afyllx.com';
const maxBodyBytes = 16_384;

function json(body, status = 200, headers = {}) {
 return Response.json(body, {status, headers: {'Cache-Control': 'no-store', ...headers}});
}

async function readJson(request) {
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

export async function handleOrder(request, env) {
 const available = Boolean(env.ORDER_EMAIL && env.ORDER_RATE_LIMIT);
 if (request.method === 'GET') return json({available});
 if (request.method !== 'POST') return json({ok: false}, 405, {Allow: 'GET, POST'});
 if (request.headers.get('Origin') !== new URL(request.url).origin) return json({ok: false}, 403);
 if (!available) return json({ok: false}, 503);
 if (request.headers.get('Content-Type')?.split(';', 1)[0].trim().toLowerCase() !== 'application/json') {
  return json({ok: false}, 415);
 }

 const body = await readJson(request);
 if (!body || typeof body !== 'object' || Array.isArray(body)) return json({ok: false}, 400);
 if (body.website) return json({ok: false}, 400); // ô bẫy bot, người thật không thấy

 const {errors, value} = validateOrder(body);
 if (Object.keys(errors).length) return json({ok: false, error: 'invalid', fields: Object.keys(errors)}, 400);

 try {
  const key = request.headers.get('CF-Connecting-IP') || 'unknown';
  const {success} = await env.ORDER_RATE_LIMIT.limit({key});
  if (!success) return json({ok: false, error: 'rate'}, 429, {'Retry-After': '60'});

  const {subject, text, replyTo} = formatOrderEmail(value);
  await env.ORDER_EMAIL.send({
   from: {email: sender, name: 'AFYLLX Digital'},
   to: recipient,
   subject,
   ...(replyTo ? {replyTo} : {}),
   text,
  });
  return json({ok: true});
 } catch {
  return json({ok: false, error: 'send'}, 502);
 }
}
