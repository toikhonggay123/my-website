import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import './shell.css';

interface ShellProps {
  /** Slug của mẫu, ví dụ "cua-hang". Dùng cho liên kết đặt làm. */
  slug: string;
  /** Tiêu đề tab trình duyệt, ví dụ "Gốm Mộc Lam". */
  title: string;
  children: ReactNode;
}

/**
 * Khung chung của mọi bản mẫu: đặt tiêu đề tab, gắn noindex, và hiện thanh "Bản mẫu" cố định ở đáy màn hình.
 * Thanh cao var(--demo-bar-h). Phần tử cố định ở đáy của riêng mẫu phải đặt bottom: var(--demo-bar-h).
 */
export function TemplateShell({ slug, title, children }: ShellProps) {
  useEffect(() => {
    const previous = document.title;
    document.title = `${title} — Bản mẫu AFYLLX Digital`;
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.append(meta);
    return () => {
      document.title = previous;
      meta.remove();
    };
  }, [title]);

  return (
    <div className="demo-shell">
      {children}
      <aside className="demo-bar" aria-label="Thông tin bản mẫu">
        <p>
          <strong>Bản mẫu AFYLLX Digital</strong>
          <span> — dữ liệu minh họa</span>
        </p>
        <a href={`/dat-lam?mau=${slug}`}>Đặt website như thế này</a>
      </aside>
    </div>
  );
}

const DEFAULT_NOTICE = 'Đây là bản mẫu, không có đơn nào được tạo.';

/**
 * Thông báo dùng khi khách bấm "Đặt hàng", "Đặt lịch", "Gửi" trong bản mẫu.
 * Không gửi dữ liệu đi đâu. Đặt {notice} một lần trong cây giao diện, gọi notify() khi cần.
 */
export function useDemoNotice() {
  const [message, setMessage] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);

  const notify = useCallback((text: string = DEFAULT_NOTICE) => {
    returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setMessage(text);
  }, []);

  const close = useCallback(() => {
    setMessage(null);
    returnFocus.current?.focus();
  }, []);

  useEffect(() => {
    if (message === null) return;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [message, close]);

  const notice =
    message === null ? null : (
      <div className="demo-notice" role="alertdialog" aria-modal="true" aria-labelledby="demo-notice-title" aria-describedby="demo-notice-text">
        <div className="demo-notice__backdrop" onClick={close} />
        <div className="demo-notice__card">
          <h2 id="demo-notice-title">Bản mẫu AFYLLX Digital</h2>
          <p id="demo-notice-text">{message}</p>
          <button ref={closeRef} type="button" onClick={close}>
            Đã hiểu
          </button>
        </div>
      </div>
    );

  return { notify, notice };
}
