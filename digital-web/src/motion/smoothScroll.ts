import Lenis from 'lenis';
import { gsap, ScrollTrigger, prefersReduced } from './gsap';

/**
 * Lenis + ScrollTrigger dùng chung một nhịp: Lenis chạy trong gsap.ticker, mỗi lần Lenis cuộn thì ScrollTrigger.update().
 * Chỉ một phiên bản Lenis tại một thời điểm (ConceptFrame bật/tắt khi vào/rời concept).
 * Tắt hoàn toàn khi người dùng bật giảm chuyển động: cuộn gốc của trình duyệt.
 */
let lenis: Lenis | null = null;
let tick: ((time: number) => void) | null = null;

export function startSmoothScroll(options: { lerp?: number; wheelMultiplier?: number } = {}) {
  stopSmoothScroll();
  if (prefersReduced()) return null;
  lenis = new Lenis({
    autoRaf: false,
    lerp: options.lerp ?? 0.11,
    wheelMultiplier: options.wheelMultiplier ?? 1,
    smoothWheel: true,
    // touch giữ cuộn gốc (quán tính của hệ điều hành) để không "trôi" trên điện thoại
    syncTouch: false,
    anchors: false,
  });
  lenis.on('scroll', ScrollTrigger.update);
  tick = (time) => lenis?.raf(time * 1000);
  gsap.ticker.add(tick);
  gsap.ticker.lagSmoothing(0);
  document.documentElement.classList.add('afx-lenis');
  if (document.documentElement.classList.contains('afx-scroll-locked')) lenis.stop();
  return lenis;
}

export function stopSmoothScroll() {
  if (tick) gsap.ticker.remove(tick);
  tick = null;
  lenis?.destroy();
  lenis = null;
  gsap.ticker.lagSmoothing(500, 33);
  document.documentElement.classList.remove('afx-lenis');
}

export const getLenis = () => lenis;

/** Tạm dừng cuộn trang (khi mở dialog, menu toàn màn hình). */
export function lockScroll(locked: boolean) {
  if (lenis) (locked ? lenis.stop() : lenis.start());
  document.documentElement.classList.toggle('afx-scroll-locked', locked);
}

/**
 * Cuộn tới phần tử / id / số px. Bù chiều cao header cố định qua biến CSS --afx-scroll-offset (mặc định 0).
 * immediate: nhảy ngay (dùng khi vừa vào trang có #hash).
 */
export function scrollToTarget(target: string | HTMLElement | number, opts: { immediate?: boolean; offset?: number } = {}) {
  const el = typeof target === 'string' ? document.getElementById(target.replace(/^#/, '')) : target;
  if (el == null) return;
  const cssOffset = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--afx-scroll-offset')) || 0;
  const offset = -(opts.offset ?? cssOffset);
  if (lenis) {
    lenis.scrollTo(el as HTMLElement | number, { offset, immediate: opts.immediate, duration: 1.4, force: true });
    return;
  }
  const y = typeof el === 'number' ? el : el.getBoundingClientRect().top + scrollY + offset;
  scrollTo({ top: y, behavior: opts.immediate || prefersReduced() ? 'auto' : 'smooth' });
}
