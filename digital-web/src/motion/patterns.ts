import { gsap, ScrollTrigger, SplitText, prefersReduced, canHover } from './gsap';
import { scrollToTarget } from './smoothScroll';
import { dur, ease, stagger, distance, enterStart } from './tokens';

/**
 * 10 MOTION PATTERN + SINGULARITY BLOOM
 * Gọi bên trong useMotion(...) để được dọn dẹp tự động. Tất cả chỉ animate transform / opacity / clip-path.
 * Mọi pattern tự thoát (no-op) khi prefers-reduced-motion — trạng thái tĩnh chính là trạng thái cuối.
 *
 * Target nhận Element, mảng Element hoặc selector (selector được giới hạn trong scope của useMotion).
 */
type Target = gsap.TweenTarget;
const toArray = (t: Target) => gsap.utils.toArray<HTMLElement>(t as gsap.DOMTarget);

// ---------------------------------------------------------------- 1. Depth Parallax
/**
 * Nhiều lớp trôi với tốc độ khác nhau khi cuộn qua `trigger`. depth: % chiều cao lớp (âm = đi lên nhanh hơn).
 * Ví dụ: depthParallax(['.bg', '.mid', '.fg'], { trigger: '.hero', depths: [-6, -14, -28] })
 */
export function depthParallax(layers: Target, opts: { trigger?: Target; depths?: number[]; start?: string; end?: string } = {}) {
  if (prefersReduced()) return;
  const els = toArray(layers);
  els.forEach((el, i) => {
    const depth = opts.depths?.[i] ?? -8 * (i + 1);
    gsap.fromTo(
      el,
      { yPercent: 0 },
      {
        yPercent: depth,
        ease: ease.none,
        scrollTrigger: { trigger: (opts.trigger as Element) ?? el, start: opts.start ?? 'top top', end: opts.end ?? 'bottom top', scrub: true },
      },
    );
  });
}

// ---------------------------------------------------------------- 2. Kinetic Text Reveal
/**
 * Chữ hiện theo dòng/từ/ký tự sau mặt nạ. Tự tách lại khi đổi kích thước (autoSplit) và giữ aria-label cho trình đọc màn hình.
 * scroll: true → chạy khi vào khung nhìn; false → chạy ngay (dùng trong timeline hero, truyền `timeline` + `at`).
 * Đặt data-kinetic lên phần tử để CSS nới vùng mặt nạ cho dấu tiếng Việt (core/base.css).
 */
export function kineticText(
  target: Target,
  opts: {
    by?: 'lines' | 'words' | 'chars';
    scroll?: boolean;
    trigger?: Target;
    delay?: number;
    duration?: number;
    stagger?: number;
    from?: gsap.TweenVars;
    timeline?: gsap.core.Timeline;
    at?: gsap.Position;
  } = {},
) {
  const els = toArray(target);
  if (!els.length) return [];
  const by = opts.by ?? 'lines';
  return els.map((el) => {
    el.setAttribute('data-kinetic', by);
    if (prefersReduced()) return null;
    const type = by === 'chars' ? 'lines,words,chars' : by === 'words' ? 'lines,words' : 'lines';
    return SplitText.create(el, {
      type,
      mask: 'lines',
      autoSplit: true,
      linesClass: 'kt-line',
      wordsClass: 'kt-word',
      charsClass: 'kt-char',
      onSplit(self) {
        const parts = by === 'chars' ? self.chars : by === 'words' ? self.words : self.lines;
        const vars: gsap.TweenVars = {
          yPercent: 115,
          rotate: by === 'lines' ? 0 : 4,
          ...opts.from,
        };
        const toVars: gsap.TweenVars = {
          duration: opts.duration ?? (by === 'chars' ? dur.base : dur.long),
          ease: ease.out,
          stagger: opts.stagger ?? stagger[by],
          delay: opts.delay ?? 0,
        };
        if (opts.timeline) {
          const tw = gsap.from(parts, { ...vars, ...toVars, delay: 0 });
          opts.timeline.add(tw, opts.at ?? 0);
          return tw;
        }
        return gsap.from(parts, {
          ...vars,
          ...toVars,
          scrollTrigger: opts.scroll === false ? undefined : { trigger: (opts.trigger as Element) ?? el, start: enterStart, once: true },
        });
      },
    });
  });
}

