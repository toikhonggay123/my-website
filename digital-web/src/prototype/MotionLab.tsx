import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import '@fontsource/be-vietnam-pro/vietnamese-600.css';
import '@fontsource/be-vietnam-pro/vietnamese-800.css';
import '@fontsource/be-vietnam-pro/latin-600.css';
import '@fontsource/be-vietnam-pro/latin-800.css';
import { BRAND, DEMOS, HERO_MODES, PROCESS_STEPS, SOLUTIONS, type DemoItem } from './digitalData';
import { createBlockStage, type BlockStageController, type StageMetrics } from './webglBlocks';
import {
  createAssemblyChoreography,
  createGlassMonolithChoreography,
  createVoxelPhysicsChoreography,
} from './scenes';
import './motionLab.css';

export type VariantKey = 'A' | 'B' | 'C' | 'D';

interface VariantMeta {
  key: VariantKey;
  shortName: string;
  description: string;
  engineLabel: string;
}

const VARIANTS: VariantMeta[] = [
  {
    key: 'A',
    shortName: 'Khối UI CSS-3D',
    description: 'Khối giao diện 3D có độ dày thật, tách lớp Z và nghiêng theo con trỏ',
    engineLabel: 'CSS preserve-3d + Spring Lerp',
  },
  {
    key: 'B',
    shortName: 'Khối 3D Lắp Ghép',
    description: '14 khối kiến trúc website WebGL2 tách lớp & xếp tháp theo nhịp cuộn',
    engineLabel: 'WebGL2 + Scroll Choreography',
  },
  {
    key: 'C',
    shortName: 'Ma Trận Khối Đàn Hồi',
    description: '50 khối lập phương vật lý lò xo đẩy theo chuột, tạo sóng & biến hình',
    engineLabel: 'WebGL2 + Spring Physics + Kinetic Type',
  },
  {
    key: 'D',
    shortName: 'Monolith Kính Chiều Sâu',
    description: 'Khối kính bán trong suốt đa tầng, parallax tốc độ khác nhau & màn che clip-path',
    engineLabel: 'WebGL2 Translucent + Depth Parallax',
  },
];

const ASSEMBLY_STAGES = ['Tổng thể', 'Tách lớp', 'Khối mẫu', 'Xếp tháp'];

function readInitialVariant(): VariantKey {
  const param = new URLSearchParams(window.location.search).get('variant')?.toUpperCase();
  if (param === 'A' || param === 'B' || param === 'C' || param === 'D') return param;
  return 'B';
}

