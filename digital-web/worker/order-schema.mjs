// Quy tắc của yêu cầu "Đặt làm website", dùng chung cho trang /dat-lam (trình duyệt) và Worker.
// Không phụ thuộc DOM hay API của Workers để cả hai phía và bộ test cùng import được.

export const NEEDS = ['Bán hàng online', 'Nhận đặt lịch', 'Giới thiệu dịch vụ', 'Ra mắt sản phẩm', 'Quản lý nội bộ', 'Chưa rõ, cần tư vấn'];

/** ?loai= trên đường dẫn → mục tiêu được chọn sẵn. */
export const NEED_BY_LOAI = {
 'ban-hang': 'Bán hàng online',
 'dat-lich': 'Nhận đặt lịch',
 'dich-vu': 'Giới thiệu dịch vụ',
 landing: 'Ra mắt sản phẩm',
 'quan-ly': 'Quản lý nội bộ',
};

/** ?mau= (slug bản mẫu) → mục tiêu và tên bản mẫu để ghi vào yêu cầu. */
export const TEMPLATE_BY_MAU = {
 'cua-hang': {need: 'Bán hàng online', label: 'Gốm Mộc Lam (cửa hàng gốm)'},
 'dich-vu': {need: 'Giới thiệu dịch vụ', label: 'NHÀ ÉN (xưởng nội thất)'},
 'dat-lich': {need: 'Nhận đặt lịch', label: 'Chín Giờ (tiệm tóc)'},
 'ra-mat': {need: 'Ra mắt sản phẩm', label: 'Vọng S1 (trang ra mắt loa không dây)'},
 concert: {need: 'Ra mắt sản phẩm', label: 'Vô Cực (trang giới thiệu concert)'},
};

export const ONLINE = ['Tên miền', 'Website hiện tại', 'Fanpage hoặc kênh bán hàng'];
export const ASSETS = ['Logo', 'Hình ảnh', 'Nội dung giới thiệu'];

export const FEATURES_BY_NEED = {
 'Bán hàng online': ['Danh mục sản phẩm', 'Giỏ hàng và đặt hàng', 'Nhận đơn qua Zalo hoặc điện thoại', 'Trang quản trị sản phẩm'],
 'Nhận đặt lịch': ['Chọn dịch vụ và khung giờ', 'Chọn nhân viên', 'Thông báo khi có lịch hẹn mới', 'Trang quản lý lịch hẹn'],
 'Giới thiệu dịch vụ': ['Trang dịch vụ', 'Thư viện hình ảnh', 'Form nhận tư vấn', 'Bản đồ và giờ mở cửa'],
 'Ra mắt sản phẩm': ['Một trang giới thiệu', 'Form đăng ký', 'Đếm ngược ngày ra mắt'],
 'Quản lý nội bộ': ['Đăng nhập theo vai trò', 'Nhập và tra cứu dữ liệu', 'Báo cáo, xuất Excel'],
 'Chưa rõ, cần tư vấn': [],
};
export const COMMON_FEATURES = ['Tự cập nhật nội dung', 'Nhiều ngôn ngữ'];
export const featuresFor = need => [...(FEATURES_BY_NEED[need] ?? []), ...COMMON_FEATURES];

export const BUDGETS = ['Dưới 5 triệu', '5–15 triệu', '15–30 triệu', 'Trên 30 triệu', 'Chưa xác định'];
export const TIMINGS = ['Càng sớm càng tốt', 'Trong 1–2 tháng', 'Trong 3–6 tháng', 'Chưa xác định'];
export const CHANNELS = ['Email', 'Điện thoại', 'Zalo'];

export const NOTE_MIN = 20;
export const NOTE_MAX = 2000;
const LEGACY_NOTE_MAX = 3000;

const emailPattern = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+$/i;
const phonePattern = /^[0-9+\-\s().]{8,20}$/;
export const isEmail = value => value.length <= 254 && emailPattern.test(value);
export const isPhone = value => phonePattern.test(value) && value.replace(/\D/g, '').length >= 8;

/** Trường nào thuộc bước nào, để trang chỉ báo lỗi của bước đang mở. */
export const STEP_FIELDS = [['need'], ['online', 'assets'], ['features', 'note'], ['budget', 'timing'], ['name', 'email', 'phone', 'business', 'channel', 'consent']];

const text = value => (typeof value === 'string' ? value.trim() : '');
/** Bỏ ký tự xuống dòng để người gửi không chèn được dòng lạ vào tiêu đề email. */
const oneLine = value => value.replace(/[\r\n\t]+/g, ' ');
/** Danh sách lựa chọn: null nếu sai kiểu hoặc có giá trị ngoài danh mục. */
function picks(value, allowed) {
 if (value === undefined) return [];
 if (!Array.isArray(value) || value.length > allowed.length) return null;
 const unique = [...new Set(value)];
 return unique.every(item => allowed.includes(item)) ? unique : null;
}

/**
 * Kiểm tra một yêu cầu. Trả {errors, value}: errors rỗng nghĩa là hợp lệ.
 * Có hai dạng: trình 6 bước (form: 'wizard') và biểu mẫu ngắn cũ (name, contact, need, note).
 */
