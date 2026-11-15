/** Dữ liệu minh họa của bản mẫu "Nhà Én". Không có mục nào là công trình, khách hàng hay báo giá thật. */

export type CategoryId = 'tu-bep' | 'tu-ao' | 'ke-sach' | 'ban-an' | 'phong-ngu';
export type SceneKind = 'kitchen' | 'wardrobe' | 'shelf' | 'dining' | 'bedroom';

export interface Tone {
  wall: string;
  floor: string;
  wood: string;
  woodDark: string;
  woodLight: string;
  /** Màu cánh phủ (laminate/sơn). */
  panel: string;
  stone: string;
  textile: string;
}

export const tones = {
  oak: { wall: '#ebe7df', floor: '#d3c6b0', wood: '#c9a473', woodDark: '#a5804e', woodLight: '#e2cba6', panel: '#f6f3ec', stone: '#f3f0ea', textile: '#8d9788' },
  walnut: { wall: '#e9e5dd', floor: '#cfc5b6', wood: '#7d5438', woodDark: '#573826', woodLight: '#b08a68', panel: '#ece6da', stone: '#e4dfd6', textile: '#b9772e' },
  ash: { wall: '#eeebe4', floor: '#c9bda9', wood: '#d9c5a2', woodDark: '#b79c72', woodLight: '#ece0c8', panel: '#f8f6f0', stone: '#f1eee8', textile: '#55585c' },
  charcoal: { wall: '#e6e3dc', floor: '#c8b99f', wood: '#c9a473', woodDark: '#9d7948', woodLight: '#dcc39b', panel: '#3a3c40', stone: '#d9d6cf', textile: '#8d9788' },
} satisfies Record<string, Tone>;

export interface Service {
  id: CategoryId;
  name: string;
  scene: SceneKind;
  tone: Tone;
  intro: string;
  includes: string[];
}

export const services: Service[] = [
  {
    id: 'tu-bep',
    name: 'Tủ bếp',
    scene: 'kitchen',
    tone: tones.oak,
    intro: 'Tủ trên, tủ dưới và tủ cao được chia theo đúng thói quen nấu của nhà bạn, không theo bộ có sẵn.',
    includes: ['Đo hiện trạng, vị trí điện nước', 'Chia khoang cho bếp, chậu rửa, lò', 'Ray trượt và bản lề giảm chấn', 'Lắp mặt bàn, cân chỉnh cánh'],
  },
  {
    id: 'tu-ao',
    name: 'Tủ quần áo',
    scene: 'wardrobe',
    tone: tones.walnut,
    intro: 'Tủ đóng sát trần, sát tường. Bên trong chia theo số đồ treo, đồ gấp và vali của từng người.',
    includes: ['Cánh mở hoặc cánh lùa', 'Thanh treo, ngăn kéo, ngăn vali', 'Xử lý khe hở với trần và tường', 'Đèn trong tủ nếu bạn cần'],
  },
  {
    id: 'ke-sach',
    name: 'Kệ sách & vách',
    scene: 'shelf',
    tone: tones.oak,
    intro: 'Một mảng tường thành chỗ để sách, đồ trưng bày và cất đồ kín. Vách ngăn chia phòng mà vẫn thoáng.',
    includes: ['Tính tải cho từng đợt kệ', 'Kết hợp ô hở và ô có cánh', 'Đi dây đèn, ổ điện âm', 'Vách nan hoặc vách kệ hai mặt'],
  },
  {
    id: 'ban-an',
    name: 'Bàn ăn',
    scene: 'dining',
    tone: tones.walnut,
    intro: 'Bàn đóng theo số người ngồi và lối đi quanh bàn. Mặt gỗ ghép nguyên tấm, chân tháo được khi chuyển nhà.',
    includes: ['Chọn kích thước theo phòng', 'Mặt gỗ tự nhiên, phủ dầu hoặc sơn mờ', 'Ghế hoặc băng ngồi đi kèm', 'Hướng dẫn chăm mặt gỗ'],
  },
  {
    id: 'phong-ngu',
    name: 'Phòng ngủ',
    scene: 'bedroom',
    tone: tones.ash,
    intro: 'Giường, đầu giường và tab được làm thành một khối liền, vừa khít chiều ngang căn phòng.',
    includes: ['Giường có hoặc không có hộc kéo', 'Vách đầu giường ốp gỗ', 'Tab treo, công tắc đầu giường', 'Bàn trang điểm cùng tông gỗ'],
  },
];

export const categoryLabel: Record<CategoryId, string> = {
  'tu-bep': 'Tủ bếp',
  'tu-ao': 'Tủ quần áo',
  'ke-sach': 'Kệ sách & vách',
  'ban-an': 'Bàn ăn',
  'phong-ngu': 'Phòng ngủ',
};

