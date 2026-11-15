import { useState } from 'react';
import type { CategoryId } from './data';

interface Option<T extends string> {
  id: T;
  label: string;
}

type RoomId = 'bep' | 'ngu' | 'khach' | 'lam-viec' | 'an';
type SizeId = 'nho' | 'vua' | 'lon';
type MaterialId = 'soi' | 'oc-cho' | 'mdf' | 'laminate';

const rooms: ReadonlyArray<Option<RoomId> & { item: string; category: CategoryId; phrase: string }> = [
  { id: 'bep', label: 'Bếp', item: 'tủ bếp', category: 'tu-bep', phrase: 'gian bếp' },
  { id: 'ngu', label: 'Phòng ngủ', item: 'tủ quần áo và đầu giường', category: 'phong-ngu', phrase: 'phòng ngủ' },
  { id: 'khach', label: 'Phòng khách', item: 'kệ sách kín tường', category: 'ke-sach', phrase: 'phòng khách' },
  { id: 'lam-viec', label: 'Phòng làm việc', item: 'kệ và bàn làm việc liền khối', category: 'ke-sach', phrase: 'phòng làm việc' },
  { id: 'an', label: 'Phòng ăn', item: 'bàn ăn và tủ ly', category: 'ban-an', phrase: 'phòng ăn' },
];

const sizes: ReadonlyArray<Option<SizeId> & { phrase: string; hint: string }> = [
  { id: 'nho', label: 'Dưới 2 m', phrase: 'dưới 2 m', hint: 'Mảng ngắn thường làm gọn trong một khối, ít mối nối.' },
  { id: 'vua', label: '2 – 4 m', phrase: 'khoảng 2 đến 4 m', hint: 'Độ dài này đủ chia ba đến năm khoang, nên tính trước vị trí ổ điện.' },
  { id: 'lon', label: 'Trên 4 m', phrase: 'trên 4 m', hint: 'Mảng dài cần chia khối để vận chuyển và ghép tại nhà.' },
];

const mats: ReadonlyArray<Option<MaterialId> & { phrase: string; hint: string }> = [
  { id: 'soi', label: 'Gỗ sồi', phrase: 'gỗ sồi', hint: 'Sồi sáng màu, vân thẳng, hợp phòng cần cảm giác rộng.' },
  { id: 'oc-cho', label: 'Gỗ óc chó', phrase: 'gỗ óc chó', hint: 'Óc chó sẫm và ấm, nên phối với tường sáng.' },
  { id: 'mdf', label: 'MDF chống ẩm', phrase: 'MDF chống ẩm phủ melamine', hint: 'MDF chống ẩm ổn định, hợp nơi gần nước.' },
  { id: 'laminate', label: 'Laminate', phrase: 'bề mặt laminate', hint: 'Laminate chịu xước, lau nhanh, nhiều màu trơn.' },
];

interface Props {
  onUse: (summary: string, category: CategoryId) => void;
}

export function Configurator({ onUse }: Props) {
  const [room, setRoom] = useState<RoomId>('bep');
  const [size, setSize] = useState<SizeId>('vua');
  const [mat, setMat] = useState<MaterialId>('soi');

  const r = rooms.find((o) => o.id === room) ?? rooms[0];
  const s = sizes.find((o) => o.id === size) ?? sizes[1];
  const m = mats.find((o) => o.id === mat) ?? mats[0];
  const summary = `Tôi đang nghĩ tới ${r.item} cho ${r.phrase}, mảng tường dài ${s.phrase}, dùng ${m.phrase}.`;

  return (
    <div className="config">
      <div className="config-controls">
        <Group legend="Không gian" name="dv-room" options={rooms} value={room} onChange={setRoom} />
        <Group legend="Chiều dài mảng tường" name="dv-size" options={sizes} value={size} onChange={setSize} />
        <Group legend="Vật liệu chính" name="dv-mat" options={mats} value={mat} onChange={setMat} />
      </div>
      <div className="config-result">
        <p className="eyebrow">Tóm tắt nhu cầu</p>
        <p className="config-summary" aria-live="polite">
          {summary}
        </p>
        <ul className="config-hints">
          <li>{s.hint}</li>
          <li>{m.hint}</li>
        </ul>
        <p className="config-note">Đây là câu mô tả để bắt đầu trao đổi, không phải báo giá. Giá chỉ có sau khi khảo sát và chốt bản vẽ.</p>
        <button type="button" className="btn btn-primary" onClick={() => onUse(summary, r.category)}>
          Đưa vào yêu cầu tư vấn
        </button>
      </div>
    </div>
  );
}

interface GroupProps<T extends string> {
  legend: string;
  name: string;
  options: ReadonlyArray<Option<T>>;
  value: T;
  onChange: (value: T) => void;
}

function Group<T extends string>({ legend, name, options, value, onChange }: GroupProps<T>) {
  return (
    <fieldset className="config-group">
      <legend>{legend}</legend>
      <div className="config-options">
        {options.map((o) => (
          <label key={o.id} className="radio-chip">
            <input type="radio" name={name} value={o.id} checked={value === o.id} onChange={() => onChange(o.id)} />
            <span>{o.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
