import { useRef } from 'react';
import { orderPage } from '../../content/site';
import type { PageProps } from '../../core/types';
import { OrderWizard } from '../../core/OrderWizard';
import { PrivacyArticle } from '../../core/content-kit';
import { useMotion, kineticText, cascade, gsap, prefersReduced } from '../../motion';
import { Header, Footer } from './Chrome';

const pad = (n: number) => String(n).padStart(2, '0');

export function Order({ links, theme, toggleTheme }: PageProps) {
  const scope = useRef<HTMLDivElement>(null);
  useMotion(scope, () => {
    kineticText('.mn-order-head h1', { by: 'lines', scroll: false, delay: 0.1 });
    cascade(['.mn-order-head p', '.ow-rail', '.ow'], { y: 16, stagger: 0.08, start: 'top 95%' });
  });
  const onStep = (_step: number, section: HTMLElement) => {
    if (prefersReduced()) return;
    gsap.fromTo(section, { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 0.4, ease: 'afx.out', clearProps: 'transform,opacity,visibility' });
  };
  return (
    <div className="mn-page" ref={scope}>
      <Header links={links} theme={theme} toggleTheme={toggleTheme} cta={false} />
      <main id="noi-dung" tabIndex={-1} className="mn-main mn-order">
        <div className="mn-wrap">
          <div className="mn-order-head">
            <h1>{orderPage.title}</h1>
            <p>{orderPage.lead}</p>
          </div>
          <OrderWizard homeHref={links.home} samplesHref={links.section('ban-mau')} privacyHref={links.privacy} onStep={onStep} />
        </div>
      </main>
      <Footer links={links} page="order" />
    </div>
  );
}

export function Privacy({ links, theme, toggleTheme }: PageProps) {
  const scope = useRef<HTMLDivElement>(null);
  useMotion(scope, () => {
    kineticText('.pv h1', { by: 'lines', scroll: false, delay: 0.1 });
    cascade(['.pv-date', '.pv-box'], { y: 12, start: 'top 95%' });
    gsap.utils.toArray<HTMLElement>('.pv-section').forEach((sec) => cascade(sec, { trigger: sec, y: 16 }));
  });
  return (
    <div className="mn-page" ref={scope}>
      <Header links={links} theme={theme} toggleTheme={toggleTheme} />
      <main id="noi-dung" tabIndex={-1} className="mn-main mn-privacy">
        <div className="mn-wrap">
          <PrivacyArticle
            links={links}
            renderSection={(i, title, body) => (
              <section className="pv-section">
                <span className="pv-no" aria-hidden="true">
                  {pad(i + 1)}
                </span>
                <div className="pv-body">
                  {title}
                  {body}
                </div>
              </section>
            )}
          />
        </div>
      </main>
      <Footer links={links} page="privacy" />
    </div>
  );
}
