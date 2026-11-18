export interface HeroMode {
  id: string;
  label: string;
  url: string;
  title: string;
  cta: string;
  phoneTitle: string;
  tiles: string[];
  activeTile: number;
  chip1: [string, string];
  chip2: [string, string];
  isSlots?: boolean;
}

export interface SolutionItem {
  id: string;
  need: string;
  eyebrow: string;
  title: string;
  description: string;
  cta: string;
  href: string;
  big?: boolean;
  alt?: boolean;
  blockIndex: number;
}

export interface DemoItem {
  slug: string;
  route: string;
  business: string;
  title: string;
  subtitle: string;
  navText: string;
  headline: string;
  themeClass: 's1' | 's2' | 's3';
}

export interface ProcessStep {
  num: string;
  title: string;
  desc: string;
}

export const BRAND = {
  name: 'AFYLLX Digital',
  parentUrl: 'https://afyllx.com/',
  email: 'contact.afyllx@gmail.com',
  kicker: 'Nhận làm website theo yêu cầu',
  h1Lines: ['Website giúp', 'bạn bán hàng', 'và nhận khách'],
  lead: 'AFYLLX Digital làm website cho cửa hàng và dịch vụ của bạn. Bạn xem trước bản mẫu, đặt làm theo nhu cầu, và có người lo vận hành sau khi bàn giao.',
  caption: 'Hình minh họa 3D, không phải website của khách hàng',
};

export const HERO_MODES: HeroMode[] = [
  {
    id: 'ban-hang',
    label: 'Bán hàng',
    url: 'cuahangcuaban.vn',
    title: 'Hàng mới về tuần này',
    cta: 'Đặt hàng',
    phoneTitle: 'Cửa hàng',
    tiles: ['Sản phẩm một', 'Sản phẩm hai', 'Sản phẩm ba'],
    activeTile: 1,
    chip1: ['Đã thêm vào giỏ', 'Sản phẩm hai'],
    chip2: ['Đơn hàng mới', 'Chờ bạn xác nhận'],
  },
  {
    id: 'dich-vu',
    label: 'Dịch vụ',
    url: 'dichvucuaban.vn',
    title: 'Chúng tôi làm gì cho bạn',
    cta: 'Nhận tư vấn',
    phoneTitle: 'Dịch vụ',
    tiles: ['Dịch vụ', 'Hình ảnh', 'Địa chỉ'],
    activeTile: 0,
    chip1: ['Đã gửi yêu cầu', 'Tư vấn dịch vụ'],
    chip2: ['Yêu cầu tư vấn mới', 'Chờ bạn liên hệ lại'],
  },
  {
    id: 'dat-lich',
    label: 'Đặt lịch',
    url: 'lichhencuaban.vn',
    title: 'Chọn giờ bạn muốn',
    cta: 'Đặt lịch',
    phoneTitle: 'Lịch hẹn',
    tiles: ['9:00', '10:30', '14:00'],
    activeTile: 1,
    chip1: ['Đã chọn 10:30', 'Sáng thứ Bảy'],
    chip2: ['Lịch hẹn mới', '10:30 sáng thứ Bảy'],
    isSlots: true,
  },
];

export const SOLUTIONS: SolutionItem[] = [
  {
    id: 'ban-hang',
    need: 'Bán hàng online',
    eyebrow: 'Tôi muốn',
    title: 'bán hàng online',
    description: 'Trưng bày sản phẩm, nhận đơn qua đặt hàng và liên hệ. Dành cho cửa hàng nhỏ.',
    cta: 'Xem website bán hàng',
    href: '/mau/cua-hang',
    big: true,
    blockIndex: 0,
  },
  {
    id: 'dat-lich',
    need: 'Nhận đặt lịch',
    eyebrow: 'Tôi muốn',
    title: 'nhận đặt lịch',
    description: 'Khách chọn dịch vụ và khung giờ ngay trên website. Dành cho dịch vụ cần hẹn giờ.',
    cta: 'Xem website đặt lịch',
    href: '/mau/dat-lich',
    big: true,
    alt: true,
    blockIndex: 1,
  },
  {
    id: 'dich-vu',
    need: 'Giới thiệu dịch vụ',
    eyebrow: 'Tôi muốn',
    title: 'giới thiệu dịch vụ',
    description: 'Cho khách biết bạn làm gì, ở đâu và liên hệ thế nào.',
    cta: 'Xem website dịch vụ',
    href: '/mau/dich-vu',
    blockIndex: 2,
  },
  {
    id: 'landing',
    need: 'Ra mắt sản phẩm',
    eyebrow: 'Tôi muốn',
    title: 'ra mắt sản phẩm',
    description: 'Một trang gọn cho sản phẩm mới, sự kiện hoặc chiến dịch.',
    cta: 'Trao đổi về trang ra mắt',
    href: '#dat-lam',
    blockIndex: 3,
  },
  {
    id: 'quan-ly',
    need: 'Quản lý nội bộ',
    eyebrow: 'Tôi muốn',
    title: 'quản lý nội bộ',
    description: 'Công cụ riêng cho công việc hằng ngày của doanh nghiệp.',
    cta: 'Trao đổi về hệ thống quản lý',
    href: '#dat-lam',
    blockIndex: 4,
  },
];

export const DEMOS: DemoItem[] = [
  {
    slug: 'cua-hang',
    route: '/mau/cua-hang',
    business: 'Gốm Mộc Lam',
    title: 'Cửa hàng gốm',
    subtitle: 'Website bán hàng có giỏ hàng',
    navText: 'Cửa hàng  Giỏ',
    headline: 'Gốm làm tay cho bàn ăn mỗi ngày',
    themeClass: 's1',
  },
  {
    slug: 'dich-vu',
    route: '/mau/dich-vu',
    business: 'NHÀ ÉN',
    title: 'Xưởng nội thất',
    subtitle: 'Website giới thiệu dịch vụ',
    navText: 'Hạng mục  Liên hệ',
    headline: 'Nội thất đóng theo căn nhà của bạn',
    themeClass: 's2',
  },
  {
    slug: 'dat-lich',
    route: '/mau/dat-lich',
    business: 'Chín Giờ',
    title: 'Tiệm tóc',
    subtitle: 'Website nhận đặt lịch',
    navText: 'Đặt lịch',
    headline: 'Chọn giờ, đến là cắt',
    themeClass: 's3',
  },
];

export const PROCESS_STEPS: ProcessStep[] = [
  { num: '01', title: 'Trao đổi', desc: 'Bạn kể mục tiêu và cách đang bán hàng.' },
  { num: '02', title: 'Đề xuất và báo giá', desc: 'Phạm vi công việc và chi phí, bằng văn bản.' },
  { num: '03', title: 'Thiết kế, duyệt mẫu', desc: 'Bạn xem và góp ý trước khi xây.' },
  { num: '04', title: 'Xây dựng, kiểm thử', desc: 'Chạy thử trên điện thoại và máy tính.' },
  { num: '05', title: 'Bàn giao, vận hành', desc: 'Kèm hướng dẫn sử dụng và hỗ trợ sau đó.' },
];