export interface Project {
  id: string;
  category: CategoryId;
  title: string;
  scene: SceneKind;
  tone: Tone;
  room: string;
  materials: string;
  dimensions: string;
  hardware: string;
  note: string;
}

export const projects: Project[] = [
  {
    id: 'bep-chu-i',
    category: 'tu-bep',
    title: 'Bếp chữ I gỗ sồi',
    scene: 'kitchen',
    tone: tones.oak,
    room: 'Bếp căn hộ, một mảng tường',
    materials: 'Cánh dưới gỗ sồi, cánh trên phủ laminate trắng mờ, mặt đá nhân tạo',
    dimensions: 'Dài 3,6 m · cao 2,4 m · sâu 0,6 m',
    hardware: 'Ray âm giảm chấn, bản lề giảm chấn',
    note: 'Tủ cao bên phải gom lò nướng và tủ lạnh về một khối để mặt bàn chạy liền.',
  },
  {
    id: 'tu-ao-oc-cho',
    category: 'tu-ao',
    title: 'Tủ áo sát trần óc chó',
    scene: 'wardrobe',
    tone: tones.walnut,
    room: 'Phòng ngủ chính',
    materials: 'Cánh veneer óc chó, thùng MDF chống ẩm phủ melamine',
    dimensions: 'Dài 2,8 m · cao 2,7 m · sâu 0,6 m',
    hardware: 'Tay nắm âm, thanh treo nhôm, ngăn kéo ray bi',
    note: 'Nửa bên phải để hở khi chụp minh họa cho thấy cách chia thanh treo và ngăn kéo.',
  },
  {
    id: 'ke-sach-kin-tuong',
    category: 'ke-sach',
    title: 'Kệ sách kín mảng tường',
    scene: 'shelf',
    tone: tones.oak,
    room: 'Phòng khách kiêm chỗ đọc',
    materials: 'Gỗ sồi ghép thanh, hậu MDF phủ veneer',
    dimensions: 'Dài 3,0 m · cao 2,6 m · sâu 0,32 m',
    hardware: 'Chốt kệ âm, cánh tủ đáy nhấn mở',
    note: 'Đợt kệ dày 25 mm, nhịp tối đa 72 cm để không võng khi xếp kín sách.',
  },
  {
    id: 'ban-an-sau-ghe',
    category: 'ban-an',
    title: 'Bàn ăn sáu ghế',
    scene: 'dining',
    tone: tones.walnut,
    room: 'Phòng ăn liền bếp',
    materials: 'Mặt óc chó ghép nguyên tấm, phủ dầu lau',
    dimensions: 'Dài 1,8 m · rộng 0,9 m · cao 0,75 m',
    hardware: 'Chân tháo rời bằng bu lông cấy',
    note: 'Chừa lối đi 90 cm quanh bàn. Mép bàn bo tròn bán kính 6 mm.',
  },
  {
    id: 'phong-ngu-tan-bi',
    category: 'phong-ngu',
    title: 'Giường và vách đầu giường',
    scene: 'bedroom',
    tone: tones.ash,
    room: 'Phòng ngủ 12 m²',
    materials: 'Gỗ tần bì, vách ốp nan đứng, vải bọc tháo giặt được',
    dimensions: 'Giường 1,6 × 2,0 m · vách dài 3,2 m',
    hardware: 'Tab treo âm tường, công tắc đầu giường',
    note: 'Tab treo cách sàn 35 cm để robot hút bụi đi lọt bên dưới.',
  },
  {
    id: 'bep-xam-than',
    category: 'tu-bep',
    title: 'Bếp xám than phối sồi',
    scene: 'kitchen',
    tone: tones.charcoal,
    room: 'Bếp nhà phố, mảng tường cuối nhà',
    materials: 'Cánh trên laminate xám than, cánh dưới gỗ sồi, mặt đá nung kết',
    dimensions: 'Dài 4,2 m · cao 2,5 m · sâu 0,6 m',
    hardware: 'Tay nắm rãnh phay, ray hộp',
    note: 'Cánh trên không tay nắm, mở bằng rãnh phay ở cạnh dưới.',
  },
];

export interface Step {
  title: string;
  text: string;
  duration: string;
}

