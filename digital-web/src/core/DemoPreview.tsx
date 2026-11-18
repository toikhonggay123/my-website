import { createContext, useCallback, useContext, useEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { samples } from '../content/site';
import { lockScroll } from '../motion';

/**
 * Hộp xem bản mẫu (dialog + iframe) — như trang gốc: bấm thẻ mở bản mẫu trong khung; Ctrl/⌘/Shift-click mở thẳng trang.
 * Concept dùng:  const openDemo = useDemoPreview();  <a href={route} onClick={openDemo(route, title)}>…</a>
 * Kiểu: .afx-demo (dialog) .afx-demo-bar h2 .afx-demo-close .afx-demo-frame iframe — style trong phạm vi concept.
 */
type Opener = (route: string, title: string) => (e: MouseEvent<HTMLElement>) => void;
const Ctx = createContext<Opener>(() => () => {});

export const useDemoPreview = () => useContext(Ctx);

export function DemoPreviewProvider({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [demo, setDemo] = useState<{ route: string; title: string } | null>(null);

  const open = useCallback<Opener>(
    (route, title) => (e) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey) return;
      e.preventDefault();
      setDemo({ route, title });
    },
    [],
  );

  useEffect(() => {
    const dlg = ref.current;
    if (!dlg || !demo) return;
    if (!dlg.open) dlg.showModal();
    lockScroll(true);
    return () => lockScroll(false);
  }, [demo]);

  return (
    <Ctx.Provider value={open}>
      {children}
      <dialog
        className="afx-demo"
        id="demo-preview"
        aria-labelledby="demo-preview-title"
        ref={ref}
        onClose={() => setDemo(null)}
        data-lenis-prevent
      >
        <div className="afx-demo-bar">
          <h2 id="demo-preview-title">{demo?.title ?? samples.dialog.defaultTitle}</h2>
          <form method="dialog">
            <button className="afx-demo-close" type="submit" autoFocus>
              {samples.dialog.close}
            </button>
          </form>
        </div>
        <div className="afx-demo-frame" id="demo-preview-content">
          {demo ? <iframe title={samples.dialog.iframePrefix + demo.title} src={demo.route} /> : null}
        </div>
      </dialog>
    </Ctx.Provider>
  );
}