// ---------------------------------------------------------------- 3. Staggered Cascade
/** Các phần tử vào cảnh nối tiếp khi nhóm chạm khung nhìn. */
export function cascade(items: Target, opts: { trigger?: Target; y?: number; x?: number; stagger?: number; duration?: number; start?: string; scale?: number } = {}) {
  const els = toArray(items);
  if (!els.length || prefersReduced()) return;
  return gsap.from(els, {
    autoAlpha: 0,
    y: opts.y ?? distance.md,
    x: opts.x ?? 0,
    scale: opts.scale ?? 1,
    duration: opts.duration ?? dur.base,
    ease: ease.out,
    stagger: opts.stagger ?? stagger.items,
    scrollTrigger: { trigger: (opts.trigger as Element) ?? els[0].parentElement, start: opts.start ?? enterStart, once: true },
  });
}

// ---------------------------------------------------------------- 4. Immersive Zoom-In
/**
 * Ảnh / khung phóng từ nhỏ ra tràn khi cuộn (scrub). from: tỉ lệ ban đầu; radius: bo góc ban đầu (px) thu về 0.
 * pin: giữ section đứng yên trong lúc phóng (chỉ nên dùng trên desktop).
 */
export function immersiveZoom(el: Target, opts: { trigger?: Target; from?: number; radius?: number; pin?: boolean | Target; end?: string; inner?: Target; innerFrom?: number } = {}) {
  if (prefersReduced()) return;
  const [node] = toArray(el);
  if (!node) return;
  const tl = gsap.timeline({
    defaults: { ease: ease.none },
    scrollTrigger: {
      trigger: (opts.trigger as Element) ?? node,
      start: opts.pin ? 'top top' : 'top bottom',
      end: opts.end ?? (opts.pin ? '+=100%' : 'center center'),
      scrub: 1,
      pin: opts.pin === true ? ((opts.trigger as Element) ?? node) : (opts.pin as Element | undefined),
    },
  });
  tl.fromTo(node, { scale: opts.from ?? 0.78, borderRadius: opts.radius ?? 28 }, { scale: 1, borderRadius: 0 }, 0);
  if (opts.inner) tl.fromTo(opts.inner, { scale: opts.innerFrom ?? 1.25 }, { scale: 1 }, 0);
  return tl;
}

// ---------------------------------------------------------------- 5. Horizontal Storytelling
/**
 * Cuộn dọc → dải nội dung chạy ngang, section được ghim. Chỉ gọi trong điều kiện desktop/tablet;
 * trên mobile để CSS lo (overflow-x + scroll-snap) — không ghim, không chiếm cuộn.
 * Trả timeline để concept gắn thêm hiệu ứng theo tiến độ (containerAnimation).
 */
export function horizontalStory(section: Target, track: Target, opts: { scrub?: number; endPad?: number } = {}) {
  if (prefersReduced()) return;
  const [sec] = toArray(section);
  const [trk] = toArray(track);
  if (!sec || !trk) return;
  const distanceX = () => Math.max(0, trk.scrollWidth - sec.clientWidth + (opts.endPad ?? 0));
  const tween = gsap.to(trk, {
    x: () => -distanceX(),
    ease: ease.none,
    scrollTrigger: {
      trigger: sec,
      start: 'top top',
      end: () => '+=' + distanceX(),
      pin: true,
      scrub: opts.scrub ?? 1,
      invalidateOnRefresh: true,
      anticipatePin: 1,
    },
  });
  const trigger = tween.scrollTrigger;
  if (trigger) {
    gsap.context(() => {
      let frame = 0;
      const showFocusedCard = () => {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => {
          const target = document.activeElement;
          if (!(target instanceof HTMLElement) || !trk.contains(target) || !target.matches(':focus-visible')) return;
          const travel = distanceX();
          if (!travel) return;

          // Trình duyệt có thể tự cuộn khung overflow:hidden khi Tab tới thẻ ngoài màn hình.
          // Đưa khung về vị trí gốc để ScrollTrigger là nguồn duy nhất điều khiển trục ngang.
          for (let box = trk.parentElement; box && sec.contains(box); box = box.parentElement) {
            if (box.scrollLeft) box.scrollLeft = 0;
          }

          const bounds = sec.getBoundingClientRect();
          const card = target.getBoundingClientRect();
          const left = Math.max(0, bounds.left) + 12;
          const right = Math.min(document.documentElement.clientWidth, bounds.right) - 12;
          if (card.left >= left && card.right <= right) return;
          const x = Number(gsap.getProperty(trk, 'x'));
          const progress = gsap.utils.clamp(0, 1, ((card.left + card.right - left - right) / 2 - x) / travel);
          scrollToTarget(trigger.start + (trigger.end - trigger.start) * progress, { immediate: true, offset: 0 });
          ScrollTrigger.update();
          trigger.getTween()?.progress(1);
        });
      };
      trk.addEventListener('focusin', showFocusedCard);
      return () => {
        cancelAnimationFrame(frame);
        trk.removeEventListener('focusin', showFocusedCard);
      };
    });
  }
  return tween;
}

