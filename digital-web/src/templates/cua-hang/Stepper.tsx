import { MAX_QTY } from './data';
import { MinusIcon, PlusIcon } from './icons';

interface StepperProps {
  value: number;
  /** Tên sản phẩm, dùng cho nhãn đọc màn hình. */
  name: string;
  onChange: (next: number) => void;
}

export function Stepper({ value, name, onChange }: StepperProps) {
  return (
    <div className="ml-stepper" role="group" aria-label={`Số lượng ${name}`}>
      <button type="button" className="ml-stepper__btn" onClick={() => onChange(value - 1)} disabled={value <= 1} aria-label={`Giảm số lượng ${name}`}>
        <MinusIcon />
      </button>
      <span className="ml-stepper__value" aria-live="polite">
        {value}
      </span>
      <button type="button" className="ml-stepper__btn" onClick={() => onChange(value + 1)} disabled={value >= MAX_QTY} aria-label={`Tăng số lượng ${name}`}>
        <PlusIcon />
      </button>
    </div>
  );
}
