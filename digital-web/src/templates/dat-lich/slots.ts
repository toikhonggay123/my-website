/**
 * Hàm thuần cho luồng đặt lịch: định dạng, sinh ngày, sinh khung giờ, kiểm tra thông tin.
 * Không đụng tới DOM, mạng hay đồng hồ hệ thống (thời điểm "bây giờ" luôn được truyền vào).
 */

export const OPEN_MINUTES = 9 * 60;
export const CLOSE_MINUTES = 20 * 60;
export const SLOT_STEP = 30;
export const DAYS_AHEAD = 14;
/** Thứ Hai (getDay() === 1) là ngày nghỉ. */
export const CLOSED_WEEKDAY = 1;
/** Khách cần đặt trước ít nhất chừng này phút. */
export const LEAD_MINUTES = 30;
export const ANY = 'any';
export const LAST_STEP = 4;

const WEEKDAY_SHORT = ['CN', 'Th 2', 'Th 3', 'Th 4', 'Th 5', 'Th 6', 'Th 7'];
const WEEKDAY_LONG = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];

const pad = (n: number): string => String(n).padStart(2, '0');

/** 120000 → "120.000 ₫" */
export function formatVnd(amount: number): string {
  const digits = Math.round(amount).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${digits} ₫`;
}

/** 90 → "1 giờ 30 phút" */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} phút`;
  if (m === 0) return `${h} giờ`;
  return `${h} giờ ${m} phút`;
}

/** 570 → "09:30" */
export function formatTime(minutes: number): string {
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}

export function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export interface DayOption {
  key: string;
  weekdayShort: string;
  weekdayLong: string;
  day: number;
  month: number;
  closed: boolean;
  isToday: boolean;
}

/** Danh sách ngày kể từ hôm nay (theo giờ máy của khách). */
export function getNextDays(from: Date, count: number = DAYS_AHEAD): DayOption[] {
  const days: DayOption[] = [];
  for (let i = 0; i < count; i += 1) {
    const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() + i);
    const weekday = d.getDay();
    days.push({
      key: toDateKey(d),
      weekdayShort: WEEKDAY_SHORT[weekday],
      weekdayLong: WEEKDAY_LONG[weekday],
      day: d.getDate(),
      month: d.getMonth() + 1,
      closed: weekday === CLOSED_WEEKDAY,
      isToday: i === 0,
    });
  }
  return days;
}

/** "Thứ Sáu, 20/11" */
export function formatDayLong(day: DayOption): string {
  return `${day.weekdayLong}, ${pad(day.day)}/${pad(day.month)}`;
}