function Css3dStage({
  modeIndex,
  exploded,
  onToggleExplode,
  reducedMotion,
}: {
  modeIndex: number;
  exploded: boolean;
  onToggleExplode: () => void;
  reducedMotion: boolean;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const mode = HERO_MODES[modeIndex];

  useEffect(() => {
    const el = stageRef.current;
    if (!el || reducedMotion) {
      if (el) {
        el.style.setProperty('--ry', '-15deg');
        el.style.setProperty('--rx', '7deg');
      }
      return;
    }

    let targetRx = 8;
    let targetRy = -17;
    let curRx = 8;
    let curRy = -17;
    let raf = 0;

    const onMove = (e: PointerEvent) => {
      const parent = el.parentElement;
      if (!parent) return;
      const r = parent.getBoundingClientRect();
      const nx = (e.clientX - r.left) / r.width - 0.5;
      const ny = (e.clientY - r.top) / r.height - 0.5;
      targetRy = -17 + nx * 24;
      targetRx = 8 - ny * 18;
    };

    const onLeave = () => {
      targetRy = -17;
      targetRx = 8;
    };

    const loop = () => {
      curRx += (targetRx - curRx) * 0.09;
      curRy += (targetRy - curRy) * 0.09;
      el.style.setProperty('--ry', `${curRy.toFixed(2)}deg`);
      el.style.setProperty('--rx', `${curRx.toFixed(2)}deg`);
      raf = requestAnimationFrame(loop);
    };

    const parent = el.parentElement;
    parent?.addEventListener('pointermove', onMove);
    parent?.addEventListener('pointerleave', onLeave);
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      parent?.removeEventListener('pointermove', onMove);
      parent?.removeEventListener('pointerleave', onLeave);
    };
  }, [reducedMotion]);

  return (
    <div
      className="mlab-css3d-scene"
      style={{ '--explode': exploded ? '1' : '0' } as React.CSSProperties}
    >
      <div className="mlab-stage-hud">
        <span className="mlab-hud-tag">CSS 3D Prism</span>
        <div className="mlab-stage-pills">
          <button type="button" aria-pressed={exploded} onClick={onToggleExplode}>
            {exploded ? 'Thu gọn lớp Z' : 'Tách lớp Z'}
          </button>
        </div>
      </div>
      <div className="mlab-css3d-glow" />
      <div className="mlab-css3d-stage" ref={stageRef}>
        <div className="mlab-prism mlab-prism-plate" />
        <div className="mlab-prism mlab-prism-win">
          <div className="mlab-prism-right" />
          <div className="mlab-prism-bottom" />
          <div className="mlab-prism-face">
            <div className="mlab-win-dots">
              <i />
              <i />
              <i />
              <b>{mode.url}</b>
            </div>
            <div className="mlab-win-grid">
              <div className="mlab-win-hero">
                <strong>{mode.title}</strong>
                <em>{mode.cta}</em>
              </div>
              <div className="mlab-win-pic" />
            </div>
            <div className="mlab-win-row">
              {mode.tiles.map((tile, idx) => (
                <div className={`mlab-win-tile${idx === mode.activeTile ? ' on' : ''}`} key={tile}>
                  {tile}
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="mlab-prism mlab-prism-phone">
          <div className="mlab-phone-face">
            <b>{mode.phoneTitle}</b>
            <i />
            <i />
            <i />
          </div>
        </div>
        <div className="mlab-prism mlab-prism-chip mlab-chip-1">
          <span className="mlab-chip-ico">✓</span>
          <span>
            {mode.chip1[0]}
            <small>{mode.chip1[1]}</small>
          </span>
        </div>
        <div className="mlab-prism mlab-prism-chip mlab-chip-2">
          <span className="mlab-chip-ico">●</span>
          <span>
            {mode.chip2[0]}
            <small>{mode.chip2[1]}</small>
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * Thử nghiệm các nhóm hiệu ứng motion và khối 3D cho portal AFYLLX Digital.
 */
export default function MotionLab() {
  const [variant, setVariant] = useState<VariantKey>(readInitialVariant);
  const [modeIndex, setModeIndex] = useState(0);
  const [exploded, setExploded] = useState(false);
  const [forcedStage, setForcedStage] = useState<number | null>(null);
  const [activeSolution, setActiveSolution] = useState(-1);
  const [hoveredDemo, setHoveredDemo] = useState(-1);
  const [reducedMotion, setReducedMotion] = useState(() =>
    window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  const [replaySeed, setReplaySeed] = useState(0);
  const [metrics, setMetrics] = useState<StageMetrics>({ fps: 60, frameMs: 16.7, webgl2: true });
  const [previewDemo, setPreviewDemo] = useState<DemoItem | null>(null);

  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageCtrlRef = useRef<BlockStageController | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  // Live mutable state read by WebGL2 rAF loop without re-creating the GL context
  const sceneStateRef = useRef({
    scrollProgress: 0,
    forcedStage: null as number | null,
    activeSolution: -1,
    modeIndex: 0,
    hoveredDemo: -1,
  });

  sceneStateRef.current.forcedStage = forcedStage;
  sceneStateRef.current.activeSolution = activeSolution;
  sceneStateRef.current.modeIndex = modeIndex;
  sceneStateRef.current.hoveredDemo = hoveredDemo;

  const currentMeta = useMemo(() => VARIANTS.find((v) => v.key === variant)!, [variant]);

  const switchVariant = useCallback((next: VariantKey) => {
    setVariant(next);
    setForcedStage(null);
    const url = new URL(window.location.href);
    url.searchParams.set('variant', next);
    window.history.replaceState(null, '', url.toString());
  }, []);

  // Keyboard navigation (← / →) per prototype/UI.md
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement | null)?.isContentEditable) return;
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      const idx = VARIANTS.findIndex((v) => v.key === variant);
      const nextIdx = e.key === 'ArrowRight' ? (idx + 1) % VARIANTS.length : (idx - 1 + VARIANTS.length) % VARIANTS.length;
      switchVariant(VARIANTS[nextIdx].key);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [variant, switchVariant]);

  // Scroll progress + velocity tracking (sets CSS vars --ml-scroll-y, --ml-vel, --ml-vel-abs)
  useEffect(() => {
    let lastY = window.scrollY;
    let vel = 0;
    let raf = 0;

    const onScroll = () => {
      const y = window.scrollY;
      const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      sceneStateRef.current.scrollProgress = Math.max(0, Math.min(1, y / maxScroll));
      vel = Math.max(-28, Math.min(28, y - lastY));
      lastY = y;

      const root = rootRef.current;
      if (root && !reducedMotion) {
        root.style.setProperty('--ml-scroll-y', `${y}px`);
        root.style.setProperty('--ml-vel', `${vel.toFixed(2)}`);
        root.style.setProperty('--ml-vel-abs', `${Math.abs(vel).toFixed(2)}`);
      }
      if (!raf && !reducedMotion) {
        raf = requestAnimationFrame(decay);
      }
    };

    const decay = () => {
      vel *= 0.84;
      const root = rootRef.current;
      if (root) {
        root.style.setProperty('--ml-vel', `${vel.toFixed(2)}`);
        root.style.setProperty('--ml-vel-abs', `${Math.abs(vel).toFixed(2)}`);
      }
      if (Math.abs(vel) > 0.25) {
        raf = requestAnimationFrame(decay);
      } else {
        raf = 0;
      }
    };

    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [reducedMotion]);

  const isWebglVariant = variant !== 'A';

  // Mount WebGL2 block stage once while in B/C/D; swap choreography cleanly on variant changes
  useEffect(() => {
    if (!isWebglVariant) {
      stageCtrlRef.current?.dispose();
      stageCtrlRef.current = null;
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctrl = createBlockStage(canvas, {
      onFrame: () => {},
      onMetrics: setMetrics,
      fovDeg: 35,
      reducedMotion,
    });
    stageCtrlRef.current = ctrl;

    return () => {
      ctrl.dispose();
      stageCtrlRef.current = null;
    };
  }, [isWebglVariant]);

  useEffect(() => {
    const ctrl = stageCtrlRef.current;
    if (!ctrl || variant === 'A') return;
    const onFrame =
      variant === 'B'
        ? createAssemblyChoreography(() => sceneStateRef.current)
        : variant === 'C'
          ? createVoxelPhysicsChoreography(() => sceneStateRef.current)
          : createGlassMonolithChoreography(() => sceneStateRef.current);
    ctrl.setChoreography(onFrame, variant === 'C' ? 38 : 35);
  }, [variant, isWebglVariant]);

  useEffect(() => {
    stageCtrlRef.current?.setReducedMotion(reducedMotion);
  }, [reducedMotion]);

  // Intersection reveal observer (re-runs on variant switch or replay)
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const targets = Array.from(root.querySelectorAll<HTMLElement>('.mlab-rv, .mlab-step'));

    if (reducedMotion) {
      targets.forEach((el) => el.classList.add('in'));
      return;
    }

    targets.forEach((el) => el.classList.remove('in'));

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('in');
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.06, rootMargin: '0px 0px -6% 0px' },
    );

    const raf = requestAnimationFrame(() => {
      targets.forEach((el) => {
        if (el.getBoundingClientRect().top < window.innerHeight * 0.94) {
          el.classList.add('in');
        } else {
          io.observe(el);
        }
      });
    });

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
    };
  }, [variant, replaySeed, reducedMotion]);

  // Sync preview dialog
  useEffect(() => {
    const dlg = dialogRef.current;
    if (!dlg) return;
    if (previewDemo && !dlg.open) dlg.showModal();
    if (!previewDemo && dlg.open) dlg.close();
  }, [previewDemo]);

  const handleReplay = () => {
    setReplaySeed((s) => s + 1);
    stageCtrlRef.current?.triggerPulse(0, 0);
  };

  const handleCardMove = (e: React.PointerEvent<HTMLAnchorElement>) => {
    if (reducedMotion) return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    const nx = x / r.width - 0.5;
    const ny = y / r.height - 0.5;
    e.currentTarget.style.setProperty('--mx', `${x}px`);
    e.currentTarget.style.setProperty('--my', `${y}px`);
    e.currentTarget.style.setProperty('--rx-card', `${(-ny * 6).toFixed(2)}deg`);
    e.currentTarget.style.setProperty('--ry-card', `${(nx * 6).toFixed(2)}deg`);
  };

  return (
    <div
      ref={rootRef}
      className={`mlab-root mlab-variant-${variant}${reducedMotion ? ' mlab-reduced' : ''}`}
    >
      <a className="mlab-skip" href="#noi-dung">
        Bỏ qua tới nội dung
      </a>

      <header className="mlab-header">
        <div className="mlab-wrap mlab-bar">
          <a className="mlab-brand" href="/phuong-an/d.html">
            <span className="mlab-mark" aria-hidden="true">
              A
            </span>
            AFYLLX&nbsp;<span>Digital</span>
          </a>
          <nav className="mlab-nav" aria-label="Chính">
            <a href="#giai-phap">Giải pháp</a>
            <a href="#ban-mau">Bản mẫu</a>
            <a href="#quy-trinh">Quy trình</a>
            <a href="/phuong-an/d.html">Bản gốc</a>
          </nav>
          <a className="mlab-btn sm mlab-header-cta" href="#ban-mau">
            Xem bản mẫu
          </a>
        </div>
      </header>

      <main id="noi-dung">
        <section className="mlab-hero">
          <div className="mlab-hero-bg" />
          <div className="mlab-hero-grid" />
          <div className="mlab-wrap mlab-hero-grid-inner">
            <div className="mlab-kinetic-title" key={`${variant}-${replaySeed}`}>
              <p className="mlab-kicker">
                <i />
                {BRAND.kicker}
              </p>
              <h1 className="mlab-h1">
                {BRAND.h1Lines.map((line, i) => (
                  <span className="mlab-h1-line" key={line}>
                    <b style={{ '--d': `${i * 0.08}s` } as React.CSSProperties}>{line}</b>
                  </span>
                ))}
              </h1>
              <p className="mlab-lead">{BRAND.lead}</p>
              <div className="mlab-cta-row">
                <a className="mlab-btn" href="#ban-mau">
                  Xem bản mẫu
                </a>
                <a className="mlab-btn line" href="#giai-phap">
                  Chọn theo mục tiêu
                </a>
              </div>
              <div className="mlab-mode-badge">
                Nhóm {currentMeta.key}: {currentMeta.shortName} — {currentMeta.description}
              </div>
            </div>

            <div className="mlab-stage-wrap">
              {variant === 'A' ? (
                <Css3dStage
                  modeIndex={modeIndex}
                  exploded={exploded}
                  onToggleExplode={() => setExploded((v) => !v)}
                  reducedMotion={reducedMotion}
                />
              ) : (
                <div className="mlab-webgl-box">
                  <div className="mlab-stage-hud">
                    <span className="mlab-hud-tag">{currentMeta.engineLabel}</span>
                    {variant === 'B' && (
                      <div className="mlab-stage-pills" role="group" aria-label="Chọn trạng thái lắp ghép">
                        {ASSEMBLY_STAGES.map((label, idx) => (
                          <button
                            key={label}
                            type="button"
                            aria-pressed={forcedStage === idx}
                            onClick={() => setForcedStage((prev) => (prev === idx ? null : idx))}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    )}
                    {variant === 'C' && (
                      <div className="mlab-stage-pills">
                        <button
                          type="button"
                          onClick={() => stageCtrlRef.current?.triggerPulse(0, 0)}
                        >
                          Bấm tạo sóng 3D
                        </button>
                      </div>
                    )}
                  </div>
                  <canvas
                    ref={canvasRef}
                    aria-label="Khối 3D minh họa chuyển động website AFYLLX Digital"
                  />
                </div>
              )}

              <div className="mlab-pick" role="group" aria-label="Đổi loại website minh họa">
                {HERO_MODES.map((m, idx) => (
                  <button
                    key={m.id}
                    type="button"
                    aria-pressed={modeIndex === idx}
                    onClick={() => {
                      setModeIndex(idx);
                      stageCtrlRef.current?.triggerPulse(0, 0);
                    }}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
              <p className="mlab-caption">
                {variant === 'C'
                  ? 'Rê chuột để đẩy khối 3D, click vào khối để tạo sóng va chạm'
                  : variant === 'B'
                    ? 'Cuộn trang hoặc chọn mốc phía trên để xem khối 3D tự lắp ghép'
                    : BRAND.caption}
              </p>
            </div>
          </div>
        </section>

        <section className="mlab-section" id="giai-phap">
          <div className="mlab-wrap">
            <h2 className="mlab-h2 mlab-rv">Bạn cần website để làm việc gì?</h2>
            <p className="mlab-sub mlab-rv" style={{ '--d': '0.08s' } as React.CSSProperties}>
              Rê chuột qua từng thẻ để kiểm tra phản hồi nghiêng 3D, ánh sáng từ trường và liên kết khối 3D.
            </p>
            <div className="mlab-goals">
              {SOLUTIONS.map((sol, idx) => (
                <a
                  key={sol.id}
                  href={sol.href}
                  className={`mlab-goal mlab-rv${sol.big ? ' big' : ''}${sol.alt ? ' alt' : ''}`}
                  style={{ '--d': `${idx * 0.06}s` } as React.CSSProperties}
                  onPointerMove={handleCardMove}
                  onPointerEnter={() => setActiveSolution(sol.blockIndex)}
                  onPointerLeave={(e) => {
                    setActiveSolution(-1);
                    e.currentTarget.style.removeProperty('--rx-card');
                    e.currentTarget.style.removeProperty('--ry-card');
                  }}
                >
                  <span className="mlab-goal-ico">{idx + 1}</span>
                  <small>{sol.eyebrow}</small>
                  <h3>{sol.title}</h3>
                  <p>{sol.description}</p>
                  <u>{sol.cta}</u>
                </a>
              ))}
            </div>
          </div>
        </section>

        <section className="mlab-section mlab-night" id="ban-mau">
          <div className="mlab-wrap">
            <h2 className="mlab-h2 mlab-rv">Xem thử trước khi đặt làm</h2>
            <p className="mlab-sub mlab-rv" style={{ '--d': '0.08s' } as React.CSSProperties}>
              Mỗi bản mẫu là một website chạy được với dữ liệu minh họa, cho một doanh nghiệp không có thật.
            </p>
            <div className="mlab-demos">
              {DEMOS.map((demo, idx) => (
                <button
                  key={demo.slug}
                  type="button"
                  className="mlab-demo mlab-rv"
                  style={{ '--d': `${idx * 0.1}s` } as React.CSSProperties}
                  onMouseEnter={() => setHoveredDemo(idx)}
                  onMouseLeave={() => setHoveredDemo(-1)}
                  onClick={() => setPreviewDemo(demo)}
                >
                  <span className={`mlab-shot ${demo.themeClass}`} aria-hidden="true">
                    <span className="mlab-shot-bar">
                      {demo.business}
                      <span>{demo.navText}</span>
                    </span>
                    <span className="mlab-shot-body">
                      <b>{demo.headline}</b>
                      <span className="mlab-shot-tiles">
                        <i />
                        <i />
                        <i />
                      </span>
                    </span>
                    <span className="mlab-demo-tag">Bản mẫu</span>
                  </span>
                  <span className="mlab-demo-title">{demo.title}</span>
                  <span className="mlab-demo-desc">{demo.subtitle}</span>
                  <span className="mlab-demo-open">Mở bản mẫu</span>
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="mlab-section" id="quy-trinh">
          <div className="mlab-wrap">
            <h2 className="mlab-h2 mlab-rv">Từ lúc trao đổi đến khi website chạy</h2>
            <ol className="mlab-steps">
              {PROCESS_STEPS.map((step, idx) => (
                <li
                  key={step.num}
                  className="mlab-step"
                  style={{ '--d': `${idx * 0.09}s` } as React.CSSProperties}
                >
                  <span className="mlab-step-num">{step.num}</span>
                  <b>{step.title}</b>
                  <p>{step.desc}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>
      </main>

      <footer className="mlab-footer">
        <div className="mlab-wrap mlab-foot-inner">
          <span>
            © 2026 {BRAND.name}, <a href={BRAND.parentUrl}>thuộc hệ sinh thái AFYLLX</a>
          </span>
          <a href={`mailto:${BRAND.email}`}>{BRAND.email}</a>
        </div>
      </footer>

      <dialog
        ref={dialogRef}
        className="mlab-dialog"
        aria-labelledby="mlab-dlg-title"
        onClose={() => setPreviewDemo(null)}
      >
        <div className="mlab-dialog-bar">
          <h2 id="mlab-dlg-title">{previewDemo ? previewDemo.title : 'Bản mẫu website'}</h2>
          <button
            type="button"
            className="mlab-dialog-close"
            onClick={() => setPreviewDemo(null)}
          >
            Đóng bản mẫu
          </button>
        </div>
        {previewDemo && <iframe title={`Bản mẫu: ${previewDemo.title}`} src={previewDemo.route} />}
      </dialog>

      {/* Floating Prototype Bar per prototype/UI.md */}
      <aside className="mlab-switcher" aria-label="Bộ chuyển nhóm hiệu ứng motion và 3D">
        <button
          type="button"
          className="mlab-sw-arrow"
          aria-label="Nhóm hiệu ứng trước"
          onClick={() => {
            const idx = VARIANTS.findIndex((v) => v.key === variant);
            switchVariant(VARIANTS[(idx - 1 + VARIANTS.length) % VARIANTS.length].key);
          }}
        >
          ←
        </button>

        {VARIANTS.map((v) => (
          <button
            key={v.key}
            type="button"
            className="mlab-sw-btn"
            aria-pressed={variant === v.key}
            onClick={() => switchVariant(v.key)}
          >
            {v.key}
          </button>
        ))}

        <span className="mlab-sw-label">
          {currentMeta.key} <span>({currentMeta.shortName})</span>
        </span>

        <button
          type="button"
          className="mlab-sw-arrow"
          aria-label="Nhóm hiệu ứng tiếp theo"
          onClick={() => {
            const idx = VARIANTS.findIndex((v) => v.key === variant);
            switchVariant(VARIANTS[(idx + 1) % VARIANTS.length].key);
          }}
        >
          →
        </button>

        <span className="mlab-sw-sep" aria-hidden="true" />

        <button type="button" className="mlab-sw-btn" onClick={handleReplay}>
          Phát lại
        </button>

        <button
          type="button"
          className="mlab-sw-btn"
          aria-pressed={reducedMotion}
          onClick={() => setReducedMotion((r) => !r)}
        >
          {reducedMotion ? 'Đang giảm CĐ' : 'Giảm CĐ'}
        </button>

        {variant !== 'A' && (
          <span className="mlab-sw-fps" title="Tốc độ dựng khung hình WebGL2">
            {metrics.webgl2 ? `${metrics.fps} fps · ${metrics.frameMs} ms` : 'WebGL2 tắt'}
          </span>
        )}
      </aside>
    </div>
  );
}
