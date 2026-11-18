import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import {
  ASSETS,
  BUDGETS,
  CHANNELS,
  NEEDS,
  NEED_BY_LOAI,
  NOTE_MAX,
  ONLINE,
  STEP_FIELDS,
  TEMPLATE_BY_MAU,
  TIMINGS,
  featuresFor,
  validateOrder,
} from '../../worker/order-schema.mjs';
import { Link } from './router';
import { gsap, scrollToTarget, refreshScroll } from '../motion';
import { brand } from '../content/site';

/**
 * Trình mô tả nhu cầu 6 bước — bản React của phuong-an/dat-lam.js, giữ nguyên câu chữ, quy tắc kiểm tra,
 * lưu tạm sessionStorage ('afyllx-dat-lam'), chọn sẵn từ ?mau= / ?loai=, gửi POST /api/dat-lam.
 *
 * KHÔNG có style riêng. Concept tạo kiểu qua class ow-* bên dưới, trong phạm vi [data-concept="<id>"]:
 *  .ow-flow (bọc rail + form)   .ow-rail > li(.is-now|.is-done) > button
 *  .ow (form)  .ow-meter(--p) > span + i   .ow-step[data-step]  h2  .ow-hint
 *  .ow-fieldset > legend.ow-legend + .ow-opts > label.ow-opt > input + span (> small)
 *  .ow-field (label) > input|textarea   .ow-count  .ow-tip  .ow-err(.is-on)  .ow-two  .ow-consent  .ow-trap
 *  .ow-review > div > dt + dd + button.ow-edit
 *  .ow-sent  .ow-tick  .ow-next-steps  .ow-row
 *  .ow-acts > button.ow-btn.is-line#back + button.ow-btn#next     .ow-status(.is-bad)
 */

type Arr = 'online' | 'assets' | 'features';
interface State {
  need: string;
  template: string;
  online: string[];
  assets: string[];
  features: string[];
  note: string;
  budget: string;
  timing: string;
  name: string;
  email: string;
  phone: string;
  business: string;
  channel: string;
  consent: boolean;
}
const STORE = 'afyllx-dat-lam';
const validate = (p: unknown) => validateOrder(p) as unknown as { errors: Record<string, string> };
const REVIEW = 5;
const SENT = 6;
const NEED_HINT: Record<string, string> = {
  'Bán hàng online': 'Trưng bày sản phẩm, nhận đơn',
  'Nhận đặt lịch': 'Khách tự chọn dịch vụ và khung giờ',
  'Giới thiệu dịch vụ': 'Bạn làm gì, ở đâu, liên hệ thế nào',
  'Ra mắt sản phẩm': 'Một trang cho sản phẩm, sự kiện',
  'Quản lý nội bộ': 'Công cụ riêng cho công việc hằng ngày',
  'Chưa rõ, cần tư vấn': 'Ta trao đổi rồi chọn sau',
};
export const RAIL = ['Mục tiêu', 'Hiện trạng', 'Chức năng', 'Ngân sách, thời điểm', 'Liên hệ', 'Xem lại và gửi'];

const empty = (): State => ({ need: '', template: '', online: [], assets: [], features: [], note: '', budget: '', timing: '', name: '', email: '', phone: '', business: '', channel: '', consent: false });

function loadSaved() {
  const state = empty();
  let step = 0;
  let reached = 0;
  try {
    const saved = JSON.parse(sessionStorage.getItem(STORE) || 'null');
    if (saved && typeof saved === 'object') {
      for (const key of Object.keys(state) as (keyof State)[]) {
        const v = saved.state?.[key];
        if (typeof v === typeof state[key] && Array.isArray(v) === Array.isArray(state[key])) (state as unknown as Record<string, unknown>)[key] = v;
      }
      if (Number.isInteger(saved.step) && saved.step >= 0 && saved.step <= REVIEW) step = saved.step;
      if (Number.isInteger(saved.reached) && saved.reached >= step && saved.reached <= REVIEW) reached = saved.reached;
    }
  } catch {
    /* dữ liệu hỏng: bắt đầu lại */
  }
  const query = new URLSearchParams(location.search);
  const mau = query.get('mau') ?? '';
  const fromTemplate = (TEMPLATE_BY_MAU as Record<string, { need: string; label: string }>)[mau];
  const fromLoai = (NEED_BY_LOAI as Record<string, string>)[query.get('loai') ?? ''];
  if (fromTemplate) {
    state.need = fromTemplate.need;
    state.template = mau;
  } else if (fromLoai) {
    state.need = fromLoai;
    state.template = '';
  }
  return { state, step, reached };
}

