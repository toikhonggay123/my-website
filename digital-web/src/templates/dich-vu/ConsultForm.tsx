import { useRef, useState, type FormEvent } from 'react';
import { categoryLabel, emptyForm, type CategoryId, type FormValues } from './data';

type Field = keyof FormValues;
type Errors = Partial<Record<Field, string>>;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function validate(values: FormValues): Errors {
  const errors: Errors = {};
  const name = values.name.trim();
  const contact = values.contact.trim();
  const message = values.message.trim();

  if (name.length === 0) errors.name = 'Vui lòng nhập họ tên.';
  else if (name.length < 2) errors.name = 'Họ tên cần ít nhất 2 ký tự.';

  if (contact.length === 0) {
    errors.contact = 'Vui lòng nhập số điện thoại hoặc email.';
  } else if (contact.includes('@')) {
    if (!EMAIL.test(contact)) errors.contact = 'Email chưa đúng dạng, ví dụ ten@example.com.';
  } else {
    const digits = contact.replace(/[\s.\-()+]/g, '');
    if (!/^\d{9,11}$/.test(digits)) errors.contact = 'Số điện thoại cần 9 đến 11 chữ số, hoặc nhập một địa chỉ email.';
  }

  if (values.category === '') errors.category = 'Vui lòng chọn một hạng mục.';

  if (message.length === 0) errors.message = 'Vui lòng mô tả ngắn về căn phòng hoặc món đồ bạn cần.';
  else if (message.length < 10) errors.message = 'Mô tả cần ít nhất 10 ký tự để xưởng hiểu nhu cầu.';

  return errors;
}

const order: Field[] = ['name', 'contact', 'category', 'message'];

interface Props {
  values: FormValues;
  onChange: (values: FormValues) => void;
  /** Gọi khi biểu mẫu hợp lệ. Bản mẫu không gửi dữ liệu đi đâu. */
  onValidSubmit: () => void;
}

export function ConsultForm({ values, onChange, onValidSubmit }: Props) {
  const [touched, setTouched] = useState<Partial<Record<Field, boolean>>>({});
  const formRef = useRef<HTMLFormElement>(null);
  const errors = validate(values);
  const shown = (field: Field) => (touched[field] ? errors[field] : undefined);

  const set = (field: Field, value: string) => onChange({ ...values, [field]: value });
  const blur = (field: Field) => setTouched((t) => ({ ...t, [field]: true }));

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const firstInvalid = order.find((field) => errors[field]);
    if (firstInvalid) {
      setTouched({ name: true, contact: true, category: true, message: true });
      formRef.current?.querySelector<HTMLElement>(`[name="${firstInvalid}"]`)?.focus();
      return;
    }
    onValidSubmit();
    onChange(emptyForm);
    setTouched({});
  };

  const describe = (field: Field, hint?: string) => {
    const ids = [shown(field) ? `dv-${field}-error` : null, hint ?? null].filter(Boolean);
    return ids.length > 0 ? ids.join(' ') : undefined;
  };

  const error = (field: Field) =>
    shown(field) ? (
      <p id={`dv-${field}-error`} className="field-error">
        {shown(field)}
      </p>
    ) : null;

  return (
    <form ref={formRef} className="form" noValidate onSubmit={submit}>
      <div className="field">
        <label htmlFor="dv-name">Họ tên</label>
        <input
          id="dv-name"
          name="name"
          type="text"
          autoComplete="name"
          required
          value={values.name}
          onChange={(e) => set('name', e.target.value)}
          onBlur={() => blur('name')}
          aria-invalid={shown('name') ? true : undefined}
          aria-describedby={describe('name')}
        />
        {error('name')}
      </div>
      <div className="field">
        <label htmlFor="dv-contact">Số điện thoại hoặc email</label>
        <input
          id="dv-contact"
          name="contact"
          type="text"
          inputMode="email"
          autoComplete="off"
          required
          value={values.contact}
          onChange={(e) => set('contact', e.target.value)}
          onBlur={() => blur('contact')}
          aria-invalid={shown('contact') ? true : undefined}
          aria-describedby={describe('contact')}
        />
        {error('contact')}
      </div>
      <div className="field field-wide">
        <label htmlFor="dv-category">Hạng mục quan tâm</label>
        <div className="select-wrap">
          <select
            id="dv-category"
            name="category"
            required
            value={values.category}
            onChange={(e) => set('category', e.target.value)}
            onBlur={() => blur('category')}
            aria-invalid={shown('category') ? true : undefined}
            aria-describedby={describe('category')}
          >
            <option value="">Chọn hạng mục</option>
            {(Object.keys(categoryLabel) as CategoryId[]).map((id) => (
              <option key={id} value={id}>
                {categoryLabel[id]}
              </option>
            ))}
            <option value="chua-ro">Chưa rõ, cần tư vấn</option>
          </select>
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
            <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        {error('category')}
      </div>
      <div className="field field-wide">
        <label htmlFor="dv-message">Mô tả</label>
        <textarea
          id="dv-message"
          name="message"
          rows={5}
          required
          value={values.message}
          onChange={(e) => set('message', e.target.value)}
          onBlur={() => blur('message')}
          aria-invalid={shown('message') ? true : undefined}
          aria-describedby={describe('message', 'dv-message-hint')}
        />
        <p id="dv-message-hint" className="field-hint">
          Ví dụ: phòng nào, mảng tường dài bao nhiêu, bạn muốn cất những gì.
        </p>
        {error('message')}
      </div>
      <div className="form-foot field-wide">
        <button type="submit" className="btn btn-primary btn-on-dark">
          Gửi yêu cầu
        </button>
        <p>Bản mẫu không lưu và không gửi thông tin bạn nhập.</p>
      </div>
    </form>
  );
}
