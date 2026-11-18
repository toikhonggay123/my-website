import { useEffect, useMemo, useRef, useState } from 'react';
import { ANY_STYLIST, GROUP_LABEL, GROUP_ORDER, SERVICES, STYLISTS, serviceById, stylistName } from './data';
import {
  LAST_STEP,
  NOTE_MAX,
  PERIOD_LABEL,
  formatDayLong,
  formatDuration,
  formatTime,
  formatVnd,
  generateSlots,
  minutesOfDay,
  selectionError,
  slotPeriod,
  sumServices,
  validateContact,
  type Contact,
  type DayOption,
  type Draft,
  type Slot,
  type SlotPeriod,
} from './slots';
import { AnyAvatar, ArrowIcon, Avatar, BackIcon, CheckIcon, TimeIcon } from './art';

const STEPS = ['Dịch vụ', 'Thợ', 'Ngày giờ', 'Liên hệ', 'Xác nhận'] as const;
const STEP_TITLES = [
  'Bạn muốn làm gì?',
  'Ai sẽ làm tóc cho bạn?',
  'Bạn đến lúc nào?',
  'Tiệm liên hệ bạn qua đâu?',
  'Xem lại lịch hẹn',
] as const;
const PERIODS: SlotPeriod[] = ['sang', 'chieu', 'toi'];
const STYLIST_IDS = STYLISTS.map((s) => s.id);
const EMPTY_CONTACT: Contact = { name: '', phone: '', note: '' };
const CONTACT_FIELDS: (keyof Contact)[] = ['name', 'phone', 'note'];

interface BookingProps {
  draft: Draft;
  patch: (change: Partial<Draft>) => void;
  toggleService: (id: string) => void;
  days: DayOption[];
  now: Date;
  /** Gọi khi khách bấm "Xác nhận đặt lịch". Không gửi dữ liệu đi đâu. */
  onConfirm: () => void;
}

