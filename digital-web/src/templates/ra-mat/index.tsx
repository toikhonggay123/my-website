import { useEffect, useId, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import '@fontsource-variable/bricolage-grotesque/wght.css';
import './styles.css';
import { TemplateShell, useDemoNotice } from '../shared/TemplateShell';

/** Bản mẫu trang ra mắt sản phẩm. "Vọng" và loa S1 là thương hiệu, sản phẩm hư cấu; mọi thông số là minh họa. */

const FINISHES = [
  { id: 'dat-nung', name: 'Đất nung', color: '#c2532b', ink: '#fff' },
  { id: 'reu', name: 'Rêu', color: '#4f6d4b', ink: '#fff' },
  { id: 'cat', name: 'Cát', color: '#d8c4a0', ink: '#2a2118' },
  { id: 'muc', name: 'Mực', color: '#262a33', ink: '#fff' },
] as const;

const PRICE = 1_290_000;
const MAX_QTY = 5;
const ENGRAVE_MAX = 12;

const STORY = [
  { title: 'Âm thanh tỏa đủ 360 độ', text: 'Hai màng loa đặt đối lưng nhau. Ngồi ở góc nào của căn phòng cũng nghe rõ như nhau.' },
  { title: 'Gặp mưa rào vẫn hát', text: 'Chống nước, chống bụi chuẩn IP67. Dính cát thì rửa thẳng dưới vòi.' },
  { title: 'Hai chiếc ghép thành một dàn', text: 'Chạm hai chiếc S1 vào nhau, chúng tự chia kênh trái và phải.' },
];

const SPECS = [
  { value: '540 g', label: 'Trọng lượng', note: 'Nhẹ hơn một chai nước nửa lít' },
  { value: '24 giờ', label: 'Thời lượng pin', note: 'Ở mức âm lượng vừa' },
  { value: 'IP67', label: 'Chống nước, bụi', note: 'Ngâm nước 1 mét trong 30 phút' },
  { value: '5.3', label: 'Bluetooth', note: 'Nối cùng lúc hai điện thoại' },
  { value: 'USB-C', label: 'Cổng sạc', note: 'Dùng chung sạc điện thoại' },
  { value: '24 tháng', label: 'Bảo hành', note: 'Đổi mới trong 30 ngày đầu' },
];

const NAV = [
  { id: 'rm-am-thanh', label: 'Âm thanh' },
  { id: 'rm-pin', label: 'Pin' },
  { id: 'rm-thong-so', label: 'Thông số' },
];

const formatVnd = (value: number) => `${value.toLocaleString('vi-VN')} ₫`;

/** Chiếc loa vẽ bằng SVG; màu thân lấy từ biến CSS --rm-c của phần tử bao ngoài. */
function Speaker({ engraving = '', className = '' }: { engraving?: string; className?: string }) {
  const id = useId().replace(/:/g, '');
  const body = 'M30 52v196a70 22 0 0 0 140 0V52z';
  return (
    <svg className={`rm-speaker ${className}`} viewBox="0 0 200 290" role="img" aria-label="Loa không dây Vọng S1">
      <defs>
        <linearGradient id={`${id}s`} x1="0" x2="1">
          <stop offset="0" stopColor="#000" stopOpacity=".42" />
          <stop offset=".3" stopColor="#000" stopOpacity="0" />
          <stop offset=".62" stopColor="#fff" stopOpacity=".2" />
          <stop offset=".78" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity=".38" />
        </linearGradient>
        <pattern id={`${id}g`} width="7" height="7" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="1.25" fill="#000" fillOpacity=".3" />
          <circle cx="5.5" cy="5.5" r="1.25" fill="#000" fillOpacity=".3" />
        </pattern>
        <clipPath id={`${id}c`}>
          <path d={body} />
        </clipPath>
      </defs>
      <path d="M168 96c26 6 26 62 0 70" fill="none" stroke="#17181c" strokeWidth="9" strokeLinecap="round" />
      <path d={body} fill="var(--rm-c)" />
      <g clipPath={`url(#${id}c)`}>
        <rect x="30" y="74" width="140" height="128" fill={`url(#${id}g)`} />
        <rect x="30" y="206" width="140" height="70" fill="#000" fillOpacity=".16" />
      </g>
      <path d={body} fill={`url(#${id}s)`} />
      <ellipse cx="100" cy="52" rx="70" ry="22" fill="var(--rm-c)" />
      <ellipse cx="100" cy="52" rx="70" ry="22" fill="#fff" fillOpacity=".16" />
      <ellipse cx="100" cy="52" rx="48" ry="14" fill="none" stroke="#fff" strokeOpacity=".7" strokeWidth="2.5" className="rm-speaker__ring" />
      <circle cx="100" cy="52" r="4" fill="#fff" fillOpacity=".85" />
      <text x="100" y="232" textAnchor="middle" className="rm-speaker__text">
        {engraving || 'VỌNG'}
      </text>
    </svg>
  );
}

export default function RaMat() {
  const { notify, notice } = useDemoNotice();
  const [finish, setFinish] = useState<(typeof FINISHES)[number]>(FINISHES[0]);
  const [qty, setQty] = useState(1);
  const [engraving, setEngraving] = useState('');
  const [stage, setStage] = useState(0);
  const [charged, setCharged] = useState(false);
  const pinRef = useRef<HTMLElement>(null);
  const batteryRef = useRef<HTMLElement>(null);

  // Đoạn ghim: tiến độ cuộn (0..1) ghi vào --rm-p, và chọn câu chuyện đang hiện.
  useEffect(() => {
    const el = pinRef.current;
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      // quãng ghim = chiều cao cả đoạn trừ chiều cao khung dính; khung dính bắt đầu ghim ở vị trí top của nó
      const sticky = el.firstElementChild as HTMLElement;
      const total = el.offsetHeight - sticky.offsetHeight;
      const stuckAt = parseFloat(getComputedStyle(sticky).top) || 0;
      const p = total > 0 ? Math.min(1, Math.max(0, (stuckAt - el.getBoundingClientRect().top) / total)) : 0;
      el.style.setProperty('--rm-p', p.toFixed(4));
      setStage(Math.min(STORY.length - 1, Math.floor(p * STORY.length)));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  // Thanh pin đầy dần khi cuộn tới.
  useEffect(() => {
    const el = batteryRef.current;
    if (!el) return;
    if (!('IntersectionObserver' in window)) {
      setCharged(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setCharged(true);
          io.disconnect();
        }
      },
      { threshold: 0.35 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const order = (event: FormEvent) => {
    event.preventDefault();
    notify('Đây là bản mẫu, không có đơn đặt trước nào được tạo.');
  };
  const subscribe = (event: FormEvent) => {
    event.preventDefault();
    notify('Đây là bản mẫu, email của bạn không được gửi hay lưu ở đâu cả.');
  };

  const tone = { '--rm-c': finish.color, '--rm-c-ink': finish.ink } as CSSProperties;

  return (
    <TemplateShell slug="ra-mat" title="Vọng S1">
      <div className="tpl-ra-mat" style={tone}>
        <header className="rm-nav">
          <a className="rm-nav__brand" href="#rm-top">
            Vọng <span>S1</span>
          </a>
          <nav aria-label="Trong trang">
            {NAV.map((item) => (
              <a key={item.id} href={`#${item.id}`}>
                {item.label}
              </a>
            ))}
          </nav>
          <a className="rm-btn rm-btn--sm" href="#rm-dat-truoc">
            Đặt trước
          </a>
        </header>

        <main>
          <section className="rm-hero" id="rm-top">
            <p className="rm-hero__when">Mở bán tháng 12</p>
            <h1>Vọng S1</h1>
            <div className="rm-hero__stage">
              <span className="rm-hero__disc" aria-hidden="true" />
              <Speaker />
            </div>
            <p className="rm-hero__tag">Nhỏ bằng lon nước, đầy cả căn phòng</p>
            <p className="rm-hero__lead">Loa không dây 360 độ, pin 24 giờ, chống nước. Giá mở bán {formatVnd(PRICE)}.</p>
            <div className="rm-hero__cta">
              <a className="rm-btn" href="#rm-dat-truoc">
                Đặt trước
              </a>
              <a className="rm-btn rm-btn--ghost" href="#rm-thong-so">
                Xem thông số
              </a>
            </div>
          </section>

          <section className="rm-pin" id="rm-am-thanh" ref={pinRef} data-stage={stage} aria-label="Ba điểm chính của Vọng S1">
            <div className="rm-pin__sticky">
              <div className="rm-pin__scene" aria-hidden="true">
                <span className="rm-ring" />
                <span className="rm-ring" />
                <span className="rm-ring" />
                <span className="rm-rain">
                  {Array.from({ length: 14 }, (_, i) => (
                    <i key={i} style={{ '--i': i } as CSSProperties} />
                  ))}
                </span>
                <Speaker className="rm-pin__twin" />
                <Speaker className="rm-pin__main" />
              </div>
              <ol className="rm-pin__story">
                {STORY.map((item, index) => (
                  <li key={item.title} className={index === stage ? 'is-on' : undefined}>
                    <h2>{item.title}</h2>
                    <p>{item.text}</p>
                  </li>
                ))}
              </ol>
              <div className="rm-pin__dots" aria-hidden="true">
                {STORY.map((item, index) => (
                  <i key={item.title} className={index === stage ? 'is-on' : undefined} />
                ))}
              </div>
            </div>
          </section>

          <section className={`rm-battery${charged ? ' is-charged' : ''}`} id="rm-pin" ref={batteryRef}>
            <div className="rm-wrap">
              <h2>
                <strong>24 giờ</strong>
                Sạc tối thứ Sáu, nghe hết cuối tuần
              </h2>
              <div className="rm-battery__bar" aria-hidden="true">
                {Array.from({ length: 24 }, (_, i) => (
                  <i key={i} style={{ '--i': i } as CSSProperties} />
                ))}
              </div>
              <ul className="rm-battery__facts">
                <li>
                  <b>15 phút sạc</b>
                  <span>đủ nghe thêm 3 giờ</span>
                </li>
                <li>
                  <b>USB-C</b>
                  <span>dùng chung sạc điện thoại</span>
                </li>
                <li>
                  <b>Sạc ngược</b>
                  <span>cứu điện thoại khi cần</span>
                </li>
              </ul>
            </div>
          </section>

          <section className="rm-specs" id="rm-thong-so">
            <div className="rm-wrap">
              <h2>Những con số đáng biết</h2>
              <dl className="rm-specs__grid">
                {SPECS.map((spec) => (
                  <div key={spec.label}>
                    <dt>{spec.label}</dt>
                    <dd>
                      <strong>{spec.value}</strong>
                      {spec.note}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </section>

          <section className="rm-buy" id="rm-dat-truoc">
            <div className="rm-wrap rm-buy__grid">
              <div className="rm-buy__preview">
                <span className="rm-hero__disc" aria-hidden="true" />
                <Speaker engraving={engraving.trim()} />
              </div>
              <form className="rm-buy__form" onSubmit={order}>
                <h2>Chọn chiếc S1 của bạn</h2>
                <p className="rm-buy__price">{formatVnd(PRICE)}</p>

                <fieldset>
                  <legend>
                    Màu: <b>{finish.name}</b>
                  </legend>
                  <div className="rm-swatches">
                    {FINISHES.map((item) => (
                      <label key={item.id} style={{ '--sw': item.color } as CSSProperties}>
                        <input type="radio" name="finish" value={item.id} checked={finish.id === item.id} onChange={() => setFinish(item)} />
                        <span className="rm-sr">{item.name}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>

                <label className="rm-field">
                  Khắc tên lên thân loa (miễn phí)
                  <input
                    value={engraving}
                    onChange={(event) => setEngraving(event.target.value.slice(0, ENGRAVE_MAX))}
                    maxLength={ENGRAVE_MAX}
                    placeholder="Ví dụ: NHÀ MÌNH"
                    autoComplete="off"
                  />
                  <small>
                    Tối đa {ENGRAVE_MAX} ký tự. Xem thử ngay trên hình bên cạnh.
                  </small>
                </label>

                <div className="rm-qty">
                  <span id="rm-qty-label">Số lượng</span>
                  <div role="group" aria-labelledby="rm-qty-label">
                    <button type="button" onClick={() => setQty((value) => Math.max(1, value - 1))} disabled={qty === 1} aria-label="Bớt một chiếc">
                      −
                    </button>
                    <output aria-live="polite">{qty}</output>
                    <button type="button" onClick={() => setQty((value) => Math.min(MAX_QTY, value + 1))} disabled={qty === MAX_QTY} aria-label="Thêm một chiếc">
                      +
                    </button>
                  </div>
                </div>

                <p className="rm-buy__total">
                  Tạm tính <strong>{formatVnd(PRICE * qty)}</strong>
                </p>
                <button className="rm-btn rm-btn--wide" type="submit">
                  Đặt trước {qty} chiếc màu {finish.name}
                </button>
                <p className="rm-buy__note">Giao từ tháng 12. Chưa thu tiền khi đặt trước.</p>
              </form>
            </div>
          </section>

          <section className="rm-notify">
            <div className="rm-wrap">
              <h2>Chưa muốn đặt ngay?</h2>
              <p>Để lại email, chúng tôi báo bạn một lần duy nhất vào ngày mở bán.</p>
              <form onSubmit={subscribe}>
                <label className="rm-sr" htmlFor="rm-email">
                  Email của bạn
                </label>
                <input id="rm-email" type="email" required placeholder="ban@email.com" autoComplete="email" />
                <button className="rm-btn" type="submit">
                  Báo cho tôi
                </button>
              </form>
            </div>
          </section>
        </main>

        <footer className="rm-foot">
          <div className="rm-wrap">
            <p>Vọng là thương hiệu hư cấu dùng cho bản mẫu. Sản phẩm, giá và thông số đều là minh họa.</p>
          </div>
        </footer>
        {notice}
      </div>
    </TemplateShell>
  );
}