// ---------------------------------------------------------------- 6. Cinematic Mask Reveal
/** Mở phần tử bằng clip-path. shape: 'up' | 'down' | 'left' | 'right' | 'center' | 'circle'. scrub: gắn theo cuộn. */
export function maskReveal(el: Target, opts: { shape?: 'up' | 'down' | 'left' | 'right' | 'center' | 'circle'; trigger?: Target; scrub?: boolean; duration?: number; inner?: Target; delay?: number } = {}) {
  if (prefersReduced()) return;
  const els = toArray(el);
  if (!els.length) return;
  const from: Record<string, string> = {
    up: 'inset(100% 0% 0% 0%)',
    down: 'inset(0% 0% 100% 0%)',
    left: 'inset(0% 0% 0% 100%)',
    right: 'inset(0% 100% 0% 0%)',
    center: 'inset(50% 50% 50% 50%)',
    circle: 'circle(0% at 50% 50%)',
  };
  const to = opts.shape === 'circle' ? 'circle(75% at 50% 50%)' : 'inset(0% 0% 0% 0%)';
  const st: ScrollTrigger.Vars = opts.scrub
    ? { trigger: (opts.trigger as Element) ?? els[0], start: 'top bottom', end: 'top 30%', scrub: 1 }
    : { trigger: (opts.trigger as Element) ?? els[0], start: enterStart, once: true };
  const tl = gsap.timeline({ scrollTrigger: st, delay: opts.delay ?? 0 });
  tl.fromTo(els, { clipPath: from[opts.shape ?? 'up'] }, { clipPath: to, duration: opts.duration ?? dur.long, ease: opts.scrub ? ease.none : ease.inOut, stagger: stagger.cards }, 0);
  if (opts.inner) tl.fromTo(opts.inner, { scale: 1.3 }, { scale: 1, duration: (opts.duration ?? dur.long) * 1.2, ease: opts.scrub ? ease.none : ease.out }, 0);
  return tl;
}

// ---------------------------------------------------------------- 7. Magnetic Interaction
/**
 * Nút / thẻ bị "hút" nhẹ theo con trỏ, nhả ra đàn hồi. Chỉ trên thiết bị có hover thật.
 * TRẢ VỀ hàm dọn dẹp — return nó từ setup của useMotion.
 */
export function magnetic(target: Target, opts: { strength?: number; inner?: string; innerStrength?: number } = {}) {
  if (prefersReduced() || !canHover()) return () => {};
  const els = toArray(target);
  const offs = els.map((el) => {
    const s = opts.strength ?? 0.3;
    const xTo = gsap.quickTo(el, 'x', { duration: 0.6, ease: 'elastic.out(1, 0.45)' });
    const yTo = gsap.quickTo(el, 'y', { duration: 0.6, ease: 'elastic.out(1, 0.45)' });
    const inner = opts.inner ? el.querySelector<HTMLElement>(opts.inner) : null;
    const ixTo = inner ? gsap.quickTo(inner, 'x', { duration: 0.5, ease: ease.out }) : null;
    const iyTo = inner ? gsap.quickTo(inner, 'y', { duration: 0.5, ease: ease.out }) : null;
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      xTo(dx * s);
      yTo(dy * s);
      ixTo?.(dx * (opts.innerStrength ?? s * 0.6));
      iyTo?.(dy * (opts.innerStrength ?? s * 0.6));
    };
    const reset = () => {
      xTo(0);
      yTo(0);
      ixTo?.(0);
      iyTo?.(0);
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerleave', reset);
    return () => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerleave', reset);
      gsap.set([el, inner].filter(Boolean), { x: 0, y: 0 });
    };
  });
  return () => offs.forEach((off) => off());
}

