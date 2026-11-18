// Trình mô tả nhu cầu 6 bước của trang /dat-lam.
// Quy tắc kiểm tra lấy từ worker/order-schema.mjs, cùng tệp mà Worker dùng, nên hai phía không lệch nhau.
import {
 ASSETS, BUDGETS, CHANNELS, NEEDS, NEED_BY_LOAI, NOTE_MAX, ONLINE, STEP_FIELDS, TEMPLATE_BY_MAU, TIMINGS,
 featuresFor, validateOrder,
} from '../worker/order-schema.mjs';

const $ = id => document.getElementById(id);
const STORE = 'afyllx-dat-lam';
const TO = 'contact.afyllx@gmail.com';
const REVIEW = 5;
const SENT = 6;
const NEED_HINT = {
 'Bán hàng online': 'Trưng bày sản phẩm, nhận đơn',
 'Nhận đặt lịch': 'Khách tự chọn dịch vụ và khung giờ',
 'Giới thiệu dịch vụ': 'Bạn làm gì, ở đâu, liên hệ thế nào',
 'Ra mắt sản phẩm': 'Một trang cho sản phẩm, sự kiện',
 'Quản lý nội bộ': 'Công cụ riêng cho công việc hằng ngày',
 'Chưa rõ, cần tư vấn': 'Ta trao đổi rồi chọn sau',
};

const state = {need: '', template: '', online: [], assets: [], features: [], note: '', budget: '', timing: '', name: '', email: '', phone: '', business: '', channel: '', consent: false};
let step = 0;
let reached = 0; // bước xa nhất đã tới, để thanh bên cho phép nhảy lại
let sending = false;

/* ---------- lưu tiến độ trong phiên trình duyệt ---------- */
function save() {
 try { sessionStorage.setItem(STORE, JSON.stringify({state, step, reached})); } catch { /* chế độ riêng tư: bỏ qua */ }
}
function load() {
 try {
  const saved = JSON.parse(sessionStorage.getItem(STORE) || 'null');
  if (!saved || typeof saved !== 'object') return;
  for (const key of Object.keys(state)) {
   if (typeof saved.state?.[key] === typeof state[key] && Array.isArray(saved.state[key]) === Array.isArray(state[key])) state[key] = saved.state[key];
  }
  if (Number.isInteger(saved.step) && saved.step >= 0 && saved.step <= REVIEW) step = saved.step;
  if (Number.isInteger(saved.reached) && saved.reached >= step && saved.reached <= REVIEW) reached = saved.reached;
 } catch { /* dữ liệu hỏng: bắt đầu lại */ }
}
function forget() {
 try { sessionStorage.removeItem(STORE); } catch { /* không sao */ }
}

/* ---------- dựng các nhóm lựa chọn ---------- */
function options(boxId, name, items, type, hint = {}) {
 const box = $(boxId);
 box.replaceChildren(...items.map(item => {
  const label = document.createElement('label');
  label.className = 'opt';
  const input = document.createElement('input');
  input.type = type;
  input.name = name;
  input.value = item;
  input.checked = type === 'radio' ? state[name] === item : state[name].includes(item);
  const span = document.createElement('span');
  span.textContent = item;
  if (hint[item]) {
   const small = document.createElement('small');
   small.textContent = hint[item];
   span.append(small);
  }
  label.append(input, span);
  return label;
 }));
}
function drawFeatures() {
 const allowed = featuresFor(state.need);
 state.features = state.features.filter(item => allowed.includes(item));
 options('opts-features', 'features', allowed, 'checkbox');
}

/* ---------- lỗi ---------- */
function showErrors(errors, fields) {
 let first = null;
 for (const field of fields) {
  const box = $('err-' + field);
  if (!box) continue;
  const message = errors[field] || '';
  box.textContent = message;
  box.classList.toggle('on', Boolean(message));
  const control = $('f-' + field);
  if (control) control.toggleAttribute('aria-invalid', false), message && control.setAttribute('aria-invalid', 'true');
  if (message && !first) first = control || $('opts-' + field)?.querySelector('input');
 }
 return first;
}
const payload = () => ({form: 'wizard', ...state, website: $('f-website').value});

