/** Dữ liệu minh họa của tiệm tóc hư cấu "Chín Giờ". Không có số liệu thật. */

export type ServiceGroup = 'cat' | 'uon-nhuom' | 'goi-cham-soc';

export interface Service {
  id: string;
  group: ServiceGroup;
  name: string;
  blurb: string;
  /** Thời lượng tính bằng phút. */
  minutes: number;
  /** Giá tính bằng đồng. */
  price: number;
}

export interface Stylist {
  id: string;
  name: string;
  role: string;
  specialty: string;
  tags: string[];
  /** Kiểu hình minh họa (0–3). */
  look: 0 | 1 | 2 | 3;
}

export const GROUP_LABEL: Record<ServiceGroup, string> = {
  cat: 'Cắt',
  'uon-nhuom': 'Uốn – Nhuộm',
  'goi-cham-soc': 'Gội – Chăm sóc',
};

export const GROUP_ORDER: ServiceGroup[] = ['cat', 'uon-nhuom', 'goi-cham-soc'];

export const SERVICES: Service[] = [
  { id: 'cat-nu', group: 'cat', name: 'Cắt nữ tạo kiểu', blurb: 'Tư vấn dáng tóc theo khuôn mặt, cắt, sấy vào nếp.', minutes: 45, price: 180_000 },
  { id: 'cat-nam', group: 'cat', name: 'Cắt nam và gội', blurb: 'Cắt kéo hoặc tông đơ, gội sạch, vuốt sáp.', minutes: 30, price: 120_000 },
  { id: 'tia-mai', group: 'cat', name: 'Tỉa mái', blurb: 'Sửa mái thưa, mái bay, mái ngang.', minutes: 15, price: 40_000 },
  { id: 'uon-song', group: 'uon-nhuom', name: 'Uốn sóng lơi', blurb: 'Sóng mềm, giữ nếp, tự sấy ở nhà được.', minutes: 120, price: 650_000 },
  { id: 'nhuom-mau', group: 'uon-nhuom', name: 'Nhuộm một màu', blurb: 'Phủ đều từ chân đến ngọn, thử màu trước khi nhuộm.', minutes: 90, price: 550_000 },
  { id: 'highlight', group: 'uon-nhuom', name: 'Tẩy và nhuộm highlight', blurb: 'Tẩy từng lọn rồi phủ màu. Nên đặt buổi sáng vì làm khá lâu.', minutes: 150, price: 900_000 },
  { id: 'goi-duong', group: 'goi-cham-soc', name: 'Gội dưỡng sinh', blurb: 'Gội thảo mộc, bấm huyệt đầu, cổ, vai.', minutes: 40, price: 90_000 },
  { id: 'hap-phuc-hoi', group: 'goi-cham-soc', name: 'Hấp phục hồi', blurb: 'Dành cho tóc khô xơ sau uốn, nhuộm.', minutes: 30, price: 150_000 },
];

export const STYLISTS: Stylist[] = [
  { id: 'vy', name: 'Vy', role: 'Thợ chính', specialty: 'Cắt nữ và tóc ngắn cá tính. Hỏi kỹ thói quen sấy tóc của bạn rồi mới cầm kéo.', tags: ['Bob', 'Pixie', 'Tóc tầng'], look: 0 },
  { id: 'khoa', name: 'Khoa', role: 'Thợ cắt nam', specialty: 'Fade, side part, kiểu Hàn.', tags: ['Fade', 'Tông đơ'], look: 1 },
  { id: 'man', name: 'Mận', role: 'Thợ uốn', specialty: 'Uốn sóng, uốn phồng chân tóc.', tags: ['Sóng lơi', 'Xoăn nhỏ'], look: 2 },
  { id: 'tin', name: 'Tín', role: 'Thợ màu', specialty: 'Nhuộm, tẩy, highlight và balayage. Pha màu ngay trước mặt khách.', tags: ['Highlight', 'Balayage', 'Phủ bạc'], look: 3 },
];

export const ANY_STYLIST = 'any';

export const serviceById = (id: string): Service | undefined => SERVICES.find((s) => s.id === id);
export const stylistById = (id: string): Stylist | undefined => STYLISTS.find((s) => s.id === id);
export const stylistName = (id: string | null): string => {
  if (id === null) return 'Chưa chọn';
  if (id === ANY_STYLIST) return 'Ai cũng được';
  return stylistById(id)?.name ?? 'Chưa chọn';
};