export const steps: Step[] = [
  { title: 'Khảo sát', text: 'Thợ đến đo tường, trần, vị trí ổ điện và ống nước. Bạn kể thói quen dùng đồ.', duration: 'Một buổi' },
  { title: 'Bản vẽ', text: 'Bạn nhận mặt bằng, mặt đứng và phối cảnh. Sửa đến khi từng khoang đúng ý.', duration: 'Vài ngày' },
  { title: 'Báo giá', text: 'Giá tách theo từng hạng mục, ghi rõ vật liệu và phụ kiện. Chốt rồi mới đóng.', duration: 'Sau bản vẽ' },
  { title: 'Đóng tại xưởng', text: 'Cắt, dán cạnh, ráp thử và hoàn thiện bề mặt tại xưởng. Có ảnh tiến độ gửi bạn.', duration: 'Vài tuần' },
  { title: 'Lắp đặt', text: 'Chở đến, lắp, cân chỉnh cánh và dọn sạch. Hai bên cùng kiểm tra trước khi bàn giao.', duration: 'Một đến ba ngày' },
];

export interface Material {
  name: string;
  kind: string;
  use: string;
  base: string;
  line: string;
  grain: 'wood' | 'fine' | 'plain' | 'stone';
}

export const materials: Material[] = [
  { name: 'Gỗ sồi', kind: 'Gỗ tự nhiên', use: 'Vân thẳng, màu sáng. Hợp tủ bếp, kệ sách, bàn ăn.', base: '#c9a473', line: '#a5804e', grain: 'wood' },
  { name: 'Gỗ óc chó', kind: 'Gỗ tự nhiên', use: 'Nâu sẫm, vân cuộn. Hợp mặt bàn và cánh tủ áo.', base: '#7d5438', line: '#573826', grain: 'wood' },
  { name: 'Gỗ tần bì', kind: 'Gỗ tự nhiên', use: 'Sáng và nhẹ mắt. Hợp giường và vách đầu giường.', base: '#d9c5a2', line: '#b79c72', grain: 'wood' },
  { name: 'MDF chống ẩm', kind: 'Gỗ công nghiệp', use: 'Lõi xanh, phủ melamine. Dùng cho thùng tủ bếp, tủ áo.', base: '#e9e6df', line: '#7fa089', grain: 'fine' },
  { name: 'Laminate', kind: 'Bề mặt phủ', use: 'Chịu xước, dễ lau. Hợp cánh tủ bếp và mặt bàn làm việc.', base: '#3a3c40', line: '#4a4d52', grain: 'plain' },
  { name: 'Đá nung kết', kind: 'Mặt bàn', use: 'Chịu nhiệt, ít thấm. Dùng cho mặt bếp và đảo bếp.', base: '#dcd8d0', line: '#bdb7ac', grain: 'stone' },
];

export interface Faq {
  q: string;
  a: string;
}

export const faqs: Faq[] = [
  { q: 'Tôi chưa có bản vẽ nhà thì bắt đầu từ đâu?', a: 'Bạn chỉ cần mô tả căn phòng và gửi vài tấm ảnh. Xưởng hẹn một buổi đến đo. Bản vẽ được dựng từ số đo thật, không cần bạn chuẩn bị gì thêm.' },
  { q: 'Khảo sát có mất phí không?', a: 'Trong kịch bản minh họa này, buổi khảo sát đầu tiên không tính phí. Với website thật, chủ xưởng tự điền chính sách của mình vào đây.' },
  { q: 'Từ lúc chốt bản vẽ đến lúc lắp xong mất bao lâu?', a: 'Tùy khối lượng. Một tủ bếp hoặc tủ áo thường cần vài tuần đóng tại xưởng và một đến ba ngày lắp. Mốc cụ thể được ghi trong báo giá.' },
  { q: 'Tôi muốn đổi thiết kế khi xưởng đã đóng thì sao?', a: 'Đổi được ở phần chưa cắt ván. Phần đã cắt sẽ phát sinh vật tư, xưởng báo rõ trước khi làm tiếp để bạn quyết định.' },
  { q: 'Gỗ tự nhiên và gỗ công nghiệp, nên chọn loại nào?', a: 'Gỗ tự nhiên hợp với mặt bàn, cánh tủ nhìn thấy nhiều. Gỗ công nghiệp chống ẩm ổn định hơn cho thùng tủ. Phần lớn hạng mục phối cả hai để cân chi phí.' },
  { q: 'Sau khi lắp, đồ bị xệ cánh hay kẹt ray thì ai xử lý?', a: 'Xưởng quay lại cân chỉnh. Thời hạn bảo hành cho từng loại phụ kiện được ghi trong biên bản bàn giao.' },
];

export interface FormValues {
  name: string;
  contact: string;
  category: string;
  message: string;
}

export const emptyForm: FormValues = { name: '', contact: '', category: '', message: '' };

export const navLinks = [
  { href: '#dich-vu', label: 'Dịch vụ' },
  { href: '#hang-muc', label: 'Hạng mục mẫu' },
  { href: '#quy-trinh', label: 'Quy trình' },
  { href: '#vat-lieu', label: 'Vật liệu' },
  { href: '#hoi-dap', label: 'Hỏi đáp' },
] as const;
