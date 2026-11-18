import type { CSSProperties } from 'react';
import { Link } from '../../core/router';

/**
 * Chiếc nút bằng kính dày — vật thể duy nhất của concept.
 * Dựng bằng CSS 3D: bốn tầng (đế vận hành / cơ cấu chức năng / thân nội dung / nắp kính giao diện),
 * mỗi tầng là một chồng lát mỏng xếp theo trục z để có độ dày thật.
 * `explode` = số lớp (0..3) đang được xem: các tầng tách ra, tầng đó sáng rõ.
 */
const STRATA = [
  { layer: 0, name: 'base', slices: 8, z0: 0 },
  { layer: 1, name: 'mech', slices: 4, z0: 16 },
  { layer: 2, name: 'content', slices: 4, z0: 24 },
  { layer: 3, name: 'cap', slices: 7, z0: 32 },
] as const;

const v = (o: Record<string, string | number>) => o as CSSProperties;

function Face({ name, label }: { name: (typeof STRATA)[number]['name']; label: string }) {
  if (name === 'cap')
    return (
      <>
        <span className="mn-cap-sheen" aria-hidden="true" />
        <span className="mn-cap-label">{label}</span>
      </>
    );
  if (name === 'content')
    return (
      <span className="mn-ct" aria-hidden="true">
        <i className="mn-ct-img" />
        <i className="mn-ct-row" />
        <i className="mn-ct-row is-short" />
        <i className="mn-ct-grid">
          <b />
          <b />
          <b />
        </i>
      </span>
    );
  if (name === 'mech')
    return (
      <svg className="mn-mech" viewBox="0 0 400 100" preserveAspectRatio="none" aria-hidden="true">
        <path d="M70 18 L330 82 M70 82 L330 18" />
        <path d="M40 50 H140 M260 50 H360" className="is-rail" />
        <ellipse cx="200" cy="50" rx="34" ry="24" className="is-dome" />
        <ellipse cx="200" cy="50" rx="16" ry="11" className="is-dot" />
      </svg>
    );
  return (
    <span className="mn-bs" aria-hidden="true">
      <i />
      <i />
      <i />
      <i />
      <b />
    </span>
  );
}

export function Pill({ href, label, explode = null, className = '' }: { href: string; label: string; explode?: number | null; className?: string }) {
  return (
    <Link href={href} className={'mn-pill ' + className}>
      <span className="mn-scene">
        <span className="mn-key" data-explode={explode ?? undefined}>
          <span className="mn-shadow" aria-hidden="true" />
          <span className="mn-shadow is-tight" aria-hidden="true" />
          {STRATA.map((s) => (
            <span key={s.name} className={`mn-stratum mn-s-${s.name}`} data-layer={s.layer} style={v({ '--z0': s.z0, '--k': s.layer })}>
              <span className="mn-stratum-in">
                {Array.from({ length: s.slices - 1 }, (_, i) => (
                  <span key={i} className="mn-slice" style={v({ '--i': i })} aria-hidden="true" />
                ))}
                <span className="mn-face" style={v({ '--i': s.slices - 1 })}>
                  <Face name={s.name} label={label} />
                </span>
              </span>
            </span>
          ))}
        </span>
      </span>
    </Link>
  );
}
