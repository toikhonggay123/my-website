/** Dữ liệu minh họa của bản mẫu "Gốm Mộc Lam". Không có sản phẩm, giá hay liên hệ nào là thật. */

export type CategoryId = 'chen-bat' | 'ly-tach' | 'binh-hoa' | 'dia';

export type ShapeId =
  | 'bowl'
  | 'bowlWide'
  | 'bowlSmall'
  | 'cup'
  | 'mug'
  | 'tumbler'
  | 'vaseNeck'
  | 'vaseRound'
  | 'plate'
  | 'plateSmall';

export type GlazeId = 'lam' | 'tro' | 'nau' | 'nga' | 'datNung' | 'lamDam' | 'cat';

export interface Glaze {
  label: string;
  body: string;
  inner: string;
  speck: string;
  /** Màu nền ô ảnh sản phẩm. */
  tile: string;
}

export const glazes: Record<GlazeId, Glaze> = {
  lam: { label: 'Men lam', body: '#9fbfae', inner: '#7fa491', speck: '#4f6f60', tile: '#e4e8dc' },
  tro: { label: 'Men tro', body: '#d9d2c2', inner: '#bdb4a1', speck: '#7a6a55', tile: '#e9dfce' },
  nau: { label: 'Men nâu đất', body: '#8a5a3c', inner: '#6d4329', speck: '#3f2616', tile: '#ead9c6' },
  nga: { label: 'Men trắng ngà', body: '#f3ecde', inner: '#ddd3bf', speck: '#9a8468', tile: '#dfd2bd' },
  datNung: { label: 'Đất nung', body: '#c0714a', inner: '#9d5534', speck: '#6e3418', tile: '#efe3d2' },
  lamDam: { label: 'Men lam đậm', body: '#4f7c78', inner: '#3b625f', speck: '#213f3d', tile: '#e2e6da' },
  cat: { label: 'Men đá cát', body: '#c9b79c', inner: '#ab977a', speck: '#6b5840', tile: '#eee7da' },
};

export interface Category {
  id: CategoryId;
  label: string;
}

export const categories: Category[] = [
  { id: 'chen-bat', label: 'Chén bát' },
  { id: 'ly-tach', label: 'Ly tách' },
  { id: 'binh-hoa', label: 'Bình hoa' },
  { id: 'dia', label: 'Đĩa' },
];

export const categoryLabel = (id: CategoryId): string => categories.find((c) => c.id === id)?.label ?? '';

export interface Product {
  id: string;
  name: string;
  category: CategoryId;
  price: number;
  short: string;
  long: string;
  specs: Array<[label: string, value: string]>;
  shape: ShapeId;
  glaze: GlazeId;
  /** Để lộ phần đất mộc ở chân. */
  dip?: boolean;
  /** Thẻ lớn trong lưới sản phẩm. */
  featured?: boolean;
  tag?: string;
  seed: number;
}

