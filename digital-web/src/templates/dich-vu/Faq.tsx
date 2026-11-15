import { useState } from 'react';
import { faqs } from './data';

export function Faq() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="faq">
      {faqs.map((item, index) => {
        const isOpen = open === index;
        return (
          <div key={item.q} className={isOpen ? 'faq-item is-open' : 'faq-item'}>
            <h3 className="faq-q">
              <button
                type="button"
                id={`dv-faq-q-${index}`}
                aria-expanded={isOpen}
                aria-controls={`dv-faq-a-${index}`}
                onClick={() => setOpen(isOpen ? null : index)}
              >
                <span>{item.q}</span>
                <svg className="faq-icon" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">
                  <path className="faq-icon-h" d="M5 12h14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  <path className="faq-icon-v" d="M12 5v14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </button>
            </h3>
            <div id={`dv-faq-a-${index}`} className="faq-a" role="region" aria-labelledby={`dv-faq-q-${index}`}>
              <div className="faq-a-inner">
                <p>{item.a}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