export interface OrderWizardProps {
  /** Liên kết của concept hiện tại. */
  homeHref: string;
  samplesHref: string;
  privacyHref: string;
  /** Hiện thanh 6 bước (rail). Mặc định true. */
  rail?: boolean;
  /** Gọi sau mỗi lần đổi bước — để concept chạy chuyển cảnh (section mới đã hiện). */
  onStep?: (step: number, section: HTMLElement) => void;
  /** Phần tử chèn trước form trong .ow-flow (vd hình minh họa của concept). */
  aside?: ReactNode;
  /** Ký tự tick ở bước đã gửi — concept có thể thay icon. */
  tick?: ReactNode;
}

export function OrderWizard({ homeHref, samplesHref, privacyHref, rail = true, onStep, aside, tick }: OrderWizardProps) {
  const init = useMemo(loadSaved, []);
  const [s, setS] = useState<State>(init.state);
  const [step, setStep] = useState(init.step);
  const [reached, setReached] = useState(init.reached);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<{ bad: boolean; text: string } | null>(null);
  const [trap, setTrap] = useState('');
  const formRef = useRef<HTMLFormElement>(null);
  const previousStep = useRef(step);

  const payload = (st: State = s) => ({ form: 'wizard', ...st, website: trap });

  // lưu tiến độ
  useEffect(() => {
    if (step === SENT) return;
    try {
      sessionStorage.setItem(STORE, JSON.stringify({ state: s, step, reached }));
    } catch {
      /* chế độ riêng tư: bỏ qua */
    }
  }, [s, step, reached]);

  // chuyển bước: focus tiêu đề, cuộn lên form, báo concept
  useEffect(() => {
    refreshScroll();
    if (previousStep.current === step) return;
    previousStep.current = step;

    const form = formRef.current;
    const section = form?.querySelector<HTMLElement>(`.ow-step[data-step="${step}"]`);
    if (!form || !section) return;
    section.querySelector<HTMLElement>('h2')?.focus({ preventScroll: true });
    scrollToTarget(form);
    if (onStep) {
      const stepMotion = gsap.context(() => onStep(step, section), section);
      return () => stepMotion.revert();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const allowedFeatures = featuresFor(s.need) as string[];
  // bỏ chức năng không còn hợp với mục tiêu mới
  useEffect(() => {
    if (s.features.some((f) => !allowedFeatures.includes(f))) setS((p) => ({ ...p, features: p.features.filter((f) => allowedFeatures.includes(f)) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.need]);

  function go(target: number) {
    setStatus(null);
    setStep(target);
    setReached((r) => Math.max(r, Math.min(target, REVIEW)));
  }

  function showErrors(all: Record<string, string>, fields: string[]) {
    setErrors((prev) => {
      const next = { ...prev };
      for (const f of fields) next[f] = all[f] || '';
      return next;
    });
    const firstBad = fields.find((f) => all[f]);
    if (firstBad) {
      requestAnimationFrame(() => {
        const el = document.getElementById('f-' + firstBad) ?? document.querySelector<HTMLElement>(`#opts-${firstBad} input`);
        el?.focus();
      });
    }
    return !firstBad;
  }

  function checkStep(index: number) {
    const fields = STEP_FIELDS[index] as string[];
    const { errors: all } = validate(payload());
    return showErrors(all, fields);
  }

  function update<K extends keyof State>(key: K, value: State[K]) {
    setS((prev) => {
      const next = { ...prev, [key]: value };
      if (key === 'need' && (TEMPLATE_BY_MAU as Record<string, { need: string }>)[prev.template]?.need !== value) next.template = '';
      // lỗi đang hiện của ô này biến mất ngay khi sửa đúng
      if (errors[key as string]) {
        const { errors: all } = validate({ form: 'wizard', ...next, website: trap });
        setErrors((e) => ({ ...e, [key]: all[key as string] || '' }));
      }
      return next;
    });
  }
  const toggle = (key: Arr, item: string, on: boolean) => update(key, on ? [...s[key], item] : s[key].filter((x) => x !== item));

  async function send() {
    const { errors: all } = validate(payload());
    const bad = (STEP_FIELDS as string[][]).findIndex((fields) => fields.some((f) => all[f]));
    if (bad !== -1) {
      go(bad);
      showErrors(all, STEP_FIELDS[bad] as string[]);
      return;
    }
    setSending(true);
    try {
      const response = await fetch('/api/dat-lam', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload()) });
      if (response.ok) {
        try {
          sessionStorage.removeItem(STORE);
        } catch {
          /* không sao */
        }
        go(SENT);
        return;
      }
      setStatus({
        bad: true,
        text: response.status === 429 ? 'Bạn vừa gửi nhiều lần, vui lòng thử lại sau 1 phút.' : response.status === 400 ? 'Thông tin chưa hợp lệ, vui lòng xem lại các bước.' : 'Chưa gửi được yêu cầu.',
      });
    } catch {
      setStatus({ bad: true, text: 'Không kết nối được.' });
    } finally {
      setSending(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (sending || step === SENT) return;
    if (step === REVIEW) {
      send();
      return;
    }
    if (checkStep(step)) go(step + 1);
  }

  function railGo(target: number) {
    if (sending) return;
    // đi tới bước sau thì bước đang mở phải hợp lệ; quay lại thì luôn được
    if (target <= step || checkStep(step)) go(target);
  }

  const err = (field: string) => (
    <p className={'ow-err' + (errors[field] ? ' is-on' : '')} id={'err-' + field} role="alert">
      {errors[field] || ''}
    </p>
  );

  const radios = (name: 'need' | 'budget' | 'timing' | 'channel', items: readonly string[], hint: Record<string, string> = {}) => (
    <div className="ow-opts" id={'opts-' + name}>
      {items.map((item) => (
        <label className="ow-opt" key={item}>
          <input type="radio" name={name} value={item} checked={s[name] === item} onChange={() => update(name, item)} />
          <span>
            {item}
            {hint[item] ? <small>{hint[item]}</small> : null}
          </span>
        </label>
      ))}
    </div>
  );
  const checks = (name: Arr, items: readonly string[]) => (
    <div className="ow-opts" id={'opts-' + name}>
      {items.map((item) => (
        <label className="ow-opt" key={item}>
          <input type="checkbox" name={name} value={item} checked={s[name].includes(item)} onChange={(e) => toggle(name, item, e.target.checked)} />
          <span>{item}</span>
        </label>
      ))}
    </div>
  );

  const orNone = (items: string[]) => (items.length ? items.join(', ') : 'Chưa có');
  const tpl = (TEMPLATE_BY_MAU as Record<string, { label: string }>)[s.template];
  const reviewRows: [string, string, number][] = [
    ['Mục tiêu', s.need + (tpl ? `\nTheo bản mẫu: ${tpl.label}` : ''), 0],
    ['Đang có sẵn', `Trên mạng: ${orNone(s.online)}\nTư liệu: ${orNone(s.assets)}`, 1],
    ['Chức năng', s.features.length ? s.features.join(', ') : 'Chưa chọn', 2],
    ['Mô tả', s.note, 2],
    ['Ngân sách, thời điểm', `${s.budget}\n${s.timing}`, 3],
    ['Liên hệ', [s.name, s.business, s.email, s.phone, `Liên hệ qua ${s.channel}`].filter(Boolean).join('\n'), 4],
  ];
  const shown = Math.min(step, REVIEW);
  const inv = (field: string) => (errors[field] ? { 'aria-invalid': true as const } : {});

  return (
    <div className="ow-flow">
      {aside}
      {rail ? (
        <ol className="ow-rail" id="rail" aria-label="Các bước">
          {RAIL.map((label, index) => (
            <li key={label} className={(index === step ? 'is-now' : '') + (index < step || step === SENT ? ' is-done' : '')}>
              <button type="button" data-go={index} disabled={step === SENT || index > reached} aria-current={index === step ? 'step' : undefined} onClick={() => railGo(index)}>
                {label}
              </button>
            </li>
          ))}
        </ol>
      ) : null}
      <form className="ow" id="wizard" noValidate ref={formRef} onSubmit={onSubmit}>
        {step !== SENT ? (
          <p className="ow-meter" aria-hidden="true" style={{ ['--p' as string]: Math.round(((shown + 1) / 6) * 100) + '%' }}>
            <span>{`Bước ${shown + 1} trên 6`}</span>
            <i />
          </p>
        ) : null}

        <section className="ow-step" data-step="0" hidden={step !== 0}>
          <h2 tabIndex={-1}>Bạn muốn website làm việc gì?</h2>
          <p className="ow-hint">Chọn một việc chính. Nếu cần nhiều việc, chọn việc quan trọng nhất và ghi thêm ở bước 3.</p>
          <fieldset className="ow-fieldset" aria-describedby="err-need">
            <legend className="ow-trap">Mục tiêu</legend>
            {radios('need', NEEDS as string[], NEED_HINT)}
          </fieldset>
          {err('need')}
        </section>

        <section className="ow-step" data-step="1" hidden={step !== 1}>
          <h2 tabIndex={-1}>Bạn đang có sẵn những gì?</h2>
          <p className="ow-hint">Chưa có gì cũng không sao, cứ để trống. Thông tin này giúp chúng tôi biết cần chuẩn bị thêm những gì.</p>
          <fieldset className="ow-fieldset">
            <legend className="ow-legend">Trên mạng, bạn đã có</legend>
            {checks('online', ONLINE as string[])}
          </fieldset>
          <fieldset className="ow-fieldset">
            <legend className="ow-legend">Tư liệu bạn có sẵn</legend>
            {checks('assets', ASSETS as string[])}
          </fieldset>
        </section>

        <section className="ow-step" data-step="2" hidden={step !== 2}>
          <h2 tabIndex={-1}>Website cần có những gì?</h2>
          <p className="ow-hint">Tích những thứ bạn nghĩ mình sẽ dùng. Không chắc thì bỏ qua, mô tả bằng lời bên dưới là đủ.</p>
          <fieldset className="ow-fieldset">
            <legend className="ow-legend">Chức năng</legend>
            {checks('features', allowedFeatures)}
          </fieldset>
          <label className="ow-field" htmlFor="f-note">
            Mô tả việc kinh doanh và điều bạn mong muốn
            <textarea
              id="f-note"
              name="note"
              maxLength={2000}
              aria-describedby="tip-note err-note"
              placeholder="Bạn bán gì hoặc làm dịch vụ gì, khách hiện tìm bạn qua đâu, bạn muốn website giúp được việc gì…"
              value={s.note}
              onChange={(e) => update('note', e.target.value)}
              {...inv('note')}
            />
            <span className="ow-count" aria-hidden="true">{`${s.note.trim().length}/${NOTE_MAX}`}</span>
            <span className="ow-tip" id="tip-note">
              Từ 20 đến 2000 ký tự.
            </span>
          </label>
          {err('note')}
        </section>

        <section className="ow-step" data-step="3" hidden={step !== 3}>
          <h2 tabIndex={-1}>Ngân sách và thời điểm bạn dự tính</h2>
          <p className="ow-hint">Chỉ để chúng tôi đề xuất phạm vi phù hợp, không phải cam kết. Chưa nghĩ tới thì chọn "Chưa xác định".</p>
          <fieldset className="ow-fieldset" aria-describedby="err-budget">
            <legend className="ow-legend">Ngân sách dự kiến</legend>
            {radios('budget', BUDGETS as string[])}
          </fieldset>
          {err('budget')}
          <fieldset className="ow-fieldset" aria-describedby="err-timing">
            <legend className="ow-legend">Bạn muốn website chạy khi nào</legend>
            {radios('timing', TIMINGS as string[])}
          </fieldset>
          {err('timing')}
        </section>

        <section className="ow-step" data-step="4" hidden={step !== 4}>
          <h2 tabIndex={-1}>Chúng tôi liên hệ lại với bạn bằng cách nào?</h2>
          <p className="ow-hint">Cần ít nhất email hoặc số điện thoại.</p>
          <label className="ow-field" htmlFor="f-name">
            Họ tên
            <input id="f-name" name="name" autoComplete="name" maxLength={120} aria-describedby="err-name" required value={s.name} onChange={(e) => update('name', e.target.value)} {...inv('name')} />
          </label>
          {err('name')}
          <div className="ow-two">
            <div>
              <label className="ow-field" htmlFor="f-email">
                Email
                <input id="f-email" name="email" type="email" inputMode="email" autoComplete="email" maxLength={254} aria-describedby="err-email" value={s.email} onChange={(e) => update('email', e.target.value)} {...inv('email')} />
              </label>
              {err('email')}
            </div>
            <div>
              <label className="ow-field" htmlFor="f-phone">
                Số điện thoại
                <input id="f-phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" maxLength={20} aria-describedby="err-phone" value={s.phone} onChange={(e) => update('phone', e.target.value)} {...inv('phone')} />
              </label>
              {err('phone')}
            </div>
          </div>
          <label className="ow-field" htmlFor="f-business">
            Tên cửa hàng hoặc doanh nghiệp (không bắt buộc)
            <input id="f-business" name="business" autoComplete="organization" maxLength={120} aria-describedby="err-business" value={s.business} onChange={(e) => update('business', e.target.value)} {...inv('business')} />
          </label>
          {err('business')}
          <fieldset className="ow-fieldset" aria-describedby="err-channel">
            <legend className="ow-legend">Bạn muốn được liên hệ qua</legend>
            {radios('channel', CHANNELS as string[])}
          </fieldset>
          {err('channel')}
          <label className="ow-consent">
            <input type="checkbox" id="f-consent" name="consent" aria-describedby="err-consent" checked={s.consent} onChange={(e) => update('consent', e.target.checked)} {...inv('consent')} />
            <span>
              Tôi đồng ý để AFYLLX Digital dùng thông tin này để liên hệ lại về yêu cầu, theo{' '}
              <a href={privacyHref} target="_blank" rel="noopener">
                chính sách quyền riêng tư
              </a>
              .
            </span>
          </label>
          {err('consent')}
          <label className="ow-trap" aria-hidden="true">
            Website
            <input name="website" id="f-website" tabIndex={-1} autoComplete="off" value={trap} onChange={(e) => setTrap(e.target.value)} />
          </label>
        </section>

        <section className="ow-step" data-step="5" hidden={step !== 5}>
          <h2 tabIndex={-1}>Xem lại trước khi gửi</h2>
          <p className="ow-hint">Bấm "Sửa" ở mục nào cần đổi. Khi gửi, yêu cầu tới thẳng hộp thư AFYLLX Digital.</p>
          <dl className="ow-review" id="review">
            {reviewRows.map(([term, detail, target]) => (
              <div key={term}>
                <dt>{term}</dt>
                <dd>{detail}</dd>
                <button type="button" className="ow-edit" aria-label={`Sửa mục ${term}`} onClick={() => go(target)}>
                  Sửa
                </button>
              </div>
            ))}
          </dl>
        </section>

        <section className="ow-step ow-sent" data-step="6" hidden={step !== SENT}>
          <span className="ow-tick" aria-hidden="true">
            {tick ?? (
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12l5 5 9-10" />
              </svg>
            )}
          </span>
          <h2 tabIndex={-1}>Đã gửi yêu cầu của bạn</h2>
          <p className="ow-hint">Cảm ơn bạn. Yêu cầu đã tới hộp thư AFYLLX Digital. Các bước tiếp theo:</p>
          <ol className="ow-next-steps">
            <li>Chúng tôi đọc yêu cầu và liên hệ lại qua kênh bạn đã chọn.</li>
            <li>Hai bên trao đổi để làm rõ phạm vi công việc.</li>
            <li>Bạn nhận đề xuất và báo giá bằng văn bản trước khi bắt đầu làm.</li>
          </ol>
          <div className="ow-row">
            <Link className="ow-btn" href={homeHref}>
              Về trang chủ
            </Link>
            <Link className="ow-btn is-line" href={samplesHref}>
              Xem bản mẫu
            </Link>
          </div>
        </section>

        {step !== SENT ? (
          <div className="ow-acts" id="acts">
            <button className="ow-btn is-line" type="button" id="back" style={{ visibility: step === 0 ? 'hidden' : undefined }} onClick={() => step > 0 && !sending && go(step - 1)}>
              Quay lại
            </button>
            <button className="ow-btn" type="submit" id="next" disabled={sending}>
              {sending ? 'Đang gửi…' : step === REVIEW ? 'Gửi yêu cầu' : 'Tiếp tục'}
            </button>
          </div>
        ) : null}
        <p className={'ow-status' + (status?.bad ? ' is-bad' : '')} id="status" role="status" aria-live="polite">
          {status ? (
            <>
              {status.text} Bạn cũng có thể viết thẳng tới <a href={'mailto:' + brand.email}>{brand.email}</a>.
            </>
          ) : null}
        </p>
      </form>
    </div>
  );
}
