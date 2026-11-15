// Nhận yêu cầu "Đặt làm website" và gửi thẳng tới hộp thư AFYLLX qua Cloudflare Email Routing.
export const orderPath = '/api/dat-lam';
const recipient = 'contact.afyllx@gmail.com';
const sender = 'contact-form@afyllx.com';
export const needs = new Set([
 'Bán hàng online',
 'Nhận đặt lịch',
 'Giới thiệu dịch vụ',
 'Ra mắt sản phẩm',
 'Quản lý nội bộ',
 'Chưa rõ, cần tư vấn',
]);
const emailPattern = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+$/i;
const phonePattern = /^[0-9+\-\s().]{8,20}$/;
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

/** Chuỗi đã cắt khoảng trắng; rỗng nếu sai kiểu hoặc dài quá giới hạn. */
function textField(value, limit) {
 if (typeof value !== 'string') return '';
 const trimmed = value.trim();
 return trimmed.length <= limit ? trimmed : '';
}

/** Bỏ ký tự xuống dòng để người gửi không chèn được dòng lạ vào tiêu đề email. */
const oneLine = value => value.replace(/[\r\n\t]+/g, ' ');

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

 const name = oneLine(textField(body.name, 120));
 const contact = oneLine(textField(body.contact, 254));
 const need = textField(body.need, 60);
 const note = typeof body.note === 'string' && body.note.trim().length <= 3_000 ? body.note.trim() : null;
 const replyTo = emailPattern.test(contact) ? contact : undefined;
 const validPhone = phonePattern.test(contact) && contact.replace(/\D/g, '').length >= 8;
 if (!name || !(replyTo || validPhone) || !needs.has(need) || note === null) {
  return json({ok: false, error: 'invalid'}, 400);
 }

 try {
  const key = request.headers.get('CF-Connecting-IP') || 'unknown';
  const {success} = await env.ORDER_RATE_LIMIT.limit({key});
  if (!success) return json({ok: false, error: 'rate'}, 429, {'Retry-After': '60'});

  await env.ORDER_EMAIL.send({
   from: {email: sender, name: 'AFYLLX Digital'},
   to: recipient,
   subject: `[AFYLLX Digital] Đặt làm website: ${need} — ${name}`,
   ...(replyTo ? {replyTo} : {}),
   text: [
    `Họ tên: ${name}`,
    `Email / Điện thoại: ${contact}`,
    `Cần website để: ${need}`,
    '',
    note || '(Không có mô tả)',
    '',
    '— Gửi từ biểu mẫu trên digital.afyllx.com',
   ].join('\n'),
  });
  return json({ok: true});
 } catch {
  return json({ok: false, error: 'send'}, 502);
 }
}
