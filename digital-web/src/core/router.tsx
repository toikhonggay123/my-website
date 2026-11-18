import { useEffect, useState, type AnchorHTMLAttributes, type MouseEvent } from 'react';

/**
 * Router tối giản theo pathname (không thêm thư viện).
 * - navigate(): pushState + phát sự kiện; nếu trang hiện tại đăng ký hiệu ứng rời trang (setLeaveTransition) thì chạy trước.
 * - <Link>: thẻ <a> thật (SEO, mở thẻ mới vẫn chạy), chặn click thường để chuyển trang mượt.
 */

type Leave = (to: string) => Promise<void> | void;
let leave: Leave | null = null;
let busy = false;

/** Concept đăng ký hiệu ứng rời trang của mình. Trả hàm hủy đăng ký. */
export function setLeaveTransition(fn: Leave | null) {
  leave = fn;
  return () => {
    if (leave === fn) leave = null;
  };
}

const EVENT = 'afx:navigate';
const normalizePath = (path: string) => path.replace(/\/+$/, '') || '/';

export async function navigate(to: string, opts: { replace?: boolean; skipLeave?: boolean } = {}) {
  const url = new URL(to, location.href);
  if (url.origin !== location.origin) {
    location.href = url.href;
    return;
  }
  // Trang tĩnh trong public/ (bản mẫu portfolio, lời chúc 20/11) không thuộc SPA.
  if (isStaticRoute(url.pathname)) {
    location.href = url.href;
    return;
  }
  if (busy) return;
  const updateHistory = () => {
    if (url.href === location.href) return;
    history[opts.replace ? 'replaceState' : 'pushState'](null, '', url.pathname + url.search + url.hash);
    window.dispatchEvent(new Event(EVENT));
  };
  // The same frame stays mounted, so its leave transition would leave it hidden.
  if (normalizePath(url.pathname) === normalizePath(location.pathname)) {
    updateHistory();
    window.dispatchEvent(new CustomEvent('afx:hash', { detail: url.hash.slice(1) }));
    return;
  }
  busy = true;
  try {
    if (leave && !opts.skipLeave && !matchMedia('(prefers-reduced-motion: reduce)').matches) await leave(url.pathname);
  } catch {
    /* hiệu ứng lỗi không được chặn điều hướng */
  }
  busy = false;
  updateHistory();
}

export function isStaticRoute(path: string) {
  return path.startsWith('/mau/portfolio-nhiep-anh') || path.startsWith('/loi-chuc-20-11');
}

export interface Location {
  path: string;
  search: string;
  hash: string;
}
const read = (): Location => ({ path: normalizePath(location.pathname), search: location.search, hash: location.hash.slice(1) });

export function useLocation() {
  const [loc, setLoc] = useState(read);
  useEffect(() => {
    const on = () => setLoc(read());
    window.addEventListener(EVENT, on);
    window.addEventListener('popstate', on);
    return () => {
      window.removeEventListener(EVENT, on);
      window.removeEventListener('popstate', on);
    };
  }, []);
  return loc;
}

type LinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & { href: string };

/** Liên kết nội bộ có chuyển trang mượt. Liên kết ngoài / mailto / target khác giữ hành vi mặc định. */
export function Link({ href, onClick, target, ...rest }: LinkProps) {
  const handle = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e);
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (target && target !== '_self') return;
    if (/^(mailto:|tel:|https?:)/.test(href)) return;
    e.preventDefault();
    navigate(href);
  };
  return <a href={href} target={target} onClick={handle} {...rest} />;
}