export const products: Product[] = [
  {
    id: 'bat-com-men-lam',
    name: 'Bát cơm men lam',
    category: 'chen-bat',
    price: 120000,
    short: 'Lòng sâu vừa một bát cơm đầy. Men lam ngả xanh ngọc, chân để mộc.',
    long: 'Chiếc bát chúng tôi làm nhiều nhất. Thành hơi loe để cầm bằng một tay, chân đế cao cho đỡ nóng. Mỗi mẻ men lên màu đậm nhạt khác nhau một chút.',
    specs: [
      ['Đường kính', '12 cm'],
      ['Cao', '6,5 cm'],
      ['Dung tích', '320 ml'],
      ['Men', 'Men lam tro, nung 1.250°C'],
    ],
    shape: 'bowl',
    glaze: 'lam',
    dip: true,
    featured: true,
    tag: 'Mẻ nung mới',
    seed: 11,
  },
  {
    id: 'to-mi-men-nau',
    name: 'Tô mì men nâu đất',
    category: 'chen-bat',
    price: 210000,
    short: 'Tô rộng miệng cho mì, phở, bún.',
    long: 'Miệng rộng 18 cm, đủ chỗ cho nước dùng và rau. Men nâu đất lì, không bóng, cầm ấm tay.',
    specs: [
      ['Đường kính', '18 cm'],
      ['Cao', '8 cm'],
      ['Dung tích', '900 ml'],
      ['Men', 'Men nâu đất lì'],
    ],
    shape: 'bowlWide',
    glaze: 'nau',
    seed: 23,
  },
  {
    id: 'chen-cham-trang-nga',
    name: 'Chén chấm trắng ngà',
    category: 'chen-bat',
    price: 45000,
    short: 'Chén nhỏ đựng nước chấm, muối tiêu.',
    long: 'Nhỏ, dày, khó mẻ. Bán lẻ từng chiếc để bạn mua đủ số người trong nhà.',
    specs: [
      ['Đường kính', '8 cm'],
      ['Cao', '3,5 cm'],
      ['Dung tích', '70 ml'],
      ['Men', 'Men trắng ngà bóng nhẹ'],
    ],
    shape: 'bowlSmall',
    glaze: 'nga',
    dip: true,
    seed: 37,
  },
  {
    id: 'tach-tra-men-tro',
    name: 'Tách trà men tro',
    category: 'ly-tach',
    price: 85000,
    short: 'Tách không quai, vừa lòng bàn tay.',
    long: 'Thành mỏng ở miệng để uống trà nóng cho dễ, dày dần xuống đáy để giữ nhiệt. Men tro có lốm đốm sắt tự nhiên.',
    specs: [
      ['Đường kính', '7,5 cm'],
      ['Cao', '7 cm'],
      ['Dung tích', '150 ml'],
      ['Men', 'Men tro rơm'],
    ],
    shape: 'cup',
    glaze: 'tro',
    seed: 41,
  },
  {
    id: 'ly-ca-phe-co-quai',
    name: 'Ly cà phê có quai',
    category: 'ly-tach',
    price: 160000,
    short: 'Quai to, lọt hai ngón tay.',
    long: 'Ly dày để cà phê lâu nguội. Quai được gắn tay nên mỗi chiếc lệch nhau đôi chút, đó là chủ ý.',
    specs: [
      ['Đường kính', '8,5 cm'],
      ['Cao', '9 cm'],
      ['Dung tích', '280 ml'],
      ['Men', 'Men lam đậm'],
    ],
    shape: 'mug',
    glaze: 'lamDam',
    seed: 53,
  },
  {
    id: 'coc-cao-men-da-cat',
    name: 'Cốc cao men đá cát',
    category: 'ly-tach',
    price: 140000,
    short: 'Cốc cao cho nước lọc, trà đá.',
    long: 'Dáng thẳng, hơi thắt ở đáy. Mặt men ráp nhẹ như đá cát nên không trơn tay khi cốc đọng nước.',
    specs: [
      ['Đường kính', '7 cm'],
      ['Cao', '12 cm'],
      ['Dung tích', '350 ml'],
      ['Men', 'Men đá cát lì'],
    ],
    shape: 'tumbler',
    glaze: 'cat',
    dip: true,
    seed: 67,
  },
  {
    id: 'binh-co-hep-men-lam',
    name: 'Bình cổ hẹp men lam',
    category: 'binh-hoa',
    price: 320000,
    short: 'Cổ hẹp giữ một hai cành hoa đứng thẳng. Hợp cành khô, cành mai, cúc dại.',
    long: 'Thân bầu, cổ thắt. Bạn chỉ cần một cành là đủ thành một góc bàn. Lòng bình tráng men kín nên đựng nước được lâu.',
    specs: [
      ['Đường kính thân', '13 cm'],
      ['Cao', '19 cm'],
      ['Miệng', '3 cm'],
      ['Men', 'Men lam tro, nung 1.250°C'],
    ],
    shape: 'vaseNeck',
    glaze: 'lam',
    featured: true,
    tag: 'Làm theo mẻ nhỏ',
    seed: 71,
  },
  {
    id: 'binh-tron-dat-nung',
    name: 'Bình tròn đất nung',
    category: 'binh-hoa',
    price: 280000,
    short: 'Thân tròn, miệng rộng cho bó hoa nhỏ.',
    long: 'Mặt ngoài để mộc, chỉ tráng men bên trong. Màu đất sẽ sậm dần theo thời gian dùng.',
    specs: [
      ['Đường kính thân', '16 cm'],
      ['Cao', '16 cm'],
      ['Miệng', '5 cm'],
      ['Men', 'Mộc ngoài, men trong'],
    ],
    shape: 'vaseRound',
    glaze: 'datNung',
    seed: 83,
  },
  {
    id: 'dia-tron-22',
    name: 'Đĩa tròn 22 cm',
    category: 'dia',
    price: 180000,
    short: 'Đĩa chính cho bữa cơm hai món.',
    long: 'Lòng phẳng, vành hơi nhô để giữ nước sốt. Xếp chồng gọn, đáy đã mài nhẵn để không xước bàn.',
    specs: [
      ['Đường kính', '22 cm'],
      ['Cao', '2,5 cm'],
      ['Men', 'Men trắng ngà bóng nhẹ'],
    ],
    shape: 'plate',
    glaze: 'nga',
    seed: 97,
  },
  {
    id: 'dia-lot-tach',
    name: 'Đĩa lót tách men lam',
    category: 'dia',
    price: 70000,
    short: 'Lót tách trà, đựng bánh nhỏ.',
    long: 'Đi cùng tách trà men tro. Dùng riêng làm đĩa bánh, đĩa đựng nhẫn cũng vừa.',
    specs: [
      ['Đường kính', '12 cm'],
      ['Cao', '1,5 cm'],
      ['Men', 'Men lam tro'],
    ],
    shape: 'plateSmall',
    glaze: 'lam',
    seed: 101,
  },
];

export const productById = (id: string): Product | undefined => products.find((p) => p.id === id);

/** 180000 → "180.000 ₫" */
export const formatVnd = (amount: number): string =>
  `${String(Math.round(amount)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')} ₫`;

export const MAX_QTY = 20;

export interface CartLine {
  id: string;
  qty: number;
}