export function Booking({ draft, patch, toggleService, days, now, onConfirm }: BookingProps) {
  const [contact, setContact] = useState<Contact>(EMPTY_CONTACT);
  const [touched, setTouched] = useState<Partial<Record<keyof Contact, boolean>>>({});
  const [attempted, setAttempted] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const lastStep = useRef<number | null>(null);

  const chosen = useMemo(
    () => draft.serviceIds.map(serviceById).filter((s): s is NonNullable<typeof s> => s !== undefined),
    [draft.serviceIds],
  );
  const totals = useMemo(() => sumServices(chosen), [chosen]);
  const day = days.find((d) => d.key === draft.dateKey) ?? null;

  const slots: Slot[] = useMemo(() => {
    if (day === null || day.closed) return [];
    return generateSlots({
      dateKey: day.key,
      stylistId: draft.stylistId ?? ANY_STYLIST,
      allStylistIds: STYLIST_IDS,
      duration: totals.minutes,
      nowMinutes: day.isToday ? minutesOfDay(now) : undefined,
    });
  }, [day, draft.stylistId, totals.minutes, now]);

  /** Khung giờ đã chọn chỉ còn hiệu lực nếu vẫn trống với thợ và thời lượng hiện tại. */
  const slot = slots.find((s) => s.available && s.minutes === draft.slot) ?? null;
  const errors = validateContact(contact);
  const contactValid = Object.keys(errors).length === 0;

  const stepError = (index: number): string | null => {
    if (index <= 2) return selectionError(index, draft, slot !== null);
    if (index === 3) return contactValid ? null : 'Kiểm tra lại các ô được đánh dấu.';
    return null;
  };
  const firstInvalid = [0, 1, 2, 3].find((i) => stepError(i) !== null);
  const reachable = firstInvalid ?? LAST_STEP;
  const step = Math.min(draft.step, reachable);
  const currentError = stepError(step);

  useEffect(() => {
    if (lastStep.current !== null && lastStep.current !== step) headingRef.current?.focus();
    lastStep.current = step;
  }, [step]);

  const go = (target: number) => {
    setAttempted(false);
    patch({ step: Math.min(Math.max(target, 0), reachable) });
  };

  const next = () => {
    if (currentError !== null) {
      setAttempted(true);
      if (step === 3) {
        const firstBad = CONTACT_FIELDS.find((f) => errors[f] !== undefined);
        if (firstBad) document.getElementById(`dl-field-${firstBad}`)?.focus();
      }
      return;
    }
    if (step === LAST_STEP) {
      // Đưa tiêu điểm về tiêu đề bước trước khi mở thông báo, để khi đóng thông báo tiêu điểm quay lại đây.
      headingRef.current?.focus();
      setContact(EMPTY_CONTACT);
      setTouched({});
      setAttempted(false);
      onConfirm();
      return;
    }
    setAttempted(false);
    patch({ step: step + 1 });
  };

  const showError = (field: keyof Contact): string | undefined =>
    touched[field] || attempted ? errors[field] : undefined;

  const assigned = slot?.stylistId ?? null;
  const stylistText =
    draft.stylistId === ANY_STYLIST && assigned !== null
      ? `Ai cũng được (dự kiến: ${stylistName(assigned)})`
      : stylistName(draft.stylistId);
  const timeText = slot !== null ? `${slot.label} – ${formatTime(slot.minutes + Math.max(totals.minutes, 30))}` : 'Chưa chọn';
  const compact =
    totals.count === 0 ? 'Chưa chọn dịch vụ' : `${totals.count} dịch vụ · ${formatDuration(totals.minutes)} · ${formatVnd(totals.price)}`;

  const field = (name: keyof Contact, label: string, hint: string, props: { type?: string; inputMode?: 'tel' | 'text'; autoComplete?: string }) => {
    const error = showError(name);
    const describedBy = `dl-hint-${name}${error ? ` dl-err-${name}` : ''}`;
    return (
      <div className={`dl-field${error ? ' is-invalid' : ''}`}>
        <label htmlFor={`dl-field-${name}`}>{label}</label>
        <input
          id={`dl-field-${name}`}
          type={props.type ?? 'text'}
          inputMode={props.inputMode}
          autoComplete={props.autoComplete}
          value={contact[name]}
          aria-required="true"
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          onChange={(e) => setContact((c) => ({ ...c, [name]: e.target.value }))}
          onBlur={() => setTouched((t) => ({ ...t, [name]: true }))}
          onKeyDown={(e) => {
            if (e.key === 'Enter') next();
          }}
        />
        <p className="dl-field__hint" id={`dl-hint-${name}`}>
          {hint}
        </p>
        {error && (
          <p className="dl-field__error" id={`dl-err-${name}`}>
            {error}
          </p>
        )}
      </div>
    );
  };

  const noteError = showError('note');

  return (
    <div className="dl-grid dl-booking">
      <div className="dl-pane dl-c8 dl-t8">
        <ol className="dl-steps" aria-label="Các bước đặt lịch">
          {STEPS.map((label, i) => {
            const state = i === step ? 'is-current' : i < step ? 'is-done' : '';
            const canJump = i !== step && i <= reachable;
            const inner = (
              <>
                <span className="dl-steps__num">{i < step ? <CheckIcon size={14} /> : i + 1}</span>
                <span className="dl-steps__label">{label}</span>
              </>
            );
            return (
              <li key={label} className={`dl-steps__item ${state}`} aria-current={i === step ? 'step' : undefined}>
                {canJump ? (
                  <button type="button" onClick={() => go(i)} aria-label={`Bước ${i + 1}: ${label}`}>
                    {inner}
                  </button>
                ) : (
                  <span className="dl-steps__static">{inner}</span>
                )}
              </li>
            );
          })}
        </ol>

        <div className="dl-step">
          <p className="dl-step__count">
            Bước {step + 1}/{STEPS.length}
          </p>
          <h3 className="dl-step__title" ref={headingRef} tabIndex={-1}>
            {STEP_TITLES[step]}
          </h3>

          {step === 0 && (
            <div className="dl-step__body">
              <p className="dl-step__lead">Chọn một hoặc nhiều dịch vụ. Tiệm làm liền một lượt.</p>
              {GROUP_ORDER.map((group) => (
                <div key={group} className="dl-optgroup" role="group" aria-label={GROUP_LABEL[group]}>
                  <p className="dl-optgroup__label">{GROUP_LABEL[group]}</p>
                  <div className="dl-options">
                    {SERVICES.filter((s) => s.group === group).map((s) => {
                      const on = draft.serviceIds.includes(s.id);
                      return (
                        <button key={s.id} type="button" className={`dl-option${on ? ' is-on' : ''}`} aria-pressed={on} onClick={() => toggleService(s.id)}>
                          <span className="dl-option__mark">{on && <CheckIcon size={14} />}</span>
                          <span className="dl-option__main">
                            <span className="dl-option__name">{s.name}</span>
                            <span className="dl-option__meta">{s.minutes} phút</span>
                          </span>
                          <span className="dl-option__price">{formatVnd(s.price)}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {step === 1 && (
            <div className="dl-step__body">
              <p className="dl-step__lead">Chọn thợ quen, hoặc để tiệm xếp người đang trống.</p>
              <div className="dl-people" role="group" aria-label="Chọn thợ">
                <button
                  type="button"
                  className={`dl-person${draft.stylistId === ANY_STYLIST ? ' is-on' : ''}`}
                  aria-pressed={draft.stylistId === ANY_STYLIST}
                  onClick={() => patch({ stylistId: ANY_STYLIST })}
                >
                  <AnyAvatar className="dl-person__avatar" />
                  <span className="dl-person__main">
                    <span className="dl-person__name">Ai cũng được</span>
                    <span className="dl-person__meta">Nhiều giờ trống nhất</span>
                  </span>
                  <span className="dl-option__mark">{draft.stylistId === ANY_STYLIST && <CheckIcon size={14} />}</span>
                </button>
                {STYLISTS.map((s) => {
                  const on = draft.stylistId === s.id;
                  return (
                    <button key={s.id} type="button" className={`dl-person${on ? ' is-on' : ''}`} aria-pressed={on} onClick={() => patch({ stylistId: s.id })}>
                      <Avatar look={s.look} className="dl-person__avatar" />
                      <span className="dl-person__main">
                        <span className="dl-person__name">{s.name}</span>
                        <span className="dl-person__meta">{s.role}</span>
                      </span>
                      <span className="dl-option__mark">{on && <CheckIcon size={14} />}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="dl-step__body">
              <p className="dl-step__lead">
                Lịch mở trước 14 ngày. Buổi hẹn dài {formatDuration(Math.max(totals.minutes, 30))}, tiệm đóng cửa lúc 20:00.
              </p>
              <div className="dl-days" role="group" aria-label="Chọn ngày">
                {days.map((d) => {
                  const on = d.key === draft.dateKey;
                  return (
                    <button
                      key={d.key}
                      type="button"
                      className={`dl-day${on ? ' is-on' : ''}`}
                      aria-pressed={on}
                      disabled={d.closed}
                      aria-label={`${d.isToday ? 'Hôm nay, ' : ''}${formatDayLong(d)}${d.closed ? ', tiệm nghỉ' : ''}`}
                      onClick={() => patch({ dateKey: d.key, slot: null })}
                    >
                      <span className="dl-day__wd">{d.isToday ? 'Hôm nay' : d.weekdayShort}</span>
                      <span className="dl-day__num">{d.day}</span>
                      <span className="dl-day__mo">{d.closed ? 'Nghỉ' : `Th ${d.month}`}</span>
                    </button>
                  );
                })}
              </div>

              {day === null && <p className="dl-empty">Chọn một ngày để xem giờ còn trống.</p>}
              {day !== null && slots.length === 0 && (
                <p className="dl-empty">
                  {day.isToday ? 'Hôm nay' : formatDayLong(day)} không còn khung giờ đủ dài cho {formatDuration(Math.max(totals.minutes, 30))}. Thử ngày khác
                  hoặc bớt dịch vụ.
                </p>
              )}
              {day !== null &&
                slots.length > 0 &&
                PERIODS.map((period) => {
                  const list = slots.filter((s) => slotPeriod(s.minutes) === period);
                  if (list.length === 0) return null;
                  return (
                    <div key={period} className="dl-optgroup" role="group" aria-label={`Giờ buổi ${PERIOD_LABEL[period].toLowerCase()}`}>
                      <p className="dl-optgroup__label">{PERIOD_LABEL[period]}</p>
                      <div className="dl-slots">
                        {list.map((s) => {
                          const on = slot?.minutes === s.minutes;
                          return (
                            <button
                              key={s.minutes}
                              type="button"
                              className={`dl-slot${on ? ' is-on' : ''}`}
                              aria-pressed={on}
                              disabled={!s.available}
                              onClick={() => patch({ slot: s.minutes })}
                            >
                              <span className="dl-slot__time">{s.label}</span>
                              {!s.available && <span className="dl-slot__full">Đã kín</span>}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
            </div>
          )}

          {step === 3 && (
            <div className="dl-step__body">
              <p className="dl-step__lead">Tiệm chỉ dùng thông tin này để nhắc lịch. Bản mẫu không lưu và không gửi đi đâu.</p>
              <div className="dl-form">
                {field('name', 'Họ tên', 'Ví dụ: Nguyễn Minh Anh', { autoComplete: 'name' })}
                {field('phone', 'Số điện thoại', 'Số di động 10 chữ số', { type: 'tel', inputMode: 'tel', autoComplete: 'tel' })}
                <div className={`dl-field dl-field--wide${noteError ? ' is-invalid' : ''}`}>
                  <label htmlFor="dl-field-note">
                    Ghi chú <span className="dl-field__opt">(không bắt buộc)</span>
                  </label>
                  <textarea
                    id="dl-field-note"
                    rows={3}
                    value={contact.note}
                    aria-invalid={noteError ? true : undefined}
                    aria-describedby={`dl-hint-note${noteError ? ' dl-err-note' : ''}`}
                    onChange={(e) => setContact((c) => ({ ...c, note: e.target.value }))}
                    onBlur={() => setTouched((t) => ({ ...t, note: true }))}
                  />
                  <p className="dl-field__hint" id="dl-hint-note">
                    Tóc đã tẩy, da đầu nhạy cảm, mang ảnh mẫu… {contact.note.length}/{NOTE_MAX} ký tự
                  </p>
                  {noteError && (
                    <p className="dl-field__error" id="dl-err-note">
                      {noteError}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="dl-step__body">
              <p className="dl-step__lead">Kiểm tra một lượt rồi xác nhận. Cần sửa gì, bấm “Sửa” ở dòng đó.</p>
              <ul className="dl-review">
                <li className="dl-review__row">
                  <span className="dl-review__k">Dịch vụ</span>
                  <span className="dl-review__v">
                    {chosen.map((s) => s.name).join(', ')}
                    <small>
                      {formatDuration(totals.minutes)} · {formatVnd(totals.price)}
                    </small>
                  </span>
                  <button type="button" className="dl-link" onClick={() => go(0)} aria-label="Sửa dịch vụ">
                    Sửa
                  </button>
                </li>
                <li className="dl-review__row">
                  <span className="dl-review__k">Thợ</span>
                  <span className="dl-review__v">{stylistText}</span>
                  <button type="button" className="dl-link" onClick={() => go(1)} aria-label="Sửa thợ">
                    Sửa
                  </button>
                </li>
                <li className="dl-review__row">
                  <span className="dl-review__k">Ngày giờ</span>
                  <span className="dl-review__v">
                    {day ? formatDayLong(day) : ''}
                    <small>{timeText}</small>
                  </span>
                  <button type="button" className="dl-link" onClick={() => go(2)} aria-label="Sửa ngày giờ">
                    Sửa
                  </button>
                </li>
                <li className="dl-review__row">
                  <span className="dl-review__k">Liên hệ</span>
                  <span className="dl-review__v">
                    {contact.name.trim()}
                    <small>{contact.phone.trim()}</small>
                    {contact.note.trim() !== '' && <small>Ghi chú: {contact.note.trim()}</small>}
                  </span>
                  <button type="button" className="dl-link" onClick={() => go(3)} aria-label="Sửa thông tin liên hệ">
                    Sửa
                  </button>
                </li>
              </ul>
              <p className="dl-review__note">Thanh toán tại tiệm sau khi làm xong. Đổi hoặc hủy miễn phí trước giờ hẹn 2 tiếng.</p>
            </div>
          )}
        </div>

        <div className="dl-nav">
          <p className="dl-nav__summary">
            <strong>{compact}</strong>
            <span>{day && slot ? `${formatDayLong(day)} · ${slot.label}` : 'Chưa chọn ngày giờ'}</span>
          </p>
          <p className="dl-nav__error" role="alert">
            {attempted && currentError !== null ? currentError : ''}
          </p>
          <div className="dl-nav__buttons">
            {step > 0 && (
              <button type="button" className="dl-btn dl-btn--ghost" onClick={() => go(step - 1)}>
                <BackIcon />
                <span>Quay lại</span>
              </button>
            )}
            <button type="button" className={`dl-btn dl-btn--primary${currentError !== null ? ' is-waiting' : ''}`} onClick={next}>
              <span>{step === LAST_STEP ? 'Xác nhận đặt lịch' : 'Tiếp tục'}</span>
              {step === LAST_STEP ? <CheckIcon /> : <ArrowIcon />}
            </button>
          </div>
        </div>
      </div>

      <aside className="dl-summary dl-c4 dl-t8" aria-labelledby="dl-summary-title">
        <h3 id="dl-summary-title">Lịch của bạn</h3>
        {chosen.length === 0 ? (
          <p className="dl-summary__empty">Chưa có dịch vụ nào. Chọn ở bước 1.</p>
        ) : (
          <ul className="dl-summary__list">
            {chosen.map((s) => (
              <li key={s.id}>
                <span>
                  {s.name}
                  <small>{s.minutes} phút</small>
                </span>
                <span className="dl-summary__price">{formatVnd(s.price)}</span>
              </li>
            ))}
          </ul>
        )}
        <dl className="dl-summary__facts">
          <div>
            <dt>Thợ</dt>
            <dd>{stylistText}</dd>
          </div>
          <div>
            <dt>Ngày</dt>
            <dd>{day ? formatDayLong(day) : 'Chưa chọn'}</dd>
          </div>
          <div>
            <dt>Giờ</dt>
            <dd>{timeText}</dd>
          </div>
        </dl>
        <div className="dl-summary__total">
          <span>
            <TimeIcon /> {totals.minutes > 0 ? formatDuration(totals.minutes) : '0 phút'}
          </span>
          <strong>{formatVnd(totals.price)}</strong>
        </div>
        <p className="dl-summary__foot">Giá minh họa. Trả tại tiệm, không cần đặt cọc.</p>
      </aside>
    </div>
  );
}
