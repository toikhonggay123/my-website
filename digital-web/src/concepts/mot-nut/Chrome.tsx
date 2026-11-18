import { useEffect, useRef, useState } from 'react';
import { Menu, Moon, Sun, X } from 'lucide-react';
import { brand, nav } from '../../content/site';
import { Link } from '../../core/router';
import { FooterContent } from '../../core/content-kit';
import type { ConceptLinks, PageKind, Theme } from '../../core/types';
import { navMorph, useMotion } from '../../motion';

interface HeaderProps {
  links: ConceptLinks;
  theme: Theme;
  toggleTheme: () => void;
  /** Trang đặt làm: có nav, không có nút CTA (như trang gốc). */
  cta?: boolean;
}

/** Thanh trên cùng: logo, nav "Chính", nút chủ đề, CTA; menu thả xuống trên màn hẹp. */
export function Header({ links, theme, toggleTheme, cta = true }: HeaderProps) {
  const [open, setOpen] = useState(false);
  const bar = useRef<HTMLElement>(null);
  const menuBtn = useRef<HTMLButtonElement>(null);

  useMotion(bar, (_c, root) => {
    navMorph(root, { threshold: 16, range: 200 });
  });

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        menuBtn.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const close = () => setOpen(false);
  const dark = theme === 'dark';

  return (
    <header className="mn-head" ref={bar} data-open={open || undefined}>
      <div className="mn-head-in">
        <Link className="mn-brand" href={links.home} aria-label={brand.homeAria}>
          <img src={brand.logo} alt={brand.logoAlt} width={36} height={36} />
          <span>{brand.name}</span>
        </Link>
        <nav className="mn-nav" id="mn-menu" aria-label={nav.label} data-open={open || undefined}>
          <ul>
            {nav.items.map((item) => (
              <li key={item.hash}>
                <a href={links.section(item.hash)} onClick={close}>
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
          {cta ? (
            <Link className="mn-btn mn-nav-cta" href={links.order()} onClick={close}>
              {nav.cta}
            </Link>
          ) : null}
        </nav>
        <div className="mn-head-tools">
          <button
            type="button"
            className="mn-icon-btn"
            aria-label={nav.themeDark}
            aria-pressed={dark}
            title={dark ? nav.themeToLight : nav.themeToDark}
            onClick={toggleTheme}
          >
            {dark ? <Sun size={18} strokeWidth={1.5} aria-hidden="true" /> : <Moon size={18} strokeWidth={1.5} aria-hidden="true" />}
          </button>
          {cta ? (
            <Link className="mn-btn is-small mn-head-cta" href={links.order()}>
              {nav.cta}
            </Link>
          ) : null}
          <button
            type="button"
            className="mn-icon-btn mn-menu-btn"
            ref={menuBtn}
            aria-expanded={open}
            aria-controls="mn-menu"
            aria-label={open ? nav.menuClose : nav.menuOpen}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X size={18} strokeWidth={1.5} aria-hidden="true" /> : <Menu size={18} strokeWidth={1.5} aria-hidden="true" />}
          </button>
        </div>
      </div>
    </header>
  );
}

export function Footer({ links, page }: { links: ConceptLinks; page: PageKind }) {
  return (
    <footer className="mn-foot">
      <div className="mn-wrap mn-foot-in">
        <FooterContent page={page} links={links} />
      </div>
    </footer>
  );
}