export function validateOrder(input) {
 const errors = {};
 const body = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
 const wizard = body.form === 'wizard';

 const name = oneLine(text(body.name));
 if (!name) errors.name = 'Vui lòng điền họ tên.';
 else if (name.length > 120) errors.name = 'Họ tên dài quá 120 ký tự.';

 const need = text(body.need);
 if (!NEEDS.includes(need)) errors.need = 'Vui lòng chọn một mục tiêu.';

 if (!wizard) {
  const contact = oneLine(text(body.contact));
  if (!isEmail(contact) && !isPhone(contact)) errors.contact = 'Vui lòng điền email hoặc số điện thoại hợp lệ.';
  const note = typeof body.note === 'string' ? body.note.trim() : body.note === undefined ? '' : null;
  if (note === null || note.length > LEGACY_NOTE_MAX) errors.note = 'Mô tả không hợp lệ.';
  return {errors, value: {form: 'short', name, need, contact, email: isEmail(contact) ? contact : '', note: note ?? ''}};
 }

 const online = picks(body.online, ONLINE);
 if (!online) errors.online = 'Lựa chọn không hợp lệ.';
 const assets = picks(body.assets, ASSETS);
 if (!assets) errors.assets = 'Lựa chọn không hợp lệ.';
 const features = picks(body.features, featuresFor(need));
 if (!features) errors.features = 'Lựa chọn không hợp lệ.';

 const note = text(body.note);
 if (note.length < NOTE_MIN) errors.note = `Vui lòng mô tả ít nhất ${NOTE_MIN} ký tự để chúng tôi hiểu nhu cầu của bạn.`;
 else if (note.length > NOTE_MAX) errors.note = `Mô tả dài quá ${NOTE_MAX} ký tự.`;

 const budget = text(body.budget);
 if (!BUDGETS.includes(budget)) errors.budget = 'Vui lòng chọn một khoảng ngân sách, hoặc "Chưa xác định".';
 const timing = text(body.timing);
 if (!TIMINGS.includes(timing)) errors.timing = 'Vui lòng chọn thời điểm mong muốn, hoặc "Chưa xác định".';

 const email = oneLine(text(body.email));
 const phone = oneLine(text(body.phone));
 const channel = text(body.channel);
 if (email && !isEmail(email)) errors.email = 'Email chưa đúng định dạng.';
 if (phone && !isPhone(phone)) errors.phone = 'Số điện thoại chưa đúng định dạng.';
 if (!email && !phone) errors.email = 'Vui lòng điền email hoặc số điện thoại.';
 if (!CHANNELS.includes(channel)) errors.channel = 'Vui lòng chọn kênh liên hệ.';
 else if (channel === 'Email' && !email && !errors.email) errors.email = 'Bạn chọn liên hệ qua email, vui lòng điền email.';
 else if (channel !== 'Email' && !phone && !errors.phone) errors.phone = `Bạn chọn liên hệ qua ${channel.toLowerCase() === 'zalo' ? 'Zalo' : 'điện thoại'}, vui lòng điền số điện thoại.`;

 const business = oneLine(text(body.business));
 if (business.length > 120) errors.business = 'Tên doanh nghiệp dài quá 120 ký tự.';
 if (body.consent !== true) errors.consent = 'Vui lòng đồng ý với chính sách quyền riêng tư để gửi yêu cầu.';

 const template = TEMPLATE_BY_MAU[text(body.template)]?.label ?? '';
 return {
  errors,
  value: {form: 'wizard', name, need, online: online ?? [], assets: assets ?? [], features: features ?? [], note, budget, timing, email, phone, channel, business, template},
 };
}

const list = items => (items.length ? items.join(', ') : 'Chưa có');

/** Nội dung email gửi về hộp thư AFYLLX từ một yêu cầu đã hợp lệ. */
export function formatOrderEmail(value) {
 const subject = `[AFYLLX Digital] Đặt làm website: ${value.need} — ${value.name}`;
 const footer = ['', '— Gửi từ biểu mẫu trên digital.afyllx.com'];
 if (value.form !== 'wizard') {
  return {
   subject,
   replyTo: value.email || undefined,
   text: [`Họ tên: ${value.name}`, `Email / Điện thoại: ${value.contact}`, `Cần website để: ${value.need}`, '', value.note || '(Không có mô tả)', ...footer].join('\n'),
  };
 }
 return {
  subject,
  replyTo: value.email || undefined,
  text: [
   'LIÊN HỆ',
   `Họ tên: ${value.name}`,
   `Doanh nghiệp: ${value.business || '(không điền)'}`,
   `Email: ${value.email || '(không điền)'}`,
   `Điện thoại: ${value.phone || '(không điền)'}`,
   `Muốn được liên hệ qua: ${value.channel}`,
   '',
   'NHU CẦU',
   `Cần website để: ${value.need}`,
   ...(value.template ? [`Đến từ bản mẫu: ${value.template}`] : []),
   `Chức năng cần có: ${value.features.length ? value.features.join(', ') : '(chưa chọn)'}`,
   `Ngân sách dự kiến: ${value.budget}`,
   `Thời điểm mong muốn: ${value.timing}`,
   '',
   'HIỆN TRẠNG',
   `Đã có trên mạng: ${list(value.online)}`,
   `Tư liệu có sẵn: ${list(value.assets)}`,
   '',
   'MÔ TẢ',
   value.note,
   ...footer,
  ].join('\n'),
 };
}
