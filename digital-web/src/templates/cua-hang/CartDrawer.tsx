import { useRef, useState, type FormEvent } from 'react';
import { ProductArt } from './art';
import { formatVnd, glazes, productById, type CartLine, type Product } from './data';
import { ArrowIcon, BackIcon, CloseIcon, TrashIcon } from './icons';
import { Stepper } from './Stepper';
import { useDialog } from './useDialog';

type Field = 'name' | 'phone' | 'address' | 'note';
type Values = Record<Field, string>;
type Errors = Partial<Record<Field, string>>;

const EMPTY: Values = { name: '', phone: '', address: '', note: '' };
const ORDER: Field[] = ['name', 'phone', 'address', 'note'];
const NOTE_MAX = 300;

function validate(field: Field, raw: string): string | undefined {
  const value = raw.trim();
  switch (field) {
    case 'name':
      if (!value) return 'Bạn chưa nhập họ tên.';
      if (value.length < 2) return 'Họ tên cần ít nhất 2 ký tự.';
      return undefined;
    case 'phone': {
      if (!value) return 'Bạn chưa nhập số điện thoại.';
      const digits = value.replace(/[\s.-]/g, '');
      if (!/^(0\d{9}|\+84\d{9})$/.test(digits)) return 'Số điện thoại cần 10 chữ số, bắt đầu bằng 0 hoặc +84.';
      return undefined;
    }
    case 'address':
      if (!value) return 'Bạn chưa nhập địa chỉ nhận hàng.';
      if (value.length < 10) return 'Địa chỉ hơi ngắn. Hãy ghi số nhà, đường, phường xã, tỉnh thành.';
      return undefined;
    case 'note':
      if (value.length > NOTE_MAX) return `Ghi chú tối đa ${NOTE_MAX} ký tự.`;
      return undefined;
  }
}

interface CartDrawerProps {
  lines: CartLine[];
  onQty: (id: string, qty: number) => void;
  onRemove: (id: string) => void;
  onClose: () => void;
  /** Gọi khi biểu mẫu hợp lệ. Bản mẫu không gửi dữ liệu đi đâu. */
  onOrder: () => void;
}

