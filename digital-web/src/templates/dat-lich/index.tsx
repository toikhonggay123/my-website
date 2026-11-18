import { useCallback, useEffect, useMemo, useState, type MouseEvent } from 'react';
import '@fontsource-variable/bricolage-grotesque/wght.css';
import './styles.css';
import { TemplateShell, useDemoNotice } from '../shared/TemplateShell';
import { ANY_STYLIST, GROUP_LABEL, SERVICES, STYLISTS, serviceById, stylistName, type Service } from './data';
import {
  EMPTY_DRAFT,
  formatDuration,
  formatVnd,
  getNextDays,
  minutesOfDay,
  nextFreeSlots,
  sanitizeDraft,
  sumServices,
  type Draft,
} from './slots';
import { Booking } from './Booking';
import { AnyAvatar, ArrowIcon, Avatar, CheckIcon, ClockMark, CombArt, MenuIcon, PlusIcon, ScissorsArt, TimeIcon, WaveArt } from './art';

const STORAGE_KEY = 'afyllx-demo-dat-lich';
const STYLIST_IDS = STYLISTS.map((s) => s.id);
const SERVICE_IDS = SERVICES.map((s) => s.id);

const NAV = [
  { id: 'dl-dich-vu', label: 'Dịch vụ' },
  { id: 'dl-tho', label: 'Thợ' },
  { id: 'dl-dat-lich', label: 'Đặt lịch' },
  { id: 'dl-thong-tin', label: 'Thông tin' },
];

/** Bố cục ô lưới của từng dịch vụ: số cột ở màn rộng / màn vừa, và kiểu ô. */
const TILE: Record<string, { span: string; tone: string }> = {
  'cat-nu': { span: 'dl-c6 dl-t8', tone: 'dl-tile--night' },
  'cat-nam': { span: 'dl-c3 dl-t4', tone: '' },
  'tia-mai': { span: 'dl-c3 dl-t4', tone: '' },
  'uon-song': { span: 'dl-c3 dl-t4', tone: '' },
  'nhuom-mau': { span: 'dl-c3 dl-t4', tone: '' },
  highlight: { span: 'dl-c6 dl-t8', tone: 'dl-tile--violet' },
  'goi-duong': { span: 'dl-c4 dl-t4', tone: '' },
  'hap-phuc-hoi': { span: 'dl-c4 dl-t4', tone: '' },
};

function readDraft(openKeys: string[]): Draft {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (raw === null) return EMPTY_DRAFT;
    return sanitizeDraft(JSON.parse(raw) as unknown, SERVICE_IDS, STYLIST_IDS, openKeys);
  } catch {
    return EMPTY_DRAFT;
  }
}

function jumpTo(id: string, focusId?: string) {
  const target = document.getElementById(id);
  if (!target) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  document.getElementById(focusId ?? `${id}-title`)?.focus({ preventScroll: true });
}