// ---------------------------------------------------------------- 8. Ambient Drift
/** Chuyển động nền rất chậm, biên độ nhỏ (px / độ). Dừng khi phần tử ra khỏi khung nhìn để tiết kiệm CPU. */
export function ambientDrift(target: Target, opts: { x?: number; y?: number; rotate?: number; scale?: number; duration?: number } = {}) {
  if (prefersReduced()) return;
  const els = toArray(target);
  els.forEach((el, i) => {
    const tl = gsap.timeline({ repeat: -1, yoyo: true, defaults: { ease: 'sine.inOut' } });
    const d = (opts.duration ?? 9) + i * 1.7;
    tl.to(el, {
      x: gsap.utils.random(-1, 1) * (opts.x ?? 14),
      y: gsap.utils.random(-1, 1) * (opts.y ?? 18),
      rotate: gsap.utils.random(-1, 1) * (opts.rotate ?? 3),
      scale: 1 + (opts.scale ?? 0),
      duration: d,
    });
    ScrollTrigger.create({ trigger: el, start: 'top bottom', end: 'bottom top', onToggle: (self) => (self.isActive ? tl.play() : tl.pause()) });
  });
}

// ---------------------------------------------------------------- 9. Fluid Navbar Morph
/**
 * Gắn trạng thái cuộn lên header: data-scrolled="true|false", data-direction="up|down", và biến CSS --nav-progress (0→1 trong `range` px đầu).
 * Concept tự viết CSS cho hình dạng từng trạng thái (bo góc, độ rộng, nền) với transition transform/opacity/background.
 */
export function navMorph(nav: Target, opts: { threshold?: number; range?: number; hideOnDown?: boolean } = {}) {
  const [el] = toArray(nav);
  if (!el) return;
  const threshold = opts.threshold ?? 24;
  const range = opts.range ?? 240;
  el.dataset.scrolled = 'false';
  el.dataset.direction = 'up';
  return ScrollTrigger.create({
    start: 0,
    end: 'max',
    onUpdate(self) {
      const y = self.scroll();
      el.dataset.scrolled = String(y > threshold);
      el.dataset.direction = self.direction === 1 && y > threshold * 4 && opts.hideOnDown ? 'down' : 'up';
      el.style.setProperty('--nav-progress', Math.min(1, y / range).toFixed(3));
    },
  });
}

// ---------------------------------------------------------------- 10. Grand Finale Reveal
/**
 * Cảnh kết: nền mở ra (clip-path từ tâm), tiêu đề kinetic, các phần tử cascade. pin=true giữ cảnh trong lúc mở (desktop).
 */
export function finaleReveal(section: Target, opts: { backdrop?: Target; title?: Target; items?: Target; pin?: boolean; shape?: 'circle' | 'inset' } = {}) {
  const [sec] = toArray(section);
  if (!sec) return;
  if (opts.title) kineticText(opts.title, { by: 'words', trigger: sec });
  if (prefersReduced()) return;
  const tl = gsap.timeline({
    scrollTrigger: { trigger: sec, start: opts.pin ? 'top top' : 'top 85%', end: opts.pin ? '+=80%' : 'top 25%', scrub: 1, pin: opts.pin ? sec : false },
  });
  if (opts.backdrop) {
    tl.fromTo(
      opts.backdrop,
      { clipPath: opts.shape === 'inset' ? 'inset(18% 22% 18% 22% round 32px)' : 'circle(8% at 50% 60%)' },
      { clipPath: opts.shape === 'inset' ? 'inset(0% 0% 0% 0% round 0px)' : 'circle(110% at 50% 60%)', ease: ease.inOut },
      0,
    );
  }
  if (opts.items) tl.from(opts.items, { autoAlpha: 0, y: distance.md, stagger: stagger.items, ease: ease.out }, 0.35);
  return tl;
}

// ================================================================ FLAGSHIP: SINGULARITY BLOOM
export interface BloomOptions {
  /** Section hero — được ghim trong lúc zoom (desktop). */
  stage: Target;
  /** Vật thể trung tâm (khối/ảnh/hình). Nên có perspective ở phần tử cha. */
  object: Target;
  /** Các lớp chiều sâu quanh/sau vật thể; bung ra theo z khi vào cảnh và khi zoom. */
  layers?: Target;
  /** Tiêu đề h1 — kinetic text. */
  title?: Target;
  /** Đoạn dẫn, nút, nhãn phụ — vào cảnh sau tiêu đề. */
  extras?: Target;
  /** Lớp phủ màu của section kế tiếp — mờ dần lên ở cuối zoom để nối cảnh liền mạch. */
  bridge?: Target;
  /** Tỉ lệ phóng cuối của vật thể khi cuộn hết hero (camera "bay vào"). */
  zoomTo?: number;
  /** Độ dài cảnh ghim, % chiều cao viewport. */
  pinLength?: number;
  /** Ghim hero trên desktop. Tắt trên mobile tự động. */
  pin?: boolean;
  /** Độ trễ trước khi mở màn (s). */
  delay?: number;
  /** Cách tách tiêu đề. */
  titleBy?: 'lines' | 'words' | 'chars';
  /** Trả về true nếu viewport hiện tại là mobile (lấy từ useMotion conditions). */
  mobile?: boolean;
}

