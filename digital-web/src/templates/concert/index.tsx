import { useEffect, useRef, useState, type CSSProperties, type FormEvent, type PointerEvent as ReactPointerEvent } from 'react';
import '@fontsource-variable/bricolage-grotesque/wdth.css';
import './styles.css';
import { TemplateShell, useDemoNotice } from '../shared/TemplateShell';
import { startScene } from './scene';

/** Bản mẫu trang giới thiệu concert. "Vô Cực", nghệ sĩ, địa điểm, giá vé và lịch diễn đều hư cấu. */

const SHOW_START = new Date('2027-03-20T18:00:00+07:00').getTime();
const STEP = 45; // 8 nghệ sĩ chia đều một vòng
const MAX_QTY = 6;

const ARTISTS = [
  { name: 'Thiên Hà 9', kind: 'Electro pop', night: 1, time: '21:30', blurb: 'Chín thành viên, ba bộ trống điện tử và một dàn hợp xướng đứng sau màn LED.', from: '#ff3d2e', to: '#ffb02e' },
  { name: 'Mộc Tinh', kind: 'House', night: 1, time: '20:15', blurb: 'Những bản house chậm rãi, bass tròn, hợp lúc trời vừa tối.', from: '#4a6cff', to: '#9b5cff' },
  { name: 'Bụi Sao', kind: 'Indie', night: 1, time: '19:00', blurb: 'Ban nhạc bốn người mở màn đêm đầu bằng guitar và kèn đồng.', from: '#ff5fa2', to: '#ff3d2e' },
  { name: 'Quỹ Đạo', kind: 'Techno', night: 1, time: '23:00', blurb: 'Set khép đêm một: nhanh, tối, không nghỉ.', from: '#2ee6c8', to: '#4a6cff' },
  { name: 'Sao Chổi', kind: 'Rap', night: 2, time: '20:00', blurb: 'Rapper kể chuyện thành phố trên nền trống sống.', from: '#ffb02e', to: '#ff5fa2' },
  { name: 'Tinh Vân', kind: 'Ambient', night: 2, time: '18:45', blurb: 'Đón hoàng hôn đêm hai bằng âm thanh trôi và đàn tranh.', from: '#9b5cff', to: '#2ee6c8' },
  { name: 'Hố Đen Nhỏ', kind: 'Drum and bass', night: 2, time: '21:30', blurb: 'Bộ đôi DJ và tay trống, nhịp 174 từ đầu tới cuối.', from: '#ff3d2e', to: '#9b5cff' },
  { name: 'Nova Lạc', kind: 'Pop', night: 2, time: '23:00', blurb: 'Giọng ca chính của đêm bế mạc, hát cùng dàn dây 20 người.', from: '#4a6cff', to: '#ff5fa2' },
] as const;

const TIERS = [
  { id: 'ngoai', name: 'Quỹ đạo ngoài', zone: 'Khu đứng phía sau', price: 590_000, perks: ['Vào cổng từ 17:00', 'Màn hình phụ hai bên'] },
  { id: 'tam', name: 'Tâm bão', zone: 'Khu đứng sát sân khấu', price: 1_190_000, perks: ['Vào cổng sớm từ 16:00', 'Lối đi riêng', 'Vòng tay phát sáng'] },
  { id: 'doan', name: 'Phi hành đoàn', zone: 'Khán đài VIP có ghế', price: 2_490_000, perks: ['Ghế ngồi nhìn thẳng sân khấu', 'Quầy nước riêng', 'Áo lưu niệm', 'Gửi đồ miễn phí'] },
] as const;

const NIGHTS = [
  { id: 'd1', label: 'Đêm 1', date: 'Thứ Bảy 20.03', factor: 1 },
  { id: 'd2', label: 'Đêm 2', date: 'Chủ nhật 21.03', factor: 1 },
  { id: 'both', label: 'Cả hai đêm', date: 'Giảm 10%', factor: 1.8 },
] as const;

const INFO = [
  { title: 'Địa điểm', text: 'Sân vận động Hải Âu, bờ đông sông Hàn. Cách trung tâm 15 phút đi xe.' },
  { title: 'Giờ mở cổng', text: '17:00 mỗi ngày. Tiết mục đầu tiên lúc 18:45, kết thúc trước 00:30.' },
  { title: 'Độ tuổi', text: 'Từ 16 tuổi. Khán giả dưới 18 tuổi cần đi cùng người lớn.' },
  { title: 'Mang theo', text: 'Vé điện tử và giấy tờ tùy thân. Không mang chai thủy tinh, pháo sáng.' },
];

