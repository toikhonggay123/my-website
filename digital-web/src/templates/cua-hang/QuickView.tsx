import { useState } from 'react';
import { ProductArt } from './art';
import { categoryLabel, formatVnd, glazes, type Product } from './data';
import { CheckIcon, CloseIcon } from './icons';
import { Stepper } from './Stepper';
import { useDialog } from './useDialog';

interface QuickViewProps {
  product: Product;
  inCart: number;
  onAdd: (id: string, qty: number) => void;
  onOpenCart: () => void;
  onClose: () => void;
}

export function QuickView({ product, inCart, onAdd, onOpenCart, onClose }: QuickViewProps) {
  const ref = useDialog<HTMLDivElement>(onClose);
  const [qty, setQty] = useState(1);
  const glaze = glazes[product.glaze];

  return (
    <div className="ml-overlay ml-overlay--modal">
      <div className="ml-overlay__backdrop" onClick={onClose} />
      <div className="ml-quick" role="dialog" aria-modal="true" aria-labelledby="ml-quick-title" tabIndex={-1} ref={ref}>
        <button type="button" className="ml-iconbtn ml-quick__close" onClick={onClose} aria-label="Đóng xem nhanh">
          <CloseIcon />
        </button>
        <div className="ml-quick__art" style={{ background: glaze.tile }}>
          <ProductArt shape={product.shape} glaze={product.glaze} dip={product.dip} seed={product.seed} />
        </div>
        <div className="ml-quick__info">
          <p className="ml-eyebrow">
            {categoryLabel(product.category)} · {glaze.label}
          </p>
          <h2 id="ml-quick-title" className="ml-quick__title">
            {product.name}
          </h2>
          <p className="ml-quick__price">{formatVnd(product.price)}</p>
          <p className="ml-quick__text">{product.long}</p>
          <dl className="ml-specs">
            {product.specs.map(([label, value]) => (
              <div key={label} className="ml-specs__row">
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          <div className="ml-quick__buy">
            <Stepper value={qty} name={product.name} onChange={setQty} />
            <button type="button" className="ml-btn ml-btn--primary ml-quick__add" onClick={() => onAdd(product.id, qty)} data-autofocus>
              Thêm vào giỏ · {formatVnd(product.price * qty)}
            </button>
          </div>
          <p className="ml-quick__status" aria-live="polite">
            {inCart > 0 ? (
              <>
                <CheckIcon size={16} /> Đang có {inCart} chiếc trong giỏ.{' '}
                <button type="button" className="ml-link" onClick={onOpenCart}>
                  Xem giỏ hàng
                </button>
              </>
            ) : (
              'Làm tay nên mỗi chiếc lệch nhau đôi chút về màu men và kích thước.'
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