export function CartDrawer({ lines, onQty, onRemove, onClose, onOrder }: CartDrawerProps) {
  const panelRef = useDialog<HTMLDivElement>(onClose);
  const [step, setStep] = useState<'cart' | 'checkout'>('cart');
  const [values, setValues] = useState<Values>(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const inputs = useRef<Partial<Record<Field, HTMLInputElement | HTMLTextAreaElement | null>>>({});

  const items = lines.flatMap((line) => {
    const product = productById(line.id);
    return product ? [{ product, qty: line.qty }] : [];
  });
  const count = items.reduce((sum, item) => sum + item.qty, 0);
  const total = items.reduce((sum, item) => sum + item.qty * item.product.price, 0);
  const showCheckout = step === 'checkout' && items.length > 0;

  const goTo = (next: 'cart' | 'checkout') => {
    setStep(next);
    panelRef.current?.focus();
  };

  const remove = (product: Product) => {
    onRemove(product.id);
    panelRef.current?.focus();
  };

  const setField = (field: Field, value: string) => {
    setValues((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: validate(field, value) }));
  };

  const blurField = (field: Field) => setErrors((prev) => ({ ...prev, [field]: validate(field, values[field]) }));

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const next: Errors = {};
    for (const field of ORDER) next[field] = validate(field, values[field]);
    setErrors(next);
    const firstBad = ORDER.find((field) => next[field]);
    if (firstBad) {
      inputs.current[firstBad]?.focus();
      return;
    }
    onOrder();
  };

  const describedBy = (field: Field, hint?: string) => [errors[field] ? `ml-err-${field}` : null, hint ?? null].filter(Boolean).join(' ') || undefined;

  const errorOf = (field: Field) =>
    errors[field] ? (
      <p className="ml-field__error" id={`ml-err-${field}`}>
        {errors[field]}
      </p>
    ) : null;

  return (
    <div className="ml-overlay ml-overlay--drawer">
      <div className="ml-overlay__backdrop" onClick={onClose} />
      <div className="ml-drawer" role="dialog" aria-modal="true" aria-labelledby="ml-drawer-title" tabIndex={-1} ref={panelRef}>
        <header className="ml-drawer__head">
          {showCheckout ? (
            <button type="button" className="ml-iconbtn" onClick={() => goTo('cart')} aria-label="Quay lại giỏ hàng">
              <BackIcon />
            </button>
          ) : null}
          <h2 id="ml-drawer-title" className="ml-drawer__title">
            {showCheckout ? 'Thông tin nhận hàng' : 'Giỏ hàng'}
            {!showCheckout && count > 0 ? <span className="ml-drawer__count"> ({count})</span> : null}
          </h2>
          <button type="button" className="ml-iconbtn" onClick={onClose} aria-label="Đóng giỏ hàng">
            <CloseIcon />
          </button>
        </header>

        {items.length === 0 ? (
          <div className="ml-drawer__empty">
            <div className="ml-drawer__empty-art" style={{ background: glazes.tro.tile }}>
              <ProductArt shape="bowl" glaze="tro" dip seed={4} />
            </div>
            <p className="ml-drawer__empty-title">Giỏ còn trống</p>
            <p className="ml-drawer__empty-text">Chọn vài món gốm bạn thích, chúng sẽ nằm ở đây.</p>
            <button type="button" className="ml-btn ml-btn--primary" onClick={onClose} data-autofocus>
              Xem sản phẩm
            </button>
          </div>
        ) : showCheckout ? (
          <form className="ml-drawer__body ml-form" onSubmit={submit} noValidate>
            <div className="ml-drawer__scroll">
              <p className="ml-form__summary">
                {count} món · <strong>{formatVnd(total)}</strong>
              </p>

              <div className="ml-field">
                <label htmlFor="ml-f-name">Họ tên</label>
                <input
                  id="ml-f-name"
                  type="text"
                  autoComplete="name"
                  value={values.name}
                  ref={(el) => {
                    inputs.current.name = el;
                  }}
                  onChange={(e) => setField('name', e.target.value)}
                  onBlur={() => blurField('name')}
                  aria-required="true"
                  aria-invalid={errors.name ? true : undefined}
                  aria-describedby={describedBy('name')}
                />
                {errorOf('name')}
              </div>

              <div className="ml-field">
                <label htmlFor="ml-f-phone">Số điện thoại</label>
                <input
                  id="ml-f-phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  value={values.phone}
                  ref={(el) => {
                    inputs.current.phone = el;
                  }}
                  onChange={(e) => setField('phone', e.target.value)}
                  onBlur={() => blurField('phone')}
                  aria-required="true"
                  aria-invalid={errors.phone ? true : undefined}
                  aria-describedby={describedBy('phone', 'ml-hint-phone')}
                />
                <p className="ml-field__hint" id="ml-hint-phone">
                  Xưởng gọi xác nhận trước khi gói hàng.
                </p>
                {errorOf('phone')}
              </div>

              <div className="ml-field">
                <label htmlFor="ml-f-address">Địa chỉ nhận hàng</label>
                <textarea
                  id="ml-f-address"
                  rows={2}
                  autoComplete="street-address"
                  value={values.address}
                  ref={(el) => {
                    inputs.current.address = el;
                  }}
                  onChange={(e) => setField('address', e.target.value)}
                  onBlur={() => blurField('address')}
                  aria-required="true"
                  aria-invalid={errors.address ? true : undefined}
                  aria-describedby={describedBy('address')}
                />
                {errorOf('address')}
              </div>

              <div className="ml-field">
                <label htmlFor="ml-f-note">
                  Ghi chú <span className="ml-field__optional">(không bắt buộc)</span>
                </label>
                <textarea
                  id="ml-f-note"
                  rows={3}
                  value={values.note}
                  ref={(el) => {
                    inputs.current.note = el;
                  }}
                  onChange={(e) => setField('note', e.target.value)}
                  onBlur={() => blurField('note')}
                  aria-invalid={errors.note ? true : undefined}
                  aria-describedby={describedBy('note', 'ml-hint-note')}
                />
                <p className="ml-field__hint" id="ml-hint-note">
                  Ví dụ: giao giờ hành chính, gói làm quà. {values.note.trim().length}/{NOTE_MAX}
                </p>
                {errorOf('note')}
              </div>
            </div>

            <div className="ml-drawer__foot">
              <div className="ml-total">
                <span>Tổng tiền hàng</span>
                <strong>{formatVnd(total)}</strong>
              </div>
              <p className="ml-drawer__note">Thanh toán khi nhận hàng. Phí giao báo khi xưởng gọi xác nhận.</p>
              <button type="submit" className="ml-btn ml-btn--primary ml-btn--block">
                Đặt hàng
              </button>
            </div>
          </form>
        ) : (
          <div className="ml-drawer__body">
            <ul className="ml-drawer__scroll ml-lines">
              {items.map(({ product, qty }) => (
                <li key={product.id} className="ml-line">
                  <div className="ml-line__art" style={{ background: glazes[product.glaze].tile }}>
                    <ProductArt shape={product.shape} glaze={product.glaze} dip={product.dip} seed={product.seed} />
                  </div>
                  <div className="ml-line__info">
                    <p className="ml-line__name">{product.name}</p>
                    <p className="ml-line__unit">{formatVnd(product.price)} / chiếc</p>
                    <div className="ml-line__row">
                      <Stepper value={qty} name={product.name} onChange={(next) => onQty(product.id, next)} />
                      <button type="button" className="ml-iconbtn ml-iconbtn--quiet" onClick={() => remove(product)} aria-label={`Bỏ ${product.name} khỏi giỏ`}>
                        <TrashIcon />
                      </button>
                    </div>
                  </div>
                  <p className="ml-line__sum">{formatVnd(product.price * qty)}</p>
                </li>
              ))}
            </ul>
            <div className="ml-drawer__foot">
              <div className="ml-total" aria-live="polite">
                <span>Tạm tính</span>
                <strong>{formatVnd(total)}</strong>
              </div>
              <p className="ml-drawer__note">Chưa gồm phí giao hàng.</p>
              <button type="button" className="ml-btn ml-btn--primary ml-btn--block" onClick={() => goTo('checkout')} data-autofocus>
                Tiếp tục đặt hàng <ArrowIcon />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
