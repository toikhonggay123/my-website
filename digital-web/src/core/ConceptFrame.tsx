import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { ConceptLinks, ConceptMeta, PageKind, Theme } from './types';
import { seo, brand } from '../content/site';
import { DemoPreviewProvider } from './DemoPreview';
import { setLeaveTransition } from './router';
import { gsap, ScrollTrigger, startSmoothScroll, stopSmoothScroll, scrollToTarget } from '../motion';

/** Đường dẫn của một concept. */
export function makeLinks(kind: PageKind): ConceptLinks {
  return {
    home: '/',
    section: (hash) => (kind === 'home' ? `#${hash}` : `/#${hash}`),
    order: (query) => `/dat-lam${query ? `?${query}` : ''}`,
    privacy: '/quyen-rieng-tu',
    mailto: `mailto:${brand.email}`,
  };
}

const THEME_KEY = (id: string) => `afyllx-digital-theme:${id}`;

export function useConceptTheme(meta: ConceptMeta): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      const v = localStorage.getItem(THEME_KEY(meta.id));
      if (v === 'light' || v === 'dark') return v;
    } catch {
      /* bỏ qua */
    }
    return meta.baseTheme;
  });
  const toggle = useCallback(() => {
    setTheme((t) => {
      const next = t === 'dark' ? 'light' : 'dark';
      try {
        localStorage.setItem(THEME_KEY(meta.id), next);
      } catch {
        /* bỏ qua */
      }
      return next;
    });
  }, [meta.id]);
  return [theme, toggle];
}

/** Đặt <title>, description, canonical, Open Graph, JSON-LD — nguyên văn trang gốc. */
function usePageMeta(kind: PageKind) {
  useEffect(() => {
    const m = kind === 'home' ? seo.home : kind === 'order' ? seo.order : seo.privacy;
    document.title = m.title;
    const set = (sel: string, make: () => HTMLElement, attr: string, value: string) => {
      let el = document.head.querySelector<HTMLElement>(sel);
      if (!el) {
        el = make();
        document.head.append(el);
      }
      el.setAttribute(attr, value);
    };
    const meta = (key: string, value: string, prop = false) =>
      set(`meta[${prop ? 'property' : 'name'}="${key}"]`, () => Object.assign(document.createElement('meta'), prop ? {} : { name: key }), 'content', value);
    meta('description', m.description);
    set('link[rel="canonical"]', () => Object.assign(document.createElement('link'), { rel: 'canonical' }), 'href', m.canonical);
    const ogs = document.head.querySelectorAll('meta[property^="og:"],meta[name^="twitter:"],script[data-afx-ld]');
    ogs.forEach((n) => n.remove());
    if (kind === 'home') {
      const og: [string, string][] = [
        ['og:type', 'website'],
        ['og:locale', 'vi_VN'],
        ['og:site_name', 'AFYLLX Digital'],
        ['og:url', seo.home.canonical],
        ['og:title', seo.home.og.title],
        ['og:description', seo.home.og.description],
      ];
      og.forEach(([k, v]) => {
        const el = document.createElement('meta');
        el.setAttribute('property', k);
        el.content = v;
        document.head.append(el);
      });
      const tw = document.createElement('meta');
      tw.name = 'twitter:card';
      tw.content = 'summary';
      document.head.append(tw);
      const ld = document.createElement('script');
      ld.type = 'application/ld+json';
      ld.dataset.afxLd = '';
      ld.textContent = JSON.stringify(seo.jsonLd);
      document.head.append(ld);
    }
  }, [kind]);
}

interface FrameProps {
  meta: ConceptMeta;
  kind: PageKind;
  theme: Theme;
  children: ReactNode;
}

/**
 * Khung bao mọi trang của một concept:
 * gốc [data-concept][data-theme], liên kết "Bỏ qua tới nội dung", SEO, Lenis+ScrollTrigger, cuộn tới #hash,
 * chặn liên kết "#..." trong trang để cuộn mượt, chuyển trang mặc định (mờ dần), hộp xem bản mẫu.
 */
export function ConceptFrame({ meta, kind, theme, children }: FrameProps) {
  const root = useRef<HTMLDivElement>(null);
  usePageMeta(kind);

  // Lenis cho cả concept; tắt khi rời.
  useLayoutEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const syncScroll = () => startSmoothScroll();
    syncScroll();
    preference.addEventListener('change', syncScroll);
    return () => {
      preference.removeEventListener('change', syncScroll);
      stopSmoothScroll();
      ScrollTrigger.getAll().forEach((t) => t.kill());
    };
  }, [meta.id, kind]);

  // Vào trang: lên đầu, hoặc tới #hash sau khi layout ổn định (font, pin spacer).
  useEffect(() => {
    const hash = location.hash.slice(1);
    if (!hash) {
      window.scrollTo(0, 0);
      return;
    }
    let cancelled = false;
    const go = () => {
      if (cancelled) return;
      ScrollTrigger.refresh();
      scrollToTarget(hash, { immediate: true });
    };
    const t = setTimeout(() => (document.fonts ? document.fonts.ready.then(go) : go()), 120);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [meta.id, kind]);

  // Liên kết '#id' trong trang và sự kiện afx:hash từ router → cuộn mượt.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
      const a = (e.target as HTMLElement).closest('a');
      const href = a?.getAttribute('href');
      if (!a || !href || !href.startsWith('#') || href.length < 2) return;
      const target = document.getElementById(href.slice(1));
      if (!target) return;
      e.preventDefault();
      history.pushState(null, '', href);
      scrollToTarget(target);
      if (href === '#noi-dung') target.focus({ preventScroll: true });
    };
    const onHash = (e: Event) => scrollToTarget((e as CustomEvent<string>).detail || 0);
    document.addEventListener('click', onClick);
    window.addEventListener('afx:hash', onHash);
    return () => {
      document.removeEventListener('click', onClick);
      window.removeEventListener('afx:hash', onHash);
    };
  }, []);

  // Chuyển trang mặc định — concept có thể ghi đè bằng setLeaveTransition trong trang của mình.
  useEffect(
    () =>
      setLeaveTransition(
        () =>
          new Promise<void>((resolve) => {
            if (!root.current) return resolve();
            gsap.to(root.current, { autoAlpha: 0, y: -12, duration: 0.35, ease: 'afx.in', onComplete: resolve });
          }),
      ),
    [kind],
  );

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.concept = meta.id;
    return () => {
      delete document.documentElement.dataset.concept;
    };
  }, [theme, meta.id]);

  const style = useMemo(() => ({}), []);
  return (
    <div className="afx-concept" data-concept={meta.id} data-theme={theme} data-page={kind} ref={root} style={style}>
      <a className="afx-skip" href="#noi-dung">
        {brand.skipLink}
      </a>
      <DemoPreviewProvider>{children}</DemoPreviewProvider>
    </div>
  );
}
