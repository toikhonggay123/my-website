/**
 * Motion tokens dùng chung cho cả 10 concept. Concept có thể nhân hệ số (tempo) nhưng giữ tỉ lệ giữa các mức,
 * để mọi chuyển động trong hệ đọc như cùng một "nhịp".
 */
export const dur = {
  /** phản hồi hover / press */
  micro: 0.18,
  /** phần tử nhỏ vào cảnh */
  short: 0.45,
  /** khối nội dung vào cảnh */
  base: 0.8,
  /** tiêu đề lớn, mặt nạ ảnh */
  long: 1.2,
  /** hero, cảnh mở màn */
  epic: 1.8,
} as const;

export const ease = {
  out: 'afx.out',
  inOut: 'afx.inOut',
  in: 'afx.in',
  cinema: 'afx.cinema',
  none: 'none',
} as const;

export const stagger = {
  chars: 0.018,
  words: 0.045,
  lines: 0.09,
  items: 0.08,
  cards: 0.12,
} as const;

/** Quãng dịch chuyển chuẩn (px) khi phần tử vào cảnh. */
export const distance = { sm: 16, md: 32, lg: 64 } as const;

/** Breakpoint cho gsap.matchMedia — khớp với CSS của concept. */
export const media = {
  desktop: '(min-width: 1024px) and (prefers-reduced-motion: no-preference)',
  tablet: '(min-width: 700px) and (max-width: 1023.98px) and (prefers-reduced-motion: no-preference)',
  mobile: '(max-width: 699.98px) and (prefers-reduced-motion: no-preference)',
  motion: '(prefers-reduced-motion: no-preference)',
  reduced: '(prefers-reduced-motion: reduce)',
} as const;

/** Mốc cuộn chuẩn cho ScrollTrigger vào cảnh. */
export const enterStart = 'top 82%';

/** Giá trị CSS tương ứng — nhúng vào CSS concept qua var(--afx-ease-out) v.v. (khai báo trong core/base.css). */
export const cssEase = {
  out: 'cubic-bezier(.16,1,.3,1)',
  inOut: 'cubic-bezier(.65,0,.35,1)',
} as const;