export function minutesOfDay(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

/** Băm chuỗi thành số nguyên 32 bit (FNV-1a). */
export function hashString(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Bộ sinh số giả ngẫu nhiên có hạt giống (mulberry32), trả về số trong [0, 1). */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Interval {
  start: number;
  end: number;
}

/** Các khoảng đã có khách (minh họa) của một thợ trong một ngày. Cùng đầu vào luôn cho cùng kết quả. */
export function busyIntervals(dateKey: string, stylistId: string): Interval[] {
  const rand = seededRandom(hashString(`${dateKey}|${stylistId}`));
  const blocks = (CLOSE_MINUTES - OPEN_MINUTES) / SLOT_STEP;
  const count = 3 + Math.floor(rand() * 3);
  const result: Interval[] = [];
  for (let i = 0; i < count; i += 1) {
    const start = OPEN_MINUTES + Math.floor(rand() * blocks) * SLOT_STEP;
    const length = SLOT_STEP * (1 + Math.floor(rand() * 3));
    result.push({ start, end: Math.min(start + length, CLOSE_MINUTES) });
  }
  return result;
}

const overlaps = (a: Interval, b: Interval): boolean => a.start < b.end && b.start < a.end;

export interface Slot {
  minutes: number;
  label: string;
  available: boolean;
  /** Thợ sẽ nhận khung giờ này; null nếu đã kín. */
  stylistId: string | null;
}

export interface SlotQuery {
  dateKey: string;
  /** Mã thợ, hoặc "any" để nhận bất kỳ ai còn trống. */
  stylistId: string;
  /** Toàn bộ mã thợ của tiệm (dùng khi chọn "any"). */
  allStylistIds: readonly string[];
  /** Tổng thời lượng các dịch vụ, phút. */
  duration: number;
  /** Nếu ngày được hỏi là hôm nay: số phút đã trôi qua trong ngày. Bỏ trống cho các ngày sau. */
  nowMinutes?: number;
}

/**
 * Sinh khung giờ cho một ngày. Khung nào làm xong sau giờ đóng cửa thì không đưa ra.
 * Khung trùng lịch có sẵn của thợ được đánh dấu available = false ("Đã kín").
 */
export function generateSlots(query: SlotQuery): Slot[] {
  const duration = Math.max(query.duration, SLOT_STEP);
  const candidates = query.stylistId === ANY ? [...query.allStylistIds] : [query.stylistId];
  const busy = candidates.map((id) => ({ id, intervals: busyIntervals(query.dateKey, id) }));
  const earliest = query.nowMinutes === undefined ? OPEN_MINUTES : query.nowMinutes + LEAD_MINUTES;
  const slots: Slot[] = [];
  for (let start = OPEN_MINUTES; start + duration <= CLOSE_MINUTES; start += SLOT_STEP) {
    if (start < earliest) continue;
    const wanted: Interval = { start, end: start + duration };
    const free = busy.find((b) => !b.intervals.some((interval) => overlaps(interval, wanted)));
    slots.push({ minutes: start, label: formatTime(start), available: free !== undefined, stylistId: free?.id ?? null });
  }
  return slots;
}

export interface FreeSlotHint {
  dateKey: string;
  minutes: number;
  dayLabel: string;
  timeLabel: string;
}

/** Vài khung giờ trống gần nhất, mỗi ngày tối đa hai khung, dùng cho thẻ xem trước ở đầu trang. */
export function nextFreeSlots(
  days: readonly DayOption[],
  query: Omit<SlotQuery, 'dateKey' | 'nowMinutes'>,
  nowMinutes: number,
  count: number,
): FreeSlotHint[] {
  const hints: FreeSlotHint[] = [];
  for (const day of days) {
    if (day.closed) continue;
    const slots = generateSlots({ ...query, dateKey: day.key, nowMinutes: day.isToday ? nowMinutes : undefined });
    let perDay = 0;
    for (const slot of slots) {
      if (!slot.available) continue;
      hints.push({
        dateKey: day.key,
        minutes: slot.minutes,
        dayLabel: day.isToday ? 'Hôm nay' : `${day.weekdayShort} ${pad(day.day)}/${pad(day.month)}`,
        timeLabel: slot.label,
      });
      perDay += 1;
      if (hints.length >= count) return hints;
      if (perDay >= 2) break;
    }
  }
  return hints;
}

export type SlotPeriod = 'sang' | 'chieu' | 'toi';
export const PERIOD_LABEL: Record<SlotPeriod, string> = { sang: 'Sáng', chieu: 'Chiều', toi: 'Tối' };

export function slotPeriod(minutes: number): SlotPeriod {
  if (minutes < 12 * 60) return 'sang';
  if (minutes < 17 * 60) return 'chieu';
  return 'toi';
}

/* ---------- Kiểm tra thông tin liên hệ ---------- */

export interface Contact {
  name: string;
  phone: string;
  note: string;
}

export type ContactErrors = Partial<Record<keyof Contact, string>>;

export const NOTE_MAX = 200;

/** Bỏ khoảng trắng, dấu chấm, gạch; đổi +84 thành 0. */
export function normalizePhone(raw: string): string {
  const compact = raw.replace(/[\s.\-()]/g, '');
  if (compact.startsWith('+84')) return `0${compact.slice(3)}`;
  if (compact.startsWith('84') && compact.length === 11) return `0${compact.slice(2)}`;
  return compact;
}

export function validateContact(contact: Contact): ContactErrors {
  const errors: ContactErrors = {};
  const name = contact.name.trim();
  if (name.length === 0) errors.name = 'Nhập họ tên để tiệm biết gọi bạn là gì.';
  else if (name.length < 2) errors.name = 'Họ tên cần ít nhất 2 ký tự.';
  else if (/[0-9@#$%^&*_+=<>{}[\]\\/|]/.test(name)) errors.name = 'Họ tên chỉ gồm chữ cái và khoảng trắng.';
  else if (name.length > 60) errors.name = 'Họ tên dài tối đa 60 ký tự.';

  const phone = normalizePhone(contact.phone);
  if (phone.length === 0) errors.phone = 'Nhập số điện thoại để tiệm nhắc lịch.';
  else if (!/^\d+$/.test(phone)) errors.phone = 'Số điện thoại chỉ gồm chữ số.';
  else if (!/^0[35789]\d{8}$/.test(phone)) errors.phone = 'Số di động gồm 10 chữ số, bắt đầu bằng 03, 05, 07, 08 hoặc 09.';

  if (contact.note.length > NOTE_MAX) errors.note = `Ghi chú dài tối đa ${NOTE_MAX} ký tự.`;
  return errors;
}

/* ---------- Trạng thái đặt lịch ---------- */

export interface Draft {
  step: number;
  serviceIds: string[];
  stylistId: string | null;
  dateKey: string | null;
  slot: number | null;
}

export const EMPTY_DRAFT: Draft = { step: 0, serviceIds: [], stylistId: null, dateKey: null, slot: null };

/** Làm sạch dữ liệu đọc lại từ sessionStorage: chỉ giữ những gì còn hợp lệ hôm nay. */
export function sanitizeDraft(
  raw: unknown,
  serviceIds: readonly string[],
  stylistIds: readonly string[],
  openDateKeys: readonly string[],
): Draft {
  if (typeof raw !== 'object' || raw === null) return EMPTY_DRAFT;
  const data = raw as Record<string, unknown>;
  const services = Array.isArray(data.serviceIds)
    ? data.serviceIds.filter((id): id is string => typeof id === 'string' && serviceIds.includes(id))
    : [];
  const stylistId =
    typeof data.stylistId === 'string' && (data.stylistId === ANY || stylistIds.includes(data.stylistId)) ? data.stylistId : null;
  const dateKey = typeof data.dateKey === 'string' && openDateKeys.includes(data.dateKey) ? data.dateKey : null;
  const slot = dateKey !== null && typeof data.slot === 'number' && Number.isInteger(data.slot) ? data.slot : null;
  const step = typeof data.step === 'number' && Number.isInteger(data.step) ? Math.min(Math.max(data.step, 0), LAST_STEP) : 0;
  return { step, serviceIds: [...new Set(services)], stylistId, dateKey, slot };
}

export interface Totals {
  minutes: number;
  price: number;
  count: number;
}

export function sumServices(items: readonly { minutes: number; price: number }[]): Totals {
  return items.reduce<Totals>(
    (acc, item) => ({ minutes: acc.minutes + item.minutes, price: acc.price + item.price, count: acc.count + 1 }),
    { minutes: 0, price: 0, count: 0 },
  );
}

/**
 * Lý do bước chọn (0–2) chưa hợp lệ, hoặc null nếu đã đủ. `slotValid` cho biết khung giờ đã chọn
 * có còn trống với thợ và thời lượng hiện tại hay không.
 */
export function selectionError(step: number, draft: Draft, slotValid: boolean): string | null {
  if (step === 0) return draft.serviceIds.length === 0 ? 'Chọn ít nhất một dịch vụ để tiếp tục.' : null;
  if (step === 1) return draft.stylistId === null ? 'Chọn một thợ, hoặc chọn “Ai cũng được”.' : null;
  if (step === 2) {
    if (draft.dateKey === null) return 'Chọn ngày bạn muốn đến.';
    if (!slotValid) return 'Chọn một khung giờ còn trống.';
  }
  return null;
}
