import { useRef, useState } from 'react';
import { ArrowUpRight, CalendarCheck, ClipboardList, Megaphone, ShoppingBag, Store } from 'lucide-react';
import { hero, solutions, samples, process, pricing, finale } from '../../content/site';
import type { PageProps } from '../../core/types';
import { Link } from '../../core/router';
import { FinaleText } from '../../core/content-kit';
import { useDemoPreview } from '../../core/DemoPreview';
import { useMotion, singularityBloom, kineticText, cascade, immersiveZoom, maskReveal, magnetic, finaleReveal, gsap, ScrollTrigger } from '../../motion';
import { Header, Footer } from './Chrome';
import { Pill } from './Pill';

const SOL_ICONS = [ShoppingBag, CalendarCheck, Store, Megaphone, ClipboardList];
const pad = (n: number) => String(n).padStart(2, '0');

/** Hình bốn tầng thu nhỏ cạnh mỗi nút lớp: tầng đang nói tới được tô. */
function StrataGlyph({ layer }: { layer: number }) {
  return (
    <span className="mn-glyph" aria-hidden="true">
      {[3, 2, 1, 0].map((l) => (
        <i key={l} data-on={l === layer || undefined} />
      ))}
    </span>
  );
}

function Hero({ links }: { links: PageProps['links'] }) {
  const [hover, setHover] = useState<number | null>(null);
  const [pinned, setPinned] = useState<number | null>(null);
  const active = hover ?? pinned;
  return (
    <section className="mn-hero" aria-labelledby="mn-hero-title">
      <div className="mn-hero-grid" aria-hidden="true" />
      <div className="mn-wrap mn-hero-in">
        <h1 id="mn-hero-title" className="mn-h1">
          {hero.title.lead} <span>{hero.title.accent}</span>
        </h1>
        <div className="mn-hero-band">
          <p className="mn-hero-lead">{hero.lead}</p>
          <div className="mn-hero-stage">
            <Pill href={links.order()} label={hero.primary.label} explode={active} className="is-hero" />
          </div>
          <div className="mn-hero-acts">
            <a className="mn-btn is-line" href={`#${hero.secondary.hash}`}>
              {hero.secondary.label}
            </a>
            <a className="mn-family" href={hero.family.href}>
              {hero.family.label}
              <ArrowUpRight size={16} strokeWidth={1.5} aria-hidden="true" />
            </a>
          </div>
          <div className="mn-hero-layers">
            <ul className="mn-layers" onMouseLeave={() => setHover(null)}>
              {hero.layers.map((l) => (
                <li key={l.layer}>
                  <button
                    type="button"
                    aria-pressed={pinned === l.layer}
                    data-on={active === l.layer || undefined}
                    onMouseEnter={() => setHover(l.layer)}
                    onFocus={() => setHover(l.layer)}
                    onBlur={() => setHover(null)}
                    onClick={() => setPinned((p) => (p === l.layer ? null : l.layer))}
                  >
                    <StrataGlyph layer={l.layer} />
                    <span className="mn-layer-txt">
                      <b>{l.title}</b>
                      <span>{l.text}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <p className="mn-caption">{hero.caption}</p>
          </div>
        </div>
      </div>
      <div className="mn-bridge" aria-hidden="true" />
    </section>
  );
}

function Solutions({ links }: { links: PageProps['links'] }) {
  const openDemo = useDemoPreview();
  return (
    <section id={solutions.id} className="mn-sec mn-sol" aria-labelledby="mn-sol-title">
      <div className="mn-wrap">
        <div className="mn-sec-head">
          <h2 id="mn-sol-title" className="mn-sec-title">
            {solutions.title}
          </h2>
          <p className="mn-sec-sub">{solutions.sub}</p>
        </div>
        <ul className="mn-board">
          {solutions.items.map((item, i) => {
            const Icon = SOL_ICONS[i];
            const face = (
              <div className="mn-kc-face">
                <Icon className="mn-kc-icon" size={20} strokeWidth={1.5} aria-hidden="true" />
                <div className="mn-kc-body">
                  <h3>{item.title}</h3>
                  <span className="mn-kc-text">{item.text}</span>
                </div>
                <span className="mn-kc-link">{item.link}</span>
              </div>
            );
            return (
              <li key={item.title} className={item.demo ? 'mn-kc-li' : 'mn-kc-li is-mod'}>
                {item.demo ? (
                  <a className="mn-kc" href={item.href} onClick={openDemo(item.demo.route, item.demo.title)} aria-haspopup="dialog">
                    {face}
                  </a>
                ) : (
                  <Link className="mn-kc is-mod" href={links.order(item.orderQuery)}>
                    {face}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

function Samples() {
  const openDemo = useDemoPreview();
  return (
    <section id={samples.id} className="mn-sec mn-samples" aria-labelledby="mn-sam-title">
      <div className="mn-wrap">
        <div className="mn-sec-head">
          <h2 id="mn-sam-title" className="mn-sec-title">
            {samples.title}
          </h2>
          <p className="mn-sec-sub">{samples.sub}</p>
        </div>
        {samples.tiers.map((tier) => {
          const items = tier.slugs.map((slug) => samples.items.find((s) => s.slug === slug)).filter((s) => s !== undefined);
          const plus = tier.id === 'digital-plus';
          return (
            <section key={tier.id} className={plus ? 'mn-tier mn-tier--plus' : 'mn-tier'} aria-labelledby={`mn-tier-${tier.id}`}>
              <div className="mn-tier-head">
                <h3 id={`mn-tier-${tier.id}`} className="mn-tier-name">
                  {tier.name}
                </h3>
                <p className="mn-tier-desc">{tier.desc}</p>
                <span className="mn-tier-count">{items.length} bản mẫu</span>
              </div>
              <ul className="mn-deck" data-count={items.length}>
                {items.map((s) => (
                  <li key={s.slug} className="mn-card-li">
                    <a className="mn-card" href={s.route} onClick={openDemo(s.route, s.dialogTitle)} aria-haspopup="dialog">
                      <div className="mn-card-in">
                        <div className="mn-card-shot">
                          <img
                            src={samples.imageSrc(s.image)}
                            srcSet={samples.imageSrcSet(s.image)}
                            sizes={plus ? '(max-width: 699px) 82vw, 600px' : '(max-width: 699px) 82vw, (max-width: 1023px) 46vw, 400px'}
                            width={960}
                            height={540}
                            alt=""
                            loading="lazy"
                            decoding="async"
                          />
                        </div>
                        <div className="mn-card-meta">
                          <div className="mn-card-top">
                            <h4>{s.name}</h4>
                            <span className="mn-badge">{samples.badge}</span>
                          </div>
                          <p className="mn-card-desc">{s.desc}</p>
                          <span className="mn-card-open">{samples.open}</span>
                        </div>
                      </div>
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </section>
  );
}

function Process() {
  return (
    <section id={process.id} className="mn-sec mn-process" aria-labelledby="mn-pro-title">
      <div className="mn-wrap">
        <div className="mn-sec-head">
          <h2 id="mn-pro-title" className="mn-sec-title">
            {process.title}
          </h2>
        </div>
        <div className="mn-plate-zoom">
          <ol className="mn-plate">
            {process.steps.map((s, i) => (
              <li key={s.title} className="mn-step">
                <div className="mn-step-key">
                  <div className="mn-step-face">
                    <span className="mn-step-no" aria-hidden="true">
                      {pad(i + 1)}
                    </span>
                    <h3>{s.title}</h3>
                  </div>
                </div>
                <p className="mn-step-txt">{s.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

function Pricing({ links }: { links: PageProps['links'] }) {
  return (
    <section id={pricing.id} className="mn-sec mn-pricing" aria-labelledby="mn-pri-title">
      <div className="mn-wrap">
        <div className="mn-sec-head">
          <h2 id="mn-pri-title" className="mn-sec-title">
            {pricing.title}
          </h2>
          <p className="mn-sec-sub">{pricing.sub}</p>
        </div>
        <ul className="mn-factors">
          {pricing.factors.map((f) => (
            <li key={f.title} className="mn-factor-wrap">
              <div className="mn-factor">
                <div className="mn-factor-face">
                  <h3>{f.title}</h3>
                  <p>{f.text}</p>
                </div>
              </div>
            </li>
          ))}
        </ul>
        <div className="mn-price-foot">
          <p>{pricing.note}</p>
          <Link className="mn-btn mn-price-cta" href={links.order()}>
            {pricing.cta}
          </Link>
        </div>
      </div>
    </section>
  );
}

function Finale({ links }: { links: PageProps['links'] }) {
  return (
    <section id={finale.id} className="mn-finale" aria-labelledby="mn-fin-title">
      <div className="mn-finale-bg" aria-hidden="true" />
      <div className="mn-wrap mn-finale-in">
        <h2 id="mn-fin-title" className="mn-finale-title">
          {finale.title}
        </h2>
        <p className="mn-finale-text">
          <FinaleText />
        </p>
        <ol className="mn-finale-steps">
          {finale.steps.map((s, i) => (
            <li key={s}>
              <span className="mn-mini-key" aria-hidden="true">
                {i + 1}
              </span>
              <span>{s}</span>
            </li>
          ))}
        </ol>
        <div className="mn-finale-stage">
          <Pill href={links.order()} label={finale.cta} className="is-finale" />
        </div>
      </div>
    </section>
  );
}

export function Home({ links, theme, toggleTheme }: PageProps) {
  const scope = useRef<HTMLDivElement>(null);

  useMotion(scope, (c, root) => {
    const small = c.mobile || c.tablet;
    const cleanups: (() => void)[] = [];

    // Singularity Bloom: chiếc nút lắp lại từ bốn tầng hội tụ về một điểm; cuộn thì camera chui vào nắp kính.
    const pinned = c.desktop;
    if (pinned) root.setAttribute('data-pin', '');
    cleanups.push(() => root.removeAttribute('data-pin'));
    const extras = ['.mn-hero-lead', '.mn-hero-acts', '.mn-layers li', '.mn-caption'];
    const { intro, scroll } = singularityBloom({
      stage: '.mn-hero',
      object: '.mn-hero .mn-pill',
      layers: '.mn-hero-grid',
      title: '.mn-h1',
      extras,
      bridge: '.mn-bridge',
      zoomTo: 5,
      pinLength: 70,
      mobile: small,
      delay: 0.1,
    });
    if (intro) {
      intro.from(
        '.mn-hero .mn-stratum-in',
        { z: (i: number) => 60 + i * 70, rotateZ: (i: number) => (i - 1.5) * 9, duration: 1.7, ease: 'afx.cinema', stagger: 0.07 },
        0.2,
      );
    }
    if (scroll && pinned) {
      // Nhịp lại dòng thời gian cuộn (tổng = 1): chữ và các phần phụ tắt hẳn trước khi nút lớn lên đè lên chúng,
      // nhãn trên nắp kính tắt trước khi bị phóng to thành ảnh nhòe, nền xanh phủ kín trước khi #giai-phap trồi lên.
      const pill = root.querySelector('.mn-hero .mn-pill');
      const h1 = root.querySelector('.mn-h1');
      const bridge = root.querySelector('.mn-bridge');
      const grid = root.querySelector('.mn-hero-grid');
      const extraEls = new Set(gsap.utils.toArray<Element>(extras.join(','), root));
      const timing = (t: Element) =>
        t === pill ? [0, 0.8] : t === h1 ? [0, 0.28] : t === bridge ? [0.42, 0.2] : t === grid ? [0, 0.5] : extraEls.has(t) ? [0, 0.24] : null;
      scroll.getChildren(false, true, false).forEach((tw) => {
        const at = timing((tw as gsap.core.Tween).targets()[0] as Element);
        if (at) tw.startTime(at[0]).duration(at[1]);
      });
      scroll.fromTo(
        ['.mn-hero .mn-cap-label', '.mn-hero .mn-cap-sheen'],
        { autoAlpha: 1 },
        { autoAlpha: 0, duration: 0.16, ease: 'none', immediateRender: false },
        0,
      );
      // Giữ tổng = 1 để nền xanh kín ở ~62% đoạn ghim, đúng lúc #giai-phap (kéo lên bằng margin âm) bắt đầu trồi vào khung.
      scroll.to({}, { duration: 0.01 }, 0.99);
    }
    // Nút được hút theo con trỏ (mạnh), cảnh bên trong lệch nhẹ hơn.
    cleanups.push(magnetic('.mn-hero .mn-pill', { strength: 0.32, inner: '.mn-scene', innerStrength: 0.08 }));
    cleanups.push(magnetic('.mn-finale .mn-pill', { strength: 0.28, inner: '.mn-scene', innerStrength: 0.08 }));
    cleanups.push(magnetic(['.mn-price-cta', '.mn-head-cta'], { strength: 0.18 }));

    kineticText('.mn-sec-title', { by: 'lines' });

    // Giải pháp: các phím rơi vào hàng (chỉ opacity/vị trí, không visibility, để Tab vẫn tới được trước khi cuộn tới).
    if (!c.reduced) {
      gsap.from('.mn-kc-li', {
        opacity: 0,
        y: 40,
        duration: 0.8,
        ease: 'afx.out',
        stagger: 0.07,
        scrollTrigger: { trigger: '.mn-board', start: 'top 85%', once: true },
      });
    }

    // Bản mẫu: một xấp thẻ chồng lên nhau ở giữa, cuộn tới đâu xòe ra tới đó.
    if (!c.reduced && !c.mobile) {
      const deck = root.querySelector<HTMLElement>('.mn-deck');
      const cards = gsap.utils.toArray<HTMLElement>('.mn-card-li', root);
      if (deck && cards.length) {
        const centre = (el: HTMLElement) => ({ x: el.offsetLeft + el.offsetWidth / 2, y: el.offsetTop + el.offsetHeight / 2 });
        const mid = () => ({ x: deck.clientWidth / 2, y: deck.clientHeight / 2 });
        gsap.from(cards, {
          x: (i: number) => mid().x - centre(cards[i]).x + (i - 2.5) * 6,
          y: (i: number) => mid().y - centre(cards[i]).y - i * 4,
          rotate: (i: number) => (i - 2.5) * 3.5,
          ease: 'none',
          scrollTrigger: { trigger: deck, start: 'top 92%', end: 'top 40%', scrub: 0.8, invalidateOnRefresh: true },
        });
      }
    } else {
      cascade('.mn-card-li', { trigger: '.mn-deck', x: 24, y: 0 });
    }

    // Quy trình: tấm phím phóng ra, rồi từng phím được nhấn theo nhịp cuộn.
    immersiveZoom('.mn-plate-zoom', { from: 0.88, radius: 0 });
    if (!c.reduced) {
      const steps = gsap.utils.toArray<HTMLElement>('.mn-step', root);
      ScrollTrigger.create({
        trigger: '.mn-plate',
        start: 'top 70%',
        end: 'bottom 35%',
        onUpdate: (self) => {
          const idx = Math.min(steps.length - 1, Math.floor(self.progress * steps.length));
          steps.forEach((el, i) => el.classList.toggle('is-down', i === idx && self.isActive));
        },
        onLeave: () => steps.forEach((el) => el.classList.remove('is-down')),
        onLeaveBack: () => steps.forEach((el) => el.classList.remove('is-down')),
      });
    }

    // Bảng giá: ba phím mở bằng mặt nạ.
    maskReveal('.mn-factor-wrap', { shape: 'up', trigger: '.mn-factors' });

    // Cảnh kết: nền mở từ chỗ chiếc nút quay lại.
    finaleReveal('.mn-finale', {
      backdrop: '.mn-finale-bg',
      title: '.mn-finale-title',
      items: ['.mn-finale-text', '.mn-finale-steps li', '.mn-finale-stage'],
      shape: 'inset',
    });

    return cleanups;
  });

  return (
    <div className="mn-page" ref={scope}>
      <Header links={links} theme={theme} toggleTheme={toggleTheme} />
      <main id="noi-dung" tabIndex={-1} className="mn-main">
        <Hero links={links} />
        <Solutions links={links} />
        <Samples />
        <Process />
        <Pricing links={links} />
        <Finale links={links} />
      </main>
      <Footer links={links} page="home" />
    </div>
  );
}