/* ---------- chuyển bước ---------- */
const sections = [...document.querySelectorAll('.step')];
function render(focus = true) {
 sections.forEach(section => { section.hidden = +section.dataset.step !== step; });
 document.querySelectorAll('#rail li').forEach((li, index) => {
  li.classList.toggle('now', index === step);
  li.classList.toggle('done', index < step || (step === SENT));
  const button = li.firstElementChild;
  button.disabled = step === SENT || index > reached;
  if (index === step) button.setAttribute('aria-current', 'step'); else button.removeAttribute('aria-current');
 });
 $('acts').hidden = step === SENT;
 $('acts').style.display = step === SENT ? 'none' : '';
 $('back').style.visibility = step === 0 ? 'hidden' : '';
 $('next').textContent = step === REVIEW ? 'Gửi yêu cầu' : 'Tiếp tục';
 $('meter').style.setProperty('--p', Math.round(((Math.min(step, REVIEW) + 1) / 6) * 100) + '%');
 $('meter').hidden = step === SENT;
 $('meter-text').textContent = `Bước ${Math.min(step, REVIEW) + 1} trên 6`;
 $('status').textContent = '';
 $('status').className = 'status';
 if (step === 2) drawFeatures();
 if (step === REVIEW) drawReview();
 if (focus) {
  const heading = sections.find(section => +section.dataset.step === step).querySelector('h2');
  heading.focus({preventScroll: true});
  $('wizard').scrollIntoView({block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'});
 }
}
function go(target) {
 step = target;
 reached = Math.max(reached, Math.min(target, REVIEW));
 save();
 render();
}
/** Kiểm tra bước đang mở; trả true nếu được đi tiếp. */
function checkStep(index) {
 const fields = STEP_FIELDS[index];
 const {errors} = validateOrder(payload());
 const first = showErrors(errors, fields);
 if (!fields.some(field => errors[field])) return true;
 first?.focus();
 return false;
}

/* ---------- xem lại ---------- */
const orNone = items => (items.length ? items.join(', ') : 'Chưa có');
function drawReview() {
 const rows = [
  ['Mục tiêu', state.need + (TEMPLATE_BY_MAU[state.template] ? `\nTheo bản mẫu: ${TEMPLATE_BY_MAU[state.template].label}` : ''), 0],
  ['Đang có sẵn', `Trên mạng: ${orNone(state.online)}\nTư liệu: ${orNone(state.assets)}`, 1],
  ['Chức năng', state.features.length ? state.features.join(', ') : 'Chưa chọn', 2],
  ['Mô tả', state.note, 2],
  ['Ngân sách, thời điểm', `${state.budget}\n${state.timing}`, 3],
  ['Liên hệ', [state.name, state.business, state.email, state.phone, `Liên hệ qua ${state.channel}`].filter(Boolean).join('\n'), 4],
 ];
 $('review').replaceChildren(...rows.map(([term, detail, target]) => {
  const row = document.createElement('div');
  const dt = document.createElement('dt');
  dt.textContent = term;
  const dd = document.createElement('dd');
  dd.textContent = detail;
  const edit = document.createElement('button');
  edit.type = 'button';
  edit.textContent = 'Sửa';
  edit.setAttribute('aria-label', `Sửa mục ${term}`);
  edit.addEventListener('click', () => go(target));
  row.append(dt, dd, edit);
  return row;
 }));
}

/* ---------- gửi ---------- */
function fail(message) {
 const status = $('status');
 status.className = 'status bad';
 status.replaceChildren(message + ' Bạn cũng có thể viết thẳng tới ');
 const link = document.createElement('a');
 link.href = 'mailto:' + TO;
 link.textContent = TO;
 status.append(link, '.');
}
async function send() {
 // kiểm tra lại toàn bộ: dữ liệu khôi phục từ phiên trước có thể thiếu
 const {errors} = validateOrder(payload());
 const bad = STEP_FIELDS.findIndex(fields => fields.some(field => errors[field]));
 if (bad !== -1) { go(bad); checkStep(bad); return; }
 sending = true;
 $('next').disabled = true;
 $('next').textContent = 'Đang gửi…';
 try {
  const response = await fetch('/api/dat-lam', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload())});
  if (response.ok) { forget(); step = SENT; render(); return; }
  fail(response.status === 429 ? 'Bạn vừa gửi nhiều lần, vui lòng thử lại sau 1 phút.' : response.status === 400 ? 'Thông tin chưa hợp lệ, vui lòng xem lại các bước.' : 'Chưa gửi được yêu cầu.');
 } catch {
  fail('Không kết nối được.');
 } finally {
  sending = false;
  $('next').disabled = false;
  if (step === REVIEW) $('next').textContent = 'Gửi yêu cầu';
 }
}

/* ---------- khởi động ---------- */
load();
const query = new URLSearchParams(location.search);
const fromTemplate = TEMPLATE_BY_MAU[query.get('mau')];
const fromLoai = NEED_BY_LOAI[query.get('loai')];
if (fromTemplate) { state.need = fromTemplate.need; state.template = query.get('mau'); }
else if (fromLoai) { state.need = fromLoai; state.template = ''; }

options('opts-need', 'need', NEEDS, 'radio', NEED_HINT);
options('opts-online', 'online', ONLINE, 'checkbox');
options('opts-assets', 'assets', ASSETS, 'checkbox');
options('opts-budget', 'budget', BUDGETS, 'radio');
options('opts-timing', 'timing', TIMINGS, 'radio');
options('opts-channel', 'channel', CHANNELS, 'radio');
for (const name of ['note', 'name', 'email', 'phone', 'business']) $('f-' + name).value = state[name];
$('f-consent').checked = state.consent;
const count = () => { $('count-note').textContent = `${$('f-note').value.trim().length}/${NOTE_MAX}`; };
count();

const form = $('wizard');
form.addEventListener('input', event => {
 const {name, type, value, checked} = event.target;
 if (!(name in state)) return;
 if (type === 'checkbox' && Array.isArray(state[name])) state[name] = checked ? [...state[name], value] : state[name].filter(item => item !== value);
 else if (type === 'checkbox') state[name] = checked;
 else state[name] = value;
 if (name === 'need' && TEMPLATE_BY_MAU[state.template]?.need !== value) state.template = '';
 if (name === 'note') count();
 // lỗi đang hiện của ô này biến mất ngay khi sửa đúng
 const box = $('err-' + name);
 if (box?.classList.contains('on')) showErrors(validateOrder(payload()).errors, [name]);
 save();
});
form.addEventListener('submit', event => {
 event.preventDefault();
 if (sending || step === SENT) return;
 if (step === REVIEW) { send(); return; }
 if (checkStep(step)) go(step + 1);
});
$('back').addEventListener('click', () => { if (step > 0 && !sending) go(step - 1); });
$('rail').addEventListener('click', event => {
 const button = event.target.closest('button');
 if (!button || button.disabled || sending) return;
 const target = +button.dataset.go;
 // đi tới bước sau thì bước đang mở phải hợp lệ; quay lại thì luôn được
 if (target <= step || checkStep(step)) go(target);
});
render(false);
