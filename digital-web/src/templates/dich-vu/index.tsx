import { useCallback, useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { TemplateShell, useDemoNotice } from '../shared/TemplateShell';
import { ConsultForm } from './ConsultForm';
import { Configurator } from './Configurator';
import { Faq } from './Faq';
import { Gallery } from './Gallery';
import { emptyForm, materials, navLinks, services, steps, type CategoryId, type FormValues, type Project } from './data';
import { HeroScene, Mark, Scene } from './illustrations';
import './styles.css';

interface SectionHeadProps {
  label: string;
  title: string;
  id: string;
  children?: ReactNode;
}

/** Cột nhãn hẹp bên trái của mỗi phần. */
function SectionHead({ label, title, id, children }: SectionHeadProps) {
  return (
    <header className="sec-head">
      <p className="eyebrow">{label}</p>
      <h2 id={id}>{title}</h2>
      {children}
    </header>
  );
}

export default function DichVuTemplate() {
  const { notify, notice } = useDemoNotice();
  const [menuOpen, setMenuOpen] = useState(false);
  const [form, setForm] = useState<FormValues>(emptyForm);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  /** Cuộn tới biểu mẫu sau khi khung chi tiết (nếu có) đã đóng và trả lại tiêu điểm. */
  const goToForm = useCallback(() => {
    window.setTimeout(() => {
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      document.getElementById('lien-he')?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
      document.getElementById('dv-name')?.focus({ preventScroll: true });
    }, 60);
  }, []);

  const askAbout = (project: Project) => {
    setForm((f) => ({
      ...f,
      category: project.category,
      message: f.message.trim() === '' ? `Tôi quan tâm hạng mục giống mẫu "${project.title}" (${project.dimensions}).` : f.message,
    }));
    goToForm();
  };

  const applySummary = (summary: string, category: CategoryId) => {
    setForm((f) => ({ ...f, category, message: summary }));
    goToForm();
  };

  return (
    <TemplateShell slug="dich-vu" title="Nhà Én">
      <div className="tpl-dich-vu">
        <a className="skip" href="#noi-dung">
          Bỏ qua, tới nội dung chính
        </a>

        <header className="top">
          <div className="grid top-row">
            <a className="brand" href="#dau-trang" aria-label="Nhà Én, về đầu trang">
              <Mark className="brand-mark" />
              <span className="brand-name">Nhà Én</span>
              <span className="brand-sub">Xưởng nội thất</span>
            </a>
            <nav className="nav" aria-label="Điều hướng chính">
              <ul>
                {navLinks.map((link) => (
                  <li key={link.href}>
                    <a href={link.href}>{link.label}</a>
                  </li>
                ))}
              </ul>
            </nav>
            <div className="top-actions">
              <a className="btn btn-outline btn-small" href="#lien-he">
                Nhận tư vấn
              </a>
              <button
                type="button"
                className="menu-btn"
                aria-expanded={menuOpen}
                aria-controls="dv-mobile-nav"
                aria-label={menuOpen ? 'Đóng menu' : 'Mở menu'}
                onClick={() => setMenuOpen((v) => !v)}
              >
                <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false">
                  {menuOpen ? (
                    <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  ) : (
                    <path d="M4 8h16M4 16h16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  )}
                </svg>
              </button>
            </div>
          </div>
          <nav id="dv-mobile-nav" className="mobile-nav" aria-label="Điều hướng trên di động" hidden={!menuOpen}>
            <ul>
              {navLinks.map((link) => (
                <li key={link.href}>
                  <a href={link.href} onClick={() => setMenuOpen(false)}>
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </header>

        <main id="noi-dung">
          <section className="hero" id="dau-trang" aria-labelledby="dv-hero-title">
            <div className="grid hero-grid">
              <div className="hero-copy">
                <p className="eyebrow">Nội thất đóng theo yêu cầu</p>
                <h1 id="dv-hero-title">
                  Đóng vừa khít <span>căn nhà của bạn.</span>
                </h1>
                <p className="hero-lead">Xưởng đo từng mảng tường, vẽ từng khoang tủ rồi mới cắt ván. Không có món nào lấy từ kho ra.</p>
                <div className="hero-cta">
                  <a className="btn btn-primary" href="#lien-he">
                    Nhận tư vấn
                  </a>
                  <a className="link-arrow" href="#hang-muc">
                    Xem hạng mục mẫu
                    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
                      <path d="M5 12h13M13 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </a>
                </div>
                <ul className="hero-facts">
                  <li>Đo tại nhà</li>
                  <li>Duyệt bản vẽ trước khi đóng</li>
                  <li>Xưởng tự lắp đặt</li>
                </ul>
              </div>
            </div>
            <div className="hero-art">
              <HeroScene />
              <p className="hero-caption">Hình minh họa · tủ âm tường gỗ sồi 3,6 × 2,6 m</p>
            </div>
          </section>

          <section className="band band-white" id="dich-vu" aria-labelledby="dv-services-title">
            <div className="grid">
              <SectionHead label="Dịch vụ" title="Năm hạng mục xưởng nhận đóng" id="dv-services-title">
                <p>Mỗi hạng mục gồm khảo sát, bản vẽ, đóng và lắp. Bạn làm việc với một đầu mối từ đầu tới cuối.</p>
              </SectionHead>
              <ul className="sec-body services">
                {services.map((s) => (
                  <li key={s.id} className="service">
                    <h3>{s.name}</h3>
                    <div className="service-text">
                      <p>{s.intro}</p>
                      <ul>
                        {s.includes.map((line) => (
                          <li key={line}>{line}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="service-art">
                      <Scene kind={s.scene} tone={s.tone} />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <section className="band" id="hang-muc" aria-labelledby="dv-gallery-title">
            <div className="grid">
              <SectionHead label="Hạng mục mẫu" title="Hạng mục đã làm mẫu" id="dv-gallery-title">
                <p>Sáu hạng mục dựng bằng hình minh họa, kèm vật liệu và kích thước giả định. Chạm vào một ô để xem chi tiết.</p>
              </SectionHead>
              <div className="sec-body">
                <Gallery onAsk={askAbout} />
              </div>
            </div>
          </section>

          <section className="band band-dark process" id="quy-trinh" aria-labelledby="dv-process-title">
            <div className="grid">
              <SectionHead label="Quy trình" title="Năm bước, theo đúng thứ tự" id="dv-process-title">
                <p>Xưởng không cắt ván khi bản vẽ và báo giá chưa được bạn duyệt.</p>
              </SectionHead>
              <ol className="steps">
                {steps.map((step, index) => (
                  <li key={step.title} className="step">
                    <span className="step-no" aria-hidden="true">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <h3>{step.title}</h3>
                    <p>{step.text}</p>
                    <p className="step-time">{step.duration}</p>
                  </li>
                ))}
              </ol>
            </div>
          </section>

          <section className="band band-white" id="vat-lieu" aria-labelledby="dv-materials-title">
            <div className="grid">
              <SectionHead label="Vật liệu" title="Sáu vật liệu dùng nhiều nhất" id="dv-materials-title">
                <p>Mẫu thật có sẵn tại xưởng để bạn sờ và so màu dưới ánh sáng nhà mình.</p>
              </SectionHead>
              <ul className="sec-body materials">
                {materials.map((m) => (
                  <li key={m.name} className="material">
                    <span
                      className={`swatch swatch-${m.grain}`}
                      style={{ '--sw-base': m.base, '--sw-line': m.line } as CSSProperties}
                      aria-hidden="true"
                    />
                    <p className="material-kind">{m.kind}</p>
                    <h3>{m.name}</h3>
                    <p>{m.use}</p>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <section className="band" id="uoc-luong" aria-labelledby="dv-config-title">
            <div className="grid">
              <SectionHead label="Ước lượng nhu cầu" title="Thử mô tả thứ bạn cần" id="dv-config-title">
                <p>Chọn ba mục. Bạn nhận lại một câu tóm tắt để gửi cho xưởng.</p>
              </SectionHead>
              <div className="sec-body">
                <Configurator onUse={applySummary} />
              </div>
            </div>
          </section>

          <section className="band band-white" id="hoi-dap" aria-labelledby="dv-faq-title">
            <div className="grid">
              <SectionHead label="Hỏi đáp" title="Những điều khách hay hỏi" id="dv-faq-title" />
              <div className="sec-body">
                <Faq />
              </div>
            </div>
          </section>

          <section className="band band-dark contact" id="lien-he" aria-labelledby="dv-contact-title">
            <div className="grid">
              <SectionHead label="Nhận tư vấn" title="Kể cho xưởng nghe về căn phòng" id="dv-contact-title">
                <p>Điền bốn ô dưới đây. Trên website thật, xưởng sẽ gọi lại để hẹn buổi khảo sát.</p>
              </SectionHead>
              <div className="sec-body">
                <ConsultForm values={form} onChange={setForm} onValidSubmit={() => notify('Đây là bản mẫu, không có yêu cầu nào được gửi.')} />
              </div>
            </div>
          </section>
        </main>

        <footer className="foot">
          <div className="grid">
            <div className="foot-brand">
              <p className="foot-name">
                <Mark className="brand-mark" />
                Nhà Én
              </p>
              <p>Xưởng Nhà Én (doanh nghiệp minh họa). Mọi hạng mục, vật liệu và kích thước trên trang là dữ liệu mẫu.</p>
            </div>
            <div className="foot-col">
              <h2>Liên hệ</h2>
              <ul>
                <li>Địa chỉ xưởng: (chưa có, bản mẫu)</li>
                <li>Điện thoại: 0000 000 000</li>
                <li>Email: xin-chao@nha-en.example</li>
              </ul>
            </div>
            <div className="foot-col">
              <h2>Giờ làm việc</h2>
              <ul>
                <li>Thứ Hai đến thứ Bảy</li>
                <li>8 giờ đến 17 giờ 30</li>
                <li>Khảo sát theo lịch hẹn</li>
              </ul>
            </div>
            <div className="foot-col">
              <h2>Trên trang này</h2>
              <ul>
                {navLinks.map((link) => (
                  <li key={link.href}>
                    <a href={link.href}>{link.label}</a>
                  </li>
                ))}
              </ul>
            </div>
            <p className="foot-legal">Bản mẫu của AFYLLX Digital. Nhà Én không phải doanh nghiệp có thật.</p>
          </div>
        </footer>

      </div>
      {notice}
    </TemplateShell>
  );
}