/**
 * Singularity Bloom — cảnh hero chủ lực.
 * 1) Mở màn: vật thể nở từ một điểm (scale + xoay 3D + mờ), các lớp chiều sâu tách ra theo trục z, tiêu đề chạy kinetic, phần phụ vào sau.
 * 2) Cuộn (scrub): hero được ghim, camera phóng vào vật thể, lớp tản ra, chữ lùi lên và mờ, cầu nối màu phủ lên → nhả sang section kế.
 * Trên mobile: không ghim; chỉ còn phóng nhẹ + mờ theo cuộn.
 * Trả { intro, scroll } để concept chèn thêm bước riêng.
 */
export function singularityBloom(o: BloomOptions) {
  const [stage] = toArray(o.stage);
  const object = toArray(o.object);
  const layers = o.layers ? toArray(o.layers) : [];
  const extras = o.extras ? toArray(o.extras) : [];
  if (o.title) toArray(o.title).forEach((t) => t.setAttribute('data-kinetic', o.titleBy ?? 'lines'));
  if (!stage || !object.length || prefersReduced()) return { intro: null, scroll: null };

  const intro = gsap.timeline({ delay: o.delay ?? 0.15, defaults: { ease: ease.cinema } });
  intro.fromTo(object, { autoAlpha: 0, scale: 0.08, rotateX: 38, rotateY: -24, filter: 'blur(14px)' }, { autoAlpha: 1, scale: 1, rotateX: 0, rotateY: 0, filter: 'blur(0px)', duration: dur.epic, clearProps: 'filter' }, 0);
  if (layers.length) {
    intro.fromTo(
      layers,
      { autoAlpha: 0, z: -400, scale: 0.6 },
      { autoAlpha: 1, z: 0, scale: 1, duration: dur.epic, stagger: { each: 0.09, from: 'center' } },
      0.15,
    );
  }
  if (o.title) kineticText(o.title, { by: o.titleBy ?? 'lines', scroll: false, timeline: intro, at: 0.45 });
  if (extras.length) intro.from(extras, { autoAlpha: 0, y: distance.md, duration: dur.base, stagger: stagger.items, ease: ease.out }, 0.9);

  const pin = (o.pin ?? true) && !o.mobile;
  const scroll = gsap.timeline({
    defaults: { ease: ease.none },
    scrollTrigger: {
      trigger: stage,
      start: 'top top',
      end: pin ? `+=${o.pinLength ?? 110}%` : 'bottom top',
      scrub: pin ? 1 : true,
      pin: pin ? stage : false,
      anticipatePin: 1,
    },
  });
  // fromTo + immediateRender:false: giá trị đầu = trạng thái cuối của intro, nên hai timeline không giành nhau
  // và không có gì bị ghi đè trước khi người dùng thật sự cuộn.
  const ir = { immediateRender: false } as const;
  scroll.fromTo(object, { scale: 1 }, { scale: o.mobile ? 1.15 : (o.zoomTo ?? 3.2), ease: ease.inOut, ...ir }, 0);
  if (layers.length) scroll.fromTo(layers, { scale: 1, autoAlpha: 1 }, { scale: (i: number) => 1.6 + i * 0.35, autoAlpha: 0, ease: ease.inOut, stagger: 0.02, ...ir }, 0);
  if (o.title) scroll.fromTo(o.title, { yPercent: 0, autoAlpha: 1 }, { yPercent: -60, autoAlpha: 0, ...ir }, 0);
  if (extras.length) scroll.fromTo(extras, { y: 0, autoAlpha: 1 }, { y: -distance.lg, autoAlpha: 0, ...ir }, 0);
  if (o.bridge) scroll.fromTo(o.bridge, { autoAlpha: 0 }, { autoAlpha: 1, ease: ease.inOut, ...ir }, 0.55);
  return { intro, scroll };
}
