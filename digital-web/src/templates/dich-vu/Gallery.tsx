import { useEffect, useRef, useState } from 'react';
import { categoryLabel, projects, type CategoryId, type Project } from './data';
import { Scene } from './illustrations';

type Filter = 'all' | CategoryId;

const filters: ReadonlyArray<{ id: Filter; label: string }> = [
  { id: 'all', label: 'Tất cả' },
  ...(Object.keys(categoryLabel) as CategoryId[]).map((id) => ({ id, label: categoryLabel[id] })),
];

interface GalleryProps {
  /** Khách bấm "Hỏi về hạng mục này" trong khung chi tiết. */
  onAsk: (project: Project) => void;
}

export function Gallery({ onAsk }: GalleryProps) {
  const [filter, setFilter] = useState<Filter>('all');
  const [openId, setOpenId] = useState<string | null>(null);
  const visible = filter === 'all' ? projects : projects.filter((p) => p.category === filter);
  const open = projects.find((p) => p.id === openId) ?? null;

  return (
    <>
      <div className="filters" role="group" aria-label="Lọc theo hạng mục">
        {filters.map((f) => (
          <button key={f.id} type="button" className="chip" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>
            {f.label}
          </button>
        ))}
      </div>
      <p className="sr-only" role="status">
        Đang hiện {visible.length} hạng mục minh họa.
      </p>
      <ul className="tiles">
        {visible.map((p) => (
          <li key={p.id} className="tile-item">
            <button type="button" className="tile" onClick={() => setOpenId(p.id)} aria-haspopup="dialog">
              <span className="tile-art">
                <Scene kind={p.scene} tone={p.tone} />
                <span className="tile-tag">Hình minh họa</span>
                <span className="tile-reveal" aria-hidden="true">
                  <span>{p.dimensions}</span>
                  <span className="tile-more">
                    Xem chi tiết
                    <Arrow />
                  </span>
                </span>
              </span>
              <span className="tile-meta">
                <span className="tile-cat">{categoryLabel[p.category]}</span>
                <span className="tile-title">{p.title}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      {open && (
        <ProjectDialog
          project={open}
          onClose={() => setOpenId(null)}
          onAsk={() => {
            setOpenId(null);
            onAsk(open);
          }}
        />
      )}
    </>
  );
}

function Arrow() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
      <path d="M5 12h13M13 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

interface DialogProps {
  project: Project;
  onClose: () => void;
  onAsk: () => void;
}

function ProjectDialog({ project, onClose, onAsk }: DialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab' || !panelRef.current) return;
      const items = panelRef.current.querySelectorAll<HTMLElement>('button, a[href]');
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !panelRef.current.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !panelRef.current.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
      if (opener && opener.isConnected) opener.focus();
    };
  }, []);

  return (
    <div className="modal">
      <div className="modal-backdrop" onClick={onClose} />
      <div ref={panelRef} className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="dv-modal-title">
        <div className="modal-art">
          <Scene kind={project.scene} tone={project.tone} label={`Hình minh họa: ${project.title}`} />
          <span className="tile-tag">Hình minh họa</span>
        </div>
        <div className="modal-body">
          <p className="eyebrow">{categoryLabel[project.category]}</p>
          <h3 id="dv-modal-title" className="modal-title">
            {project.title}
          </h3>
          <p className="modal-note">{project.note}</p>
          <dl className="specs">
            <div>
              <dt>Không gian</dt>
              <dd>{project.room}</dd>
            </div>
            <div>
              <dt>Vật liệu</dt>
              <dd>{project.materials}</dd>
            </div>
            <div>
              <dt>Kích thước</dt>
              <dd>{project.dimensions}</dd>
            </div>
            <div>
              <dt>Phụ kiện</dt>
              <dd>{project.hardware}</dd>
            </div>
          </dl>
          <p className="modal-disclaimer">Hạng mục dựng để minh họa cho bản mẫu. Đây không phải công trình của khách hàng thật.</p>
          <div className="modal-actions">
            <button type="button" className="btn btn-primary" onClick={onAsk}>
              Hỏi về hạng mục này
            </button>
            <button type="button" className="btn btn-quiet" onClick={onClose}>
              Đóng
            </button>
          </div>
        </div>
        <button ref={closeRef} type="button" className="modal-close" onClick={onClose} aria-label="Đóng chi tiết hạng mục">
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">
            <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}
