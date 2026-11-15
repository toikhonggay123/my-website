import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import '@fontsource-variable/lora/wght.css';
import '@fontsource-variable/lora/wght-italic.css';
import './styles.css';
import { TemplateShell, useDemoNotice } from '../shared/TemplateShell';
import { HeroArt, ProductArt, StepArt } from './art';
import { CartDrawer } from './CartDrawer';
import { MAX_QTY, categories, categoryLabel, formatVnd, glazes, productById, products, type CartLine, type CategoryId, type Product } from './data';
import { ArrowIcon, BagIcon, CheckIcon, CloseIcon, MenuIcon } from './icons';
import { QuickView } from './QuickView';

const STORAGE_KEY = 'tpl-cua-hang-cart';

type Overlay = { kind: 'cart' } | { kind: 'quick'; id: string } | null;
type Filter = CategoryId | 'all';

const navLinks = [
  { id: 'san-pham', label: 'Sản phẩm' },
  { id: 'cach-lam', label: 'Cách làm gốm' },
  { id: 'cham-soc', label: 'Chăm sóc & giao hàng' },
  { id: 'lien-he', label: 'Liên hệ' },
];

const steps: Array<{ step: 1 | 2 | 3; title: string; text: string; tile: string }> = [
  {
    step: 1,
    title: 'Chuốt trên bàn xoay',
    text: 'Đất được nhào kỹ rồi chuốt từng chiếc bằng tay. Không dùng khuôn, nên không có hai chiếc giống hệt nhau.',
    tile: '#eadfcd',
  },
  {
    step: 2,
    title: 'Tráng men tro',
    text: 'Men pha từ tro rơm, tro củi và đá vôi. Món gốm được nhúng tay, để lộ phần chân mộc.',
    tile: '#dfe6da',
  },
  {
    step: 3,
    title: 'Nung 1.250°C',
    text: 'Lò nung hai ngày, nguội thêm một ngày. Lửa cao làm xương gốm chắc, men bám chặt và dùng được lâu.',
    tile: '#ecd9c6',
  },
];

const careItems: Array<{ title: string; text: string }> = [
  {
    title: 'Rửa và dùng hằng ngày',
    text: 'Rửa bằng nước rửa chén thông thường và miếng xốp mềm. Dùng được trong lò vi sóng và máy rửa chén. Tránh đổi nhiệt đột ngột, ví dụ lấy từ tủ lạnh ra rồi rót nước sôi.',
  },
  {
    title: 'Phần chân mộc',
    text: 'Chân không tráng men có thể sậm màu theo thời gian. Đó là điều bình thường của gốm mộc. Lau khô trước khi cất để chân không ám mùi.',
  },
  {
    title: 'Đóng gói và giao hàng',
    text: 'Mỗi món được bọc giấy tổ ong và chèn trong hộp các-tông hai lớp. Xưởng gói hàng trong 1–2 ngày làm việc, thời gian giao tùy nơi nhận.',
  },
  {
    title: 'Nếu hàng vỡ khi nhận',
    text: 'Chụp ảnh món bị vỡ cùng hộp hàng và gửi cho xưởng trong 3 ngày. Chúng tôi gửi lại món mới, bạn không cần trả lại mảnh vỡ.',
  },
];

function isCartLine(value: unknown): value is CartLine {
  if (typeof value !== 'object' || value === null) return false;
  const line = value as Record<string, unknown>;
  return typeof line.id === 'string' && typeof line.qty === 'number' && Number.isInteger(line.qty) && line.qty >= 1 && line.qty <= MAX_QTY && productById(line.id) !== undefined;
}

function loadCart(): CartLine[] {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isCartLine) : [];
  } catch {
    return [];
  }
}

const prefersReducedMotion = (): boolean => {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
};

