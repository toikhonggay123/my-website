import { Suspense, lazy, useMemo } from 'react';
import { findTemplate, templates } from './templates/registry';

const MotionLab = lazy(() => import('./prototype/MotionLab'));

/** Khung tạm để chạy các bản mẫu. Trang portal thật sẽ thay phần này. */
export function App() {
  const path = window.location.pathname.replace(/\/+$/, '') || '/';
  if (path === '/prototype/motion') {
    return (
      <Suspense fallback={<p style={{ padding: 24 }}>Đang tải thử nghiệm motion 3D…</p>}>
        <MotionLab />
      </Suspense>
    );
  }

  const slug = path.startsWith('/mau/') ? path.slice('/mau/'.length) : null;
  const entry = slug ? findTemplate(slug) : undefined;
  const Template = useMemo(() => (entry ? lazy(entry.load) : null), [entry]);

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
      {path === '/' || path === '/mau' ? <p>Khung tạm trong lúc xây portal. Các bản mẫu:</p> : <p>Trang {path} chưa được xây.</p>}
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
