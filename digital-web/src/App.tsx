import { Suspense, lazy, useMemo } from 'react';
import { findTemplate, templates } from './templates/registry';
import { useLocation } from './core/router';

const Portal = lazy(() => import('./Portal'));
const MotionLab = lazy(() => import('./prototype/MotionLab'));

/** Trang chính, bản mẫu và phòng thử nghiệm motion. */
export function App() {
  const { path } = useLocation();
  const kind = path === '/' ? 'home' : path === '/dat-lam' ? 'order' : path === '/quyen-rieng-tu' ? 'privacy' : null;
  const slug = path.startsWith('/mau/') ? path.slice('/mau/'.length) : null;
  const entry = slug ? findTemplate(slug) : undefined;
  const Template = useMemo(() => (entry ? lazy(entry.load) : null), [entry]);

  if (kind) {
    return (
      <Suspense fallback={<div className="afx-loading" aria-busy="true" />}>
        <Portal kind={kind} />
      </Suspense>
    );
  }
  if (path === '/prototype/motion') {
    return (
      <Suspense fallback={<p style={{ padding: 24 }}>Đang tải thử nghiệm motion 3D…</p>}>
        <MotionLab />
      </Suspense>
    );
  }

  if (Template) {
    return (
      <Suspense fallback={<p style={{ padding: 24 }}>Đang tải bản mẫu…</p>}>
        <Template />
      </Suspense>
    );
  }

  return (
    <main style={{ font: "400 18px/1.6 'Be Vietnam Pro', system-ui, sans-serif", maxWidth: 720, margin: '0 auto', padding: 32 }}>
      <h1>AFYLLX Digital</h1>
      {path === '/mau' ? <p>Các bản mẫu website</p> : <p>Trang {path} chưa được xây.</p>}
      <ul>
        <li>
          <a href="/prototype/motion">Thử nghiệm các nhóm hiệu ứng Motion &amp; Khối 3D</a> — 4 nhóm hiệu ứng CSS-3D &amp; WebGL2
        </li>
        {templates.map((t) => (
          <li key={t.slug}>
            <a href={`/mau/${t.slug}`}>{t.business}</a> — {t.summary}
          </li>
        ))}
      </ul>
    </main>
  );
}