const NAV = [
  { id: 'cc-nghe-si', label: 'Nghệ sĩ' },
  { id: 'cc-lich', label: 'Lịch diễn' },
  { id: 'cc-thong-tin', label: 'Thông tin' },
];

const formatVnd = (value: number) => `${Math.round(value).toLocaleString('vi-VN')} ₫`;
const pad = (value: number) => String(value).padStart(2, '0');
const mod = (value: number, size: number) => ((value % size) + size) % size;

function useCountdown() {
  const [left, setLeft] = useState(() => Math.max(0, SHOW_START - Date.now()));
  useEffect(() => {
    const timer = window.setInterval(() => setLeft(Math.max(0, SHOW_START - Date.now())), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const seconds = Math.floor(left / 1000);
  return [
    { value: Math.floor(seconds / 86400), label: 'ngày' },
    { value: Math.floor(seconds / 3600) % 24, label: 'giờ' },
    { value: Math.floor(seconds / 60) % 60, label: 'phút' },
    { value: seconds % 60, label: 'giây' },
  ];
}

/** Vé nghiêng theo con trỏ, có vệt sáng chạy theo. */
function Ticket({ tier, selected, onSelect }: { tier: (typeof TIERS)[number]; selected: boolean; onSelect: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const move = (event: ReactPointerEvent) => {
    const el = ref.current;
    if (!el || event.pointerType === 'touch') return;
    const rect = el.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    el.style.setProperty('--ry', `${(x - 0.5) * 22}deg`);
    el.style.setProperty('--rx', `${(0.5 - y) * 16}deg`);
    el.style.setProperty('--gx', `${x * 100}%`);
    el.style.setProperty('--gy', `${y * 100}%`);
  };
  const leave = () => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty('--ry', '0deg');
    el.style.setProperty('--rx', '0deg');
  };
  return (
    <div className={`cc-ticket${selected ? ' is-on' : ''}`} ref={ref} onPointerMove={move} onPointerLeave={leave}>
      <div className="cc-ticket__face">
        <div className="cc-ticket__top">
          <p className="cc-ticket__zone">{tier.zone}</p>
          <h3>{tier.name}</h3>
          <p className="cc-ticket__price">
            {formatVnd(tier.price)} <span>mỗi đêm</span>
          </p>
        </div>
        <ul>
          {tier.perks.map((perk) => (
            <li key={perk}>{perk}</li>
          ))}
        </ul>
        <button type="button" className="cc-btn cc-btn--ticket" aria-pressed={selected} onClick={onSelect}>
          {selected ? 'Đang chọn hạng này' : 'Chọn hạng này'}
        </button>
      </div>
    </div>
  );
}

export default function Concert() {
  const { notify, notice } = useDemoNotice();
  const countdown = useCountdown();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const heroRef = useRef<HTMLElement>(null);
  const [angle, setAngle] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [auto, setAuto] = useState(true);
  const [tierId, setTierId] = useState<string>(TIERS[1].id);
  const [nightId, setNightId] = useState<string>(NIGHTS[0].id);
  const [qty, setQty] = useState(2);
  const [scheduleNight, setScheduleNight] = useState(1);
  const drag = useRef({ startX: 0, startAngle: 0, moved: false });

  const reduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Cảnh sân khấu 3D phía sau tiêu đề.
  useEffect(() => {
    if (!canvasRef.current) return;
    return startScene(canvasRef.current, reduced);
  }, [reduced]);

  // Tiêu đề 3D nghiêng theo con trỏ.
  useEffect(() => {
    const hero = heroRef.current;
    if (!hero || reduced || !window.matchMedia('(hover: hover)').matches) return;
    let frame = 0;
    let x = 0;
    let y = 0;
    const apply = () => {
      frame = 0;
      hero.style.setProperty('--tx', `${x * 16}deg`);
      hero.style.setProperty('--ty', `${y * -10}deg`);
    };
    const onMove = (event: PointerEvent) => {
      x = event.clientX / window.innerWidth - 0.5;
      y = event.clientY / window.innerHeight - 0.5;
      if (!frame) frame = requestAnimationFrame(apply);
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onMove);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [reduced]);

  // Vòng nghệ sĩ tự xoay cho tới khi khách chạm vào.
  useEffect(() => {
    if (!auto || reduced) return;
    const timer = window.setInterval(() => setAngle((value) => value - STEP), 3200);
    return () => window.clearInterval(timer);
  }, [auto, reduced]);

  const active = mod(Math.round(-angle / STEP), ARTISTS.length);
  const artist = ARTISTS[active];
  const turn = (steps: number) => {
    setAuto(false);
    setAngle((value) => Math.round(value / STEP) * STEP - steps * STEP);
  };
  /** Xoay theo đường ngắn nhất để nghệ sĩ thứ index ra phía trước. */
  const face = (index: number) => {
    let delta = mod(index - active, ARTISTS.length);
    if (delta > ARTISTS.length / 2) delta -= ARTISTS.length;
    turn(delta);
  };
  const onRingDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    drag.current = { startX: event.clientX, startAngle: angle, moved: false };
    setDragging(true);
    setAuto(false);
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onRingMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    const dx = event.clientX - drag.current.startX;
    if (Math.abs(dx) > 6) drag.current.moved = true;
    setAngle(drag.current.startAngle + dx * 0.32);
  };
  const onRingUp = () => {
    if (!dragging) return;
    setDragging(false);
    setAngle((value) => Math.round(value / STEP) * STEP);
  };

  const tier = TIERS.find((item) => item.id === tierId) ?? TIERS[1];
  const night = NIGHTS.find((item) => item.id === nightId) ?? NIGHTS[0];
  const total = tier.price * night.factor * qty;
  const order = (event: FormEvent) => {
    event.preventDefault();
    notify('Đây là bản mẫu, không có vé nào được giữ hay bán.');
  };

  const lineup = ARTISTS.filter((item) => item.night === scheduleNight).sort((a, b) => a.time.localeCompare(b.time));

  return (
    <TemplateShell slug="concert" title="Vô Cực 2027">
      <div className="tpl-concert">
        <header className="cc-nav">
          <a className="cc-nav__brand" href="#cc-top">
            Vô Cực
          </a>
          <nav aria-label="Trong trang">
            {NAV.map((item) => (
              <a key={item.id} href={`#${item.id}`}>
                {item.label}
              </a>
            ))}
          </nav>
          <a className="cc-btn cc-btn--sm" href="#cc-ve">
            Mua vé
          </a>
        </header>

        <main>
          <section className="cc-hero" id="cc-top" ref={heroRef}>
            <canvas className="cc-hero__scene" ref={canvasRef} aria-hidden="true" />
            <div className="cc-hero__inner">
              <p className="cc-hero__date">20 và 21.03.2027, Sân vận động Hải Âu</p>
              <h1 className="cc-title" aria-label="Vô Cực">
                {Array.from({ length: 9 }, (_, i) => (
                  <span key={i} aria-hidden="true" style={{ '--d': 9 - i } as CSSProperties}>
                    VÔ CỰC
                  </span>
                ))}
                <span aria-hidden="true" className="cc-title__front">
                  VÔ CỰC
                </span>
              </h1>
              <p className="cc-hero__lead">Hai đêm nhạc điện tử ngoài trời, tám nghệ sĩ, một sân khấu dài 60 mét.</p>
              <dl className="cc-count" aria-label="Thời gian còn lại tới đêm diễn đầu tiên">
                {countdown.map((part) => (
                  <div key={part.label}>
                    <dd>{pad(part.value)}</dd>
                    <dt>{part.label}</dt>
                  </div>
                ))}
              </dl>
              <div className="cc-hero__cta">
                <a className="cc-btn" href="#cc-ve">
                  Mua vé
                </a>
                <a className="cc-btn cc-btn--ghost" href="#cc-nghe-si">
                  Xem nghệ sĩ
                </a>
              </div>
            </div>
          </section>

          <section className="cc-lineup" id="cc-nghe-si">
            <div className="cc-wrap">
              <h2>Tám cái tên, hai đêm</h2>
              <p className="cc-sub">Kéo vòng tròn hoặc bấm mũi tên để xoay. Bấm vào một nghệ sĩ để đưa ra phía trước.</p>
            </div>
            <div
              className={`cc-ring${dragging ? ' is-dragging' : ''}`}
              onPointerDown={onRingDown}
              onPointerMove={onRingMove}
              onPointerUp={onRingUp}
              onPointerCancel={onRingUp}
            >
              <div className="cc-ring__spin" style={{ '--a': `${angle}deg` } as CSSProperties}>
                {ARTISTS.map((item, index) => {
                  const distance = Math.min(mod(index - active, ARTISTS.length), mod(active - index, ARTISTS.length));
                  return (
                    <button
                      key={item.name}
                      type="button"
                      className={`cc-card${index === active ? ' is-front' : ''}`}
                      style={{ '--i': index, '--from': item.from, '--to': item.to, '--fade': distance } as CSSProperties}
                      tabIndex={index === active ? 0 : -1}
                      aria-label={`${item.name}, ${item.kind}`}
                      onClick={() => {
                        if (!drag.current.moved) face(index);
                      }}
                    >
                      <span className="cc-card__art" aria-hidden="true">
                        {item.name.charAt(0)}
                      </span>
                      <span className="cc-card__name">{item.name}</span>
                      <span className="cc-card__kind">{item.kind}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="cc-wrap cc-lineup__foot">
              <button type="button" className="cc-arrow" onClick={() => turn(-1)} aria-label="Nghệ sĩ trước">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M15 5l-7 7 7 7" />
                </svg>
              </button>
              <div className="cc-lineup__detail" aria-live="polite">
                <h3>{artist.name}</h3>
                <p className="cc-lineup__slot">
                  {artist.kind}, đêm {artist.night} lúc {artist.time}
                </p>
                <p>{artist.blurb}</p>
              </div>
              <button type="button" className="cc-arrow" onClick={() => turn(1)} aria-label="Nghệ sĩ tiếp theo">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </section>

          <section className="cc-tickets" id="cc-ve">
            <div className="cc-wrap">
              <h2>Chọn chỗ đứng của bạn</h2>
              <p className="cc-sub">Ba hạng vé. Giá dưới đây là cho một đêm.</p>
              <div className="cc-tickets__row">
                {TIERS.map((item) => (
                  <Ticket key={item.id} tier={item} selected={item.id === tierId} onSelect={() => setTierId(item.id)} />
                ))}
              </div>

              <form className="cc-order" onSubmit={order}>
                <fieldset>
                  <legend>Bạn đi đêm nào</legend>
                  <div className="cc-nights">
                    {NIGHTS.map((item) => (
                      <label key={item.id}>
                        <input type="radio" name="night" value={item.id} checked={nightId === item.id} onChange={() => setNightId(item.id)} />
                        <span>
                          <b>{item.label}</b>
                          {item.date}
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                <div className="cc-qty">
                  <span id="cc-qty-label">Số vé</span>
                  <div role="group" aria-labelledby="cc-qty-label">
                    <button type="button" onClick={() => setQty((value) => Math.max(1, value - 1))} disabled={qty === 1} aria-label="Bớt một vé">
                      −
                    </button>
                    <output aria-live="polite">{qty}</output>
                    <button type="button" onClick={() => setQty((value) => Math.min(MAX_QTY, value + 1))} disabled={qty === MAX_QTY} aria-label="Thêm một vé">
                      +
                    </button>
                  </div>
                </div>
                <p className="cc-order__total">
                  <span>
                    {qty} vé {tier.name}, {night.label.toLowerCase()}
                  </span>
                  <strong>{formatVnd(total)}</strong>
                </p>
                <button className="cc-btn cc-btn--wide" type="submit">
                  Giữ {qty} vé
                </button>
              </form>
            </div>
          </section>

          <section className="cc-schedule" id="cc-lich">
            <div className="cc-wrap">
              <h2>Lịch diễn từng đêm</h2>
              <div className="cc-tabs" role="tablist" aria-label="Chọn đêm diễn">
                {[1, 2].map((value) => (
                  <button
                    key={value}
                    type="button"
                    role="tab"
                    id={`cc-tab-${value}`}
                    aria-selected={scheduleNight === value}
                    aria-controls="cc-panel"
                    onClick={() => setScheduleNight(value)}
                  >
                    Đêm {value}
                    <small>{value === 1 ? 'Thứ Bảy 20.03' : 'Chủ nhật 21.03'}</small>
                  </button>
                ))}
              </div>
              <ol className="cc-times" id="cc-panel" role="tabpanel" aria-labelledby={`cc-tab-${scheduleNight}`}>
                <li>
                  <time>17:00</time>
                  <span>Mở cổng</span>
                </li>
                {lineup.map((item) => (
                  <li key={item.name}>
                    <time>{item.time}</time>
                    <span>
                      {item.name}
                      <small>{item.kind}</small>
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          </section>

          <section className="cc-info" id="cc-thong-tin">
            <div className="cc-wrap">
              <h2>Trước khi lên đường</h2>
              <dl className="cc-info__grid">
                {INFO.map((item) => (
                  <div key={item.title}>
                    <dt>{item.title}</dt>
                    <dd>{item.text}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </section>
        </main>

        <footer className="cc-foot">
          <div className="cc-wrap">
            <p>Vô Cực là đêm nhạc hư cấu dùng cho bản mẫu. Nghệ sĩ, địa điểm, lịch diễn và giá vé đều là minh họa.</p>
          </div>
        </footer>
        {notice}
      </div>
    </TemplateShell>
  );
}
