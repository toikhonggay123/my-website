import { Fragment, type ReactNode } from 'react';
import { privacyPage, brand, finale, footer, type Rich } from '../content/site';
import type { ConceptLinks } from './types';
import { Link } from './router';

/**
 * Bộ dựng nội dung dùng chung: giữ nguyên câu chữ và liên kết, concept chỉ lo bố cục & kiểu.
 */

/** Dựng một đoạn Rich[] (chuỗi + liên kết). '@order' trỏ tới trang đặt làm của concept. */
export function RichText({ parts, links }: { parts: Rich[]; links: ConceptLinks }) {
  return (
    <>
      {parts.map((part, i) => {
        if (typeof part === 'string') return <Fragment key={i}>{part}</Fragment>;
        if (part.strong) return <strong key={i}>{part.text}</strong>;
        if (part.href === '@order')
          return (
            <Link key={i} href={links.order()}>
              {part.text}
            </Link>
          );
        return (
          <a key={i} href={part.href}>
            {part.text}
          </a>
        );
      })}
    </>
  );
}

/**
 * Bài "Chính sách quyền riêng tư" đầy đủ, nguyên văn. Class: .pv (article) .pv-date .pv-box .pv-section h2 p ul.
 * `renderSection` cho phép concept bọc từng mục (vd đánh số, chia cột) mà không chạm câu chữ.
 */
export function PrivacyArticle({
  links,
  className = 'pv',
  renderSection,
  headingLevel = 1,
}: {
  links: ConceptLinks;
  className?: string;
  renderSection?: (index: number, title: ReactNode, body: ReactNode) => ReactNode;
  headingLevel?: 1 | 2;
}) {
  const H = headingLevel === 1 ? 'h1' : 'h2';
  return (
    <article className={className}>
      <H>{privacyPage.title}</H>
      <p className="pv-date">{privacyPage.date}</p>
      <div className="pv-box">
        <p>
          <RichText parts={privacyPage.summary} links={links} />
        </p>
      </div>
      {privacyPage.sections.map((sec, i) => {
        const body = sec.blocks.map((b, j) =>
          'p' in b ? (
            <p key={j}>
              <RichText parts={b.p} links={links} />
            </p>
          ) : (
            <ul key={j}>
              {b.ul.map((li) => (
                <li key={li}>{li}</li>
              ))}
            </ul>
          ),
        );
        if (renderSection) return <Fragment key={sec.title}>{renderSection(i, <h2>{sec.title}</h2>, body)}</Fragment>;
        return (
          <section className="pv-section" key={sec.title}>
            <h2>{sec.title}</h2>
            {body}
          </section>
        );
      })}
    </article>
  );
}

/** Đoạn văn cuối trang chủ có email (nguyên văn). */
export function FinaleText() {
  return (
    <>
      {finale.textBefore}
      <a href={`mailto:${brand.email}`}>{brand.email}</a>
      {finale.textAfter}
    </>
  );
}

/**
 * Chân trang nguyên văn theo từng trang. Class: .ft-copy .ft-nav (concept bọc bằng <footer> của mình).
 */
export function FooterContent({ page, links, hashBase = '#' }: { page: 'home' | 'order' | 'privacy'; links: ConceptLinks; hashBase?: string }) {
  const items = footer[page];
  return (
    <>
      <span className="ft-copy">
        {footer.copyright}
        <a href={brand.parent.href}>{footer.parentLink}</a>
      </span>
      <nav className="ft-nav" aria-label={footer.navLabel}>
        {items.map((it) => {
          if ('mailto' in it) return <a key={it.label} href={links.mailto}>{it.label}</a>;
          if ('hash' in it) return <a key={it.label} href={hashBase === '#' ? `#${it.hash}` : links.section(it.hash)}>{it.label}</a>;
          const href = it.page === 'home' ? links.home : it.page === 'order' ? links.order() : links.privacy;
          return (
            <Link key={it.label} href={href}>
              {it.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