export default function DatLichTemplate() {
  const { notify, notice } = useDemoNotice();
  const [now] = useState(() => new Date());
  const days = useMemo(() => getNextDays(now), [now]);
  const [draft, setDraft] = useState<Draft>(() => readDraft(days.filter((d) => !d.closed).map((d) => d.key)));
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    try {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
    } catch {
      /* Không lưu được cũng không sao: trạng thái vẫn nằm trong bộ nhớ. */
    }
  }, [draft]);

  const patch = useCallback((change: Partial<Draft>) => setDraft((d) => ({ ...d, ...change })), []);
  const toggleService = useCallback(
    (id: string) =>
      setDraft((d) => ({
        ...d,
        serviceIds: d.serviceIds.includes(id) ? d.serviceIds.filter((x) => x !== id) : [...d.serviceIds, id],
      })),
    [],
  );

  const confirm = useCallback(() => {
    notify('Đây là bản mẫu, không có lịch hẹn nào được tạo.');
    setDraft(EMPTY_DRAFT);
  }, [notify]);

  const anchor = (id: string) => (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    setMenuOpen(false);
    jumpTo(id);
  };

  const chosen = draft.serviceIds.map(serviceById).filter((s): s is Service => s !== undefined);
  const totals = sumServices(chosen);
  const hints = useMemo(
    () =>
      nextFreeSlots(
        days,
        { stylistId: draft.stylistId ?? ANY_STYLIST, allStylistIds: STYLIST_IDS, duration: totals.minutes },
        minutesOfDay(now),
        4,
      ),
    [days, draft.stylistId, totals.minutes, now],
  );
  const pickedDay = days.find((d) => d.key === draft.dateKey);

  const pickStylist = (id: string) => {
    patch({ stylistId: id });
    jumpTo('dl-dat-lich');
  };

  return (
    <TemplateShell slug="dat-lich" title="Chín Giờ">
      <div className="tpl-dat-lich">
        <a className="dl-skip" href="#dl-main" onClick={(e) => { e.preventDefault(); jumpTo("dl-main", "dl-main"); }}>
          Bỏ qua, tới nội dung chính
        </a>

        <header className="dl-header">
          <div className="dl-wrap dl-header__in">
            <a className="dl-logo" href="#dl-top" onClick={anchor('dl-top')} aria-label="Chín Giờ, về đầu trang">
              <ClockMark />
              <span>Chín Giờ</span>
            </a>
            <button
              type="button"
              className="dl-menu-btn"
              aria-expanded={menuOpen}
              aria-controls="dl-nav"
              aria-label={menuOpen ? 'Đóng danh mục' : 'Mở danh mục'}
              onClick={() => setMenuOpen((o) => !o)}
            >
              <MenuIcon open={menuOpen} />
            </button>
            <nav id="dl-nav" className={`dl-nav-main${menuOpen ? ' is-open' : ''}`} aria-label="Điều hướng chính">
              <ul>
                {NAV.map((item) => (
                  <li key={item.id}>
                    <a href={`#${item.id}`} onClick={anchor(item.id)}>
                      {item.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
            <a className="dl-btn dl-btn--accent dl-header__cta" href="#dl-dat-lich" onClick={anchor('dl-dat-lich')}>
              Đặt lịch
            </a>
          </div>
        </header>

        <main id="dl-main" tabIndex={-1}>
          {/* ---------- Hero ---------- */}
          <section className="dl-hero" id="dl-top" aria-labelledby="dl-top-title">
            <div className="dl-hero__blob dl-hero__blob--a" aria-hidden="true" />
            <div className="dl-hero__blob dl-hero__blob--b" aria-hidden="true" />
            <div className="dl-wrap dl-grid dl-hero__grid">
              <div className="dl-hero__msg dl-c7 dl-t8">
                <p className="dl-chip dl-chip--onDark">
                  <TimeIcon /> Mở cửa 9:00 – 20:00 · Thứ Hai nghỉ
                </p>
                <h1 id="dl-top-title" tabIndex={-1}>
                  Chọn giờ,
                  <br />
                  <span className="dl-hl">đến là cắt.</span>
                </h1>
                <p className="dl-hero__lead">
                  Tiệm tóc Chín Giờ nhận lịch hẹn trên web. Bạn chọn dịch vụ, chọn thợ, chọn giờ. Đến nơi là ngồi vào ghế, không phải chờ.
                </p>
                <div className="dl-hero__actions">
                  <a className="dl-btn dl-btn--accent dl-btn--lg" href="#dl-dat-lich" onClick={anchor('dl-dat-lich')}>
                    <span>Đặt lịch ngay</span>
                    <ArrowIcon />
                  </a>
                  <a className="dl-btn dl-btn--onDark dl-btn--lg" href="#dl-dich-vu" onClick={anchor('dl-dich-vu')}>
                    Xem bảng giá
                  </a>
                </div>
              </div>

              <div className="dl-hero__side dl-c5 dl-t8">
                <ScissorsArt className="dl-hero__scissors" />
                <CombArt className="dl-hero__comb" />
                <div className="dl-preview">
                  <div className="dl-preview__head">
                    <h2>Lịch hẹn của bạn</h2>
                    <span className="dl-preview__live">Xem trước</span>
                  </div>
                  <dl className="dl-preview__rows">
                    <div>
                      <dt>Dịch vụ</dt>
                      <dd>{chosen.length > 0 ? chosen.map((s) => s.name).join(', ') : 'Chưa chọn'}</dd>
                    </div>
                    <div>
                      <dt>Thợ</dt>
                      <dd>{stylistName(draft.stylistId)}</dd>
                    </div>
                    <div>
                      <dt>Tổng</dt>
                      <dd>{totals.count > 0 ? `${formatDuration(totals.minutes)} · ${formatVnd(totals.price)}` : '0 ₫'}</dd>
                    </div>
                  </dl>
                  <p className="dl-preview__label" id="dl-quick-label">
                    Giờ trống gần nhất
                  </p>
                  {hints.length > 0 ? (
                    <div className="dl-preview__slots" role="group" aria-labelledby="dl-quick-label">
                      {hints.map((h) => {
                        const on = draft.dateKey === h.dateKey && draft.slot === h.minutes;
                        return (
                          <button
                            key={`${h.dateKey}-${h.minutes}`}
                            type="button"
                            className={`dl-quick${on ? ' is-on' : ''}`}
                            aria-pressed={on}
                            onClick={() => {
                              patch({ dateKey: h.dateKey, slot: h.minutes, stylistId: draft.stylistId ?? ANY_STYLIST });
                              jumpTo('dl-dat-lich');
                            }}
                          >
                            <small>{h.dayLabel}</small>
                            <strong>{h.timeLabel}</strong>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="dl-preview__none">Hai tuần tới chưa có giờ đủ dài. Thử bớt dịch vụ.</p>
                  )}
                  <p className="dl-preview__foot">
                    {pickedDay && draft.slot !== null ? 'Đã giữ giờ này trong lịch nháp của bạn.' : 'Bấm một giờ để giữ chỗ trong lịch nháp.'}
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* ---------- Dịch vụ ---------- */}
          <section className="dl-section" id="dl-dich-vu" aria-labelledby="dl-dich-vu-title">
            <div className="dl-wrap">
              <div className="dl-head">
                <p className="dl-eyebrow">Bảng giá</p>
                <h2 id="dl-dich-vu-title" tabIndex={-1}>
                  Dịch vụ và thời gian làm
                </h2>
                <p>Giá đã gồm gội và sấy. Bấm “Thêm vào lịch” để chọn, bạn chọn nhiều dịch vụ cho một lần hẹn được.</p>
              </div>
              <ul className="dl-grid dl-bento">
                {SERVICES.map((s) => {
                  const on = draft.serviceIds.includes(s.id);
                  const tile = TILE[s.id] ?? { span: 'dl-c4 dl-t4', tone: '' };
                  return (
                    <li key={s.id} className={`dl-tile ${tile.span} ${tile.tone}`}>
                      {s.id === 'cat-nu' && <ScissorsArt className="dl-tile__art" />}
                      {s.id === 'highlight' && <WaveArt className="dl-tile__art" />}
                      <p className="dl-pill">{GROUP_LABEL[s.group]}</p>
                      <h3>{s.name}</h3>
                      <p className="dl-tile__text">{s.blurb}</p>
                      <div className="dl-tile__foot">
                        <p className="dl-tile__meta">
                          <span>
                            <TimeIcon /> {s.minutes} phút
                          </span>
                          <strong>{formatVnd(s.price)}</strong>
                        </p>
                        <button
                          type="button"
                          className={`dl-add${on ? ' is-on' : ''}`}
                          aria-pressed={on}
                          aria-label={`${on ? 'Bỏ' : 'Thêm'} ${s.name} ${on ? 'khỏi' : 'vào'} lịch`}
                          onClick={() => toggleService(s.id)}
                        >
                          {on ? <CheckIcon size={16} /> : <PlusIcon size={16} />}
                          <span>{on ? 'Đã thêm' : 'Thêm vào lịch'}</span>
                        </button>
                      </div>
                    </li>
                  );
                })}
                <li className="dl-tile dl-tile--accent dl-c4 dl-t8">
                  <p className="dl-pill">Lịch nháp</p>
                  <h3>{totals.count > 0 ? `Đã chọn ${totals.count} dịch vụ` : 'Chưa chọn dịch vụ nào'}</h3>
                  <p className="dl-tile__text">
                    {totals.count > 0 ? `${formatDuration(totals.minutes)} · ${formatVnd(totals.price)}` : 'Chọn xong, chuyển sang bước chọn thợ và giờ.'}
                  </p>
                  <div className="dl-tile__foot">
                    <a className="dl-btn dl-btn--dark" href="#dl-dat-lich" onClick={anchor('dl-dat-lich')}>
                      <span>Chọn giờ</span>
                      <ArrowIcon />
                    </a>
                  </div>
                </li>
              </ul>
            </div>
          </section>

          {/* ---------- Thợ ---------- */}
          <section className="dl-section dl-section--tint" id="dl-tho" aria-labelledby="dl-tho-title">
            <div className="dl-wrap">
              <div className="dl-head">
                <p className="dl-eyebrow">Đội thợ</p>
                <h2 id="dl-tho-title" tabIndex={-1}>
                  Bốn người, bốn sở trường
                </h2>
                <p>Chọn đúng người cho kiểu tóc bạn muốn. Chưa biết chọn ai thì để tiệm xếp.</p>
              </div>
              <ul className="dl-grid dl-bento">
                {STYLISTS.map((s, i) => {
                  const wide = i === 0 || i === 3;
                  const on = draft.stylistId === s.id;
                  return (
                    <li key={s.id} className={`dl-tile dl-stylist ${wide ? 'dl-stylist--wide dl-c6 dl-t8' : 'dl-c3 dl-t4'}`}>
                      <Avatar look={s.look} className="dl-stylist__avatar" />
                      <div className="dl-stylist__body">
                        <p className="dl-pill">{s.role}</p>
                        <h3>{s.name}</h3>
                        <p className="dl-tile__text">{s.specialty}</p>
                        <ul className="dl-tags" aria-label={`Thế mạnh của ${s.name}`}>
                          {s.tags.map((t) => (
                            <li key={t}>{t}</li>
                          ))}
                        </ul>
                        <button type="button" className={`dl-add${on ? ' is-on' : ''}`} aria-pressed={on} onClick={() => pickStylist(s.id)}>
                          {on ? <CheckIcon size={16} /> : <PlusIcon size={16} />}
                          <span>{on ? `Đã chọn ${s.name}` : `Đặt với ${s.name}`}</span>
                        </button>
                      </div>
                    </li>
                  );
                })}
                <li className="dl-tile dl-tile--accent dl-stylist dl-stylist--wide dl-c6 dl-t8">
                  <AnyAvatar className="dl-stylist__avatar" />
                  <div className="dl-stylist__body">
                    <p className="dl-pill">Nhanh nhất</p>
                    <h3>Ai cũng được</h3>
                    <p className="dl-tile__text">Tiệm xếp người đang trống vào giờ bạn chọn. Cách này có nhiều khung giờ nhất.</p>
                    <button
                      type="button"
                      className={`dl-add dl-add--dark${draft.stylistId === ANY_STYLIST ? ' is-on' : ''}`}
                      aria-pressed={draft.stylistId === ANY_STYLIST}
                      onClick={() => pickStylist(ANY_STYLIST)}
                    >
                      {draft.stylistId === ANY_STYLIST ? <CheckIcon size={16} /> : <PlusIcon size={16} />}
                      <span>{draft.stylistId === ANY_STYLIST ? 'Đã chọn' : 'Để tiệm xếp'}</span>
                    </button>
                  </div>
                </li>
              </ul>
            </div>
          </section>

          {/* ---------- Đặt lịch ---------- */}
          <section className="dl-section dl-section--book" id="dl-dat-lich" aria-labelledby="dl-dat-lich-title">
            <div className="dl-wrap">
              <div className="dl-head">
                <p className="dl-eyebrow">Đặt lịch</p>
                <h2 id="dl-dat-lich-title" tabIndex={-1}>
                  Năm bước, chừng một phút
                </h2>
                <p>Không cần tài khoản. Không cần đặt cọc.</p>
              </div>
              <Booking draft={draft} patch={patch} toggleService={toggleService} days={days} now={now} onConfirm={confirm} />
            </div>
          </section>

          {/* ---------- Thông tin ---------- */}
          <section className="dl-section" id="dl-thong-tin" aria-labelledby="dl-thong-tin-title">
            <div className="dl-wrap">
              <div className="dl-head">
                <p className="dl-eyebrow">Trước khi đến</p>
                <h2 id="dl-thong-tin-title" tabIndex={-1}>
                  Giờ mở cửa và quy định lịch hẹn
                </h2>
                <p>Nội dung dưới đây là chính sách minh họa của bản mẫu.</p>
              </div>
              <div className="dl-grid dl-bento">
                <article className="dl-tile dl-tile--night dl-c4 dl-t8">
                  <p className="dl-pill">Giờ mở cửa</p>
                  <h3>Chín giờ sáng là mở</h3>
                  <dl className="dl-hours">
                    <div>
                      <dt>Thứ Ba – Chủ nhật</dt>
                      <dd>9:00 – 20:00</dd>
                    </div>
                    <div>
                      <dt>Thứ Hai</dt>
                      <dd>Nghỉ</dd>
                    </div>
                    <div>
                      <dt>Nhận khách cuối</dt>
                      <dd>Tùy dịch vụ, xong trước 20:00</dd>
                    </div>
                  </dl>
                </article>
                <article className="dl-tile dl-c4 dl-t4">
                  <p className="dl-pill">Đổi, hủy lịch</p>
                  <h3>Miễn phí trước 2 tiếng</h3>
                  <ul className="dl-rules">
                    <li>Đổi giờ hoặc hủy trước giờ hẹn 2 tiếng: không mất phí.</li>
                    <li>Báo muộn hơn: tiệm vẫn nhận, nhưng lần sau cần xác nhận lại qua điện thoại.</li>
                    <li>Mỗi lịch hẹn đổi giờ tối đa 2 lần.</li>
                  </ul>
                </article>
                <article className="dl-tile dl-c4 dl-t4">
                  <p className="dl-pill">Đến trễ</p>
                  <h3>Giữ ghế 10 phút</h3>
                  <ul className="dl-rules">
                    <li>Trễ quá 10 phút, tiệm có thể rút ngắn dịch vụ hoặc dời sang khung kế tiếp.</li>
                    <li>Uốn, nhuộm, tẩy: nên đến sớm 5 phút để thợ xem tóc.</li>
                    <li>Thanh toán tại tiệm sau khi làm xong.</li>
                  </ul>
                </article>
              </div>
            </div>
          </section>
        </main>

        <footer className="dl-footer">
          <div className="dl-wrap dl-grid">
            <div className="dl-c6 dl-t8">
              <p className="dl-logo dl-logo--footer">
                <ClockMark size={32} />
                <span>Chín Giờ</span>
              </p>
              <p>Tiệm tóc Chín Giờ (doanh nghiệp minh họa). Mọi tên thợ, giá và lịch trống trên trang này là dữ liệu mẫu.</p>
            </div>
            <div className="dl-c3 dl-t4">
              <p className="dl-footer__label">Liên hệ</p>
              <ul>
                <li>Địa chỉ: (địa chỉ minh họa)</li>
                <li>Điện thoại: (số điện thoại minh họa)</li>
                <li>Email: (email minh họa)</li>
              </ul>
            </div>
            <div className="dl-c3 dl-t4">
              <p className="dl-footer__label">Trên trang</p>
              <ul>
                {NAV.map((item) => (
                  <li key={item.id}>
                    <a href={`#${item.id}`} onClick={anchor(item.id)}>
                      {item.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </footer>
      </div>
      {notice}
    </TemplateShell>
  );
}
