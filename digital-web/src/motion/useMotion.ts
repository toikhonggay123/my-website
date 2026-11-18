import { useLayoutEffect, useRef, type DependencyList, type RefObject } from 'react';
import { gsap, ScrollTrigger } from './gsap';
import { media } from './tokens';

export interface MotionConditions {
  desktop: boolean;
  tablet: boolean;
  mobile: boolean;
  /** true khi người dùng bật giảm chuyển động — mọi pattern đã tự bỏ qua, setup chỉ cần đảm bảo trạng thái tĩnh đẹp. */
  reduced: boolean;
}

export type Cleanup = () => void;
export type MotionSetup = (
  conditions: MotionConditions,
  root: HTMLElement,
) => void | Cleanup | (Cleanup | void | null | undefined)[];

/**
 * Hook gốc cho mọi animation GSAP trong concept.
 * - Chạy trong gsap.matchMedia() → tự revert khi đổi breakpoint hoặc khi unmount (không rò ScrollTrigger / tween).
 * - `setup` nhận điều kiện desktop/tablet/mobile/reduced và phần tử gốc; selector text trong gsap bị giới hạn trong scope.
 * - Trả về hàm (hoặc mảng hàm) dọn dẹp cho listener tự gắn (vd magnetic()).
 * - Sau khi dựng xong gọi ScrollTrigger.refresh() một lần (font/ảnh có thể đổi layout).
 *
 * Ví dụ:
 *   const scope = useRef<HTMLElement>(null);
 *   useMotion(scope, ({ desktop }) => { kineticText('.hero h1'); if (desktop) horizontalStory(...); });
 */
export function useMotion<T extends HTMLElement>(scope: RefObject<T | null>, setup: MotionSetup, deps: DependencyList = []) {
  const saved = useRef(setup);
  saved.current = setup;

  useLayoutEffect(() => {
    const root = scope.current;
    if (!root) return;
    const mm = gsap.matchMedia(root);
    mm.add(
      { desktop: media.desktop, tablet: media.tablet, mobile: media.mobile, reduced: media.reduced },
      (ctx) => {
        const c = ctx.conditions as unknown as MotionConditions;
        const result = saved.current(c, root);
        const list = (Array.isArray(result) ? result : [result]).filter(Boolean) as Cleanup[];
        return () => list.forEach((fn) => fn());
      },
    );
    // Một lần refresh sau khi font sẵn sàng để vị trí start/end chính xác.
    let alive = true;
    document.fonts?.ready.then(() => alive && ScrollTrigger.refresh());
    return () => {
      alive = false;
      mm.revert();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

/** Gọi khi layout đổi do nội dung động (mở accordion, đổi bước wizard...). Gộp nhiều lần gọi trong một khung hình. */
let queued = false;
export function refreshScroll() {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => {
    queued = false;
    ScrollTrigger.refresh();
  });
}