export default function CuaHang() {
  const { notify, notice } = useDemoNotice();
  const [cart, setCart] = useState<CartLine[]>(loadCart);
  const [filter, setFilter] = useState<Filter>('all');
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [justAdded, setJustAdded] = useState<string | null>(null);
  const [announce, setAnnounce] = useState('');
  const cartButton = useRef<HTMLButtonElement>(null);
  const addedTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    try {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
    } catch {
      /* Không lưu được thì giỏ chỉ sống trong phiên hiện tại. */
    }
  }, [cart]);

  useEffect(() => () => window.clearTimeout(addedTimer.current), []);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  const count = cart.reduce((sum, line) => sum + line.qty, 0);
  const qtyOf = (id: string) => cart.find((line) => line.id === id)?.qty ?? 0;

  const visible = useMemo(() => (filter === 'all' ? products : products.filter((p) => p.category === filter)), [filter]);

  const addToCart = useCallback((id: string, qty: number) => {
    const product = productById(id);
    if (!product) return;
    setCart((prev) => {
      const existing = prev.find((line) => line.id === id);
      if (existing) return prev.map((line) => (line.id === id ? { ...line, qty: Math.min(MAX_QTY, line.qty + qty) } : line));
      return [...prev, { id, qty: Math.min(MAX_QTY, qty) }];
    });
    setJustAdded(id);
    setAnnounce(`Đã thêm ${qty} ${product.name} vào giỏ.`);
    window.clearTimeout(addedTimer.current);
    addedTimer.current = window.setTimeout(() => setJustAdded(null), 1600);
  }, []);

  const setQty = useCallback((id: string, qty: number) => {
    const next = Math.max(1, Math.min(MAX_QTY, qty));
    setCart((prev) => prev.map((line) => (line.id === id ? { ...line, qty: next } : line)));
  }, []);

  const removeLine = useCallback((id: string) => {
    const product = productById(id);
    setCart((prev) => prev.filter((line) => line.id !== id));
    if (product) setAnnounce(`Đã bỏ ${product.name} khỏi giỏ.`);
  }, []);

  const closeOverlay = useCallback(() => setOverlay(null), []);

  const placeOrder = () => {
    // Bản mẫu: không gửi dữ liệu đi đâu. Chỉ hiện thông báo rồi dọn giỏ.
    cartButton.current?.focus();
    notify();
    setCart([]);
    setOverlay(null);
  };

  const scrollTo = (event: MouseEvent<HTMLAnchorElement>, id: string) => {
    const target = document.getElementById(id);
    if (!target) return;
    event.preventDefault();
    setMenuOpen(false);
    target.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
    target.focus({ preventScroll: true });
  };

  const quickProduct = overlay?.kind === 'quick' ? productById(overlay.id) : undefined;

  const renderCard = (product: Product, index: number) => {
    const glaze = glazes[product.glaze];
    const added = justAdded === product.id;
    const inCart = qtyOf(product.id);
    const classes = ['ml-card'];
    if (product.featured) classes.push('ml-card--featured');
    if (product.featured && filter === 'all' && index > 0) classes.push('ml-card--right');
    return (
      <li key={product.id} className={classes.join(' ')}>
        <article className="ml-card__inner">
          <button type="button" className="ml-card__media" style={{ background: glaze.tile }} onClick={() => setOverlay({ kind: 'quick', id: product.id })} aria-label={`Xem nhanh ${product.name}`}>
            <ProductArt shape={product.shape} glaze={product.glaze} dip={product.dip} seed={product.seed} />
            {product.tag ? <span className="ml-card__tag">{product.tag}</span> : null}
            <span className="ml-card__peek" aria-hidden="true">
              Xem nhanh
            </span>
          </button>
          <div className="ml-card__body">
            <div className="ml-card__text">
              <p className="ml-card__meta">
                {categoryLabel(product.category)} · {glaze.label}
              </p>
              <h3 className="ml-card__name">{product.name}</h3>
              <p className="ml-card__desc">{product.short}</p>
            </div>
            <div className="ml-card__buy">
              <p className="ml-card__price">{formatVnd(product.price)}</p>
              <button type="button" className={`ml-btn ml-btn--secondary ml-card__add${added ? ' is-added' : ''}`} onClick={() => addToCart(product.id, 1)} aria-label={`Thêm ${product.name} vào giỏ${inCart > 0 ? `, đang có ${inCart}` : ''}`}>
                {added ? (
                  <>
                    <CheckIcon size={16} /> Đã thêm
                  </>
                ) : (
                  'Thêm vào giỏ'
                )}
              </button>
            </div>
          </div>
        </article>
      </li>
    );
  };

  return (
    <TemplateShell slug="cua-hang" title="Gốm Mộc Lam">
      <div className="tpl-cua-hang">
        <a className="ml-skip" href="#noi-dung" onClick={(e) => scrollTo(e, 'noi-dung')}>
          Bỏ qua, tới nội dung
        </a>

        <header className="ml-header">
          <div className="ml-wrap ml-header__bar">
            <a className="ml-logo" href="#dau-trang" onClick={(e) => scrollTo(e, 'dau-trang')} aria-label="Gốm Mộc Lam, về đầu trang">
              <svg className="ml-logo__mark" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
                <path d="M4 12c0 9 5 15 12 15s12-6 12-15Z" fill="currentColor" />
                <ellipse cx="16" cy="12" rx="12" ry="3.4" fill="#9fbfae" stroke="currentColor" strokeWidth="1.6" />
              </svg>
              <span className="ml-logo__word">
                Gốm <em>Mộc Lam</em>
              </span>
            </a>

            <nav className={`ml-nav${menuOpen ? ' is-open' : ''}`} id="ml-nav" aria-label="Điều hướng chính">
              <ul>
                {navLinks.map((link) => (
                  <li key={link.id}>
                    <a href={`#${link.id}`} onClick={(e) => scrollTo(e, link.id)}>
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>

            <div className="ml-header__actions">
              <button type="button" className="ml-iconbtn ml-menu-btn" aria-expanded={menuOpen} aria-controls="ml-nav" aria-label={menuOpen ? 'Đóng danh mục' : 'Mở danh mục'} onClick={() => setMenuOpen((open) => !open)}>
                {menuOpen ? <CloseIcon size={22} /> : <MenuIcon />}
              </button>
              <button
                type="button"
                className="ml-cart-btn"
                ref={cartButton}
                onClick={() => {
                  setMenuOpen(false);
                  setOverlay({ kind: 'cart' });
                }}
                aria-label={`Giỏ hàng, ${count} sản phẩm`}
              >
                <BagIcon />
                <span className="ml-cart-btn__label">Giỏ hàng</span>
                <span key={count} className={`ml-cart-btn__count${count > 0 ? ' has-items' : ''}`} aria-hidden="true">
                  {count}
                </span>
              </button>
            </div>
          </div>
        </header>

        <main id="noi-dung" tabIndex={-1}>
          <section className="ml-hero" id="dau-trang" tabIndex={-1} aria-labelledby="ml-hero-title">
            <div className="ml-wrap ml-grid ml-hero__grid">
              <div className="ml-hero__head">
                <p className="ml-eyebrow">Xưởng gốm làm tay · nung theo mẻ nhỏ</p>
                <h1 id="ml-hero-title" className="ml-hero__title">
                  Gốm <em>làm tay</em> cho bữa cơm thường ngày
                </h1>
              </div>
              <div className="ml-hero__lede">
                <p>Bát, tách, đĩa và bình hoa được chuốt trên bàn xoay, tráng men tro, nung ở 1.250°C. Đủ bền để dùng mỗi ngày, đủ đẹp để bày lên kệ.</p>
                <div className="ml-hero__cta">
                  <a className="ml-btn ml-btn--primary" href="#san-pham" onClick={(e) => scrollTo(e, 'san-pham')}>
                    Xem sản phẩm <ArrowIcon />
                  </a>
                  <a className="ml-link" href="#cach-lam" onClick={(e) => scrollTo(e, 'cach-lam')}>
                    Cách chúng tôi làm gốm
                  </a>
                </div>
              </div>
              <figure className="ml-hero__art">
                <HeroArt />
                <figcaption>Bình cổ hẹp men lam, bát trắng ngà, tách đất nung.</figcaption>
              </figure>
            </div>
          </section>

          <section className="ml-section ml-shop" id="san-pham" tabIndex={-1} aria-labelledby="ml-shop-title">
            <div className="ml-wrap">
              <div className="ml-grid ml-section__head">
                <div className="ml-section__title">
                  <p className="ml-eyebrow">Sản phẩm</p>
                  <h2 id="ml-shop-title">Mẻ gốm đang có</h2>
                </div>
                <p className="ml-section__intro">Mười món cho bàn ăn và góc nhà. Bấm vào ảnh để xem kích thước và loại men.</p>
              </div>

              <div className="ml-chips" role="group" aria-label="Lọc theo loại sản phẩm">
                <button type="button" className="ml-chip" aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>
                  Tất cả <span className="ml-chip__n">{products.length}</span>
                </button>
                {categories.map((category) => (
                  <button key={category.id} type="button" className="ml-chip" aria-pressed={filter === category.id} onClick={() => setFilter(category.id)}>
                    {category.label} <span className="ml-chip__n">{products.filter((p) => p.category === category.id).length}</span>
                  </button>
                ))}
              </div>
              <p className="ml-sr" aria-live="polite">
                Đang hiện {visible.length} sản phẩm{filter === 'all' ? '' : ` thuộc nhóm ${categoryLabel(filter)}`}.
              </p>

              <ul className="ml-grid ml-products" key={filter}>
                {visible.map(renderCard)}
              </ul>
            </div>
          </section>

          <section className="ml-section ml-story" id="cach-lam" tabIndex={-1} aria-labelledby="ml-story-title">
            <div className="ml-wrap">
              <div className="ml-grid ml-story__head">
                <div className="ml-section__title">
                  <p className="ml-eyebrow">Từ đất đến bàn ăn</p>
                  <h2 id="ml-story-title">Cách chúng tôi làm gốm</h2>
                </div>
                <p className="ml-story__quote">Một chiếc bát đi qua tay người thợ chừng hai mươi lần trước khi đến tay bạn.</p>
              </div>
              <ol className="ml-grid ml-steps">
                {steps.map((item) => (
                  <li key={item.step} className={`ml-step ml-step--${item.step}`}>
                    <div className="ml-step__art" style={{ background: item.tile }}>
                      <StepArt step={item.step} />
                    </div>
                    <p className="ml-step__no" aria-hidden="true">
                      0{item.step}
                    </p>
                    <h3 className="ml-step__title">{item.title}</h3>
                    <p className="ml-step__text">{item.text}</p>
                  </li>
                ))}
              </ol>
            </div>
          </section>

          <section className="ml-section ml-care" id="cham-soc" tabIndex={-1} aria-labelledby="ml-care-title">
            <div className="ml-wrap ml-grid">
              <div className="ml-care__head">
                <p className="ml-eyebrow">Dùng lâu, giữ bền</p>
                <h2 id="ml-care-title">Chăm sóc và giao hàng</h2>
                <p className="ml-care__lede">Gốm nung lửa cao không cần nâng niu quá mức. Vài lưu ý nhỏ dưới đây là đủ.</p>
              </div>
              <dl className="ml-care__list">
                {careItems.map((item) => (
                  <div key={item.title} className="ml-care__row">
                    <dt>{item.title}</dt>
                    <dd>{item.text}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </section>
        </main>

        <footer className="ml-footer" id="lien-he" tabIndex={-1}>
          <div className="ml-wrap ml-grid">
            <div className="ml-footer__brand">
              <p className="ml-footer__word">
                Gốm <em>Mộc Lam</em>
              </p>
              <p>Xưởng gốm Mộc Lam (doanh nghiệp minh họa). Mọi sản phẩm, giá và thông tin trên trang này là dữ liệu mẫu.</p>
            </div>
            <div className="ml-footer__col">
              <h2 className="ml-footer__title">Liên hệ</h2>
              <ul>
                <li>Địa chỉ: (địa chỉ xưởng minh họa)</li>
                <li>Điện thoại: (số điện thoại minh họa)</li>
                <li>Email: (email minh họa)</li>
              </ul>
            </div>
            <div className="ml-footer__col">
              <h2 className="ml-footer__title">Giờ mở xưởng</h2>
              <ul>
                <li>Thứ Ba – Chủ nhật: 9:00 – 17:30</li>
                <li>Thứ Hai: xưởng nghỉ, lò nguội</li>
              </ul>
            </div>
            <p className="ml-footer__fine">Bản mẫu giao diện của AFYLLX Digital. Không có đơn hàng thật nào được ghi nhận.</p>
          </div>
        </footer>

        <p className="ml-sr" role="status" aria-live="polite">
          {announce}
        </p>

        {overlay?.kind === 'cart' ? <CartDrawer lines={cart} onQty={setQty} onRemove={removeLine} onClose={closeOverlay} onOrder={placeOrder} /> : null}
        {quickProduct ? (
          <QuickView key={quickProduct.id} product={quickProduct} inCart={qtyOf(quickProduct.id)} onAdd={addToCart} onOpenCart={() => setOverlay({ kind: 'cart' })} onClose={closeOverlay} />
        ) : null}
      </div>
      {notice}
    </TemplateShell>
  );
}
