/**
 * NỘI DUNG GỐC CỦA digital.afyllx.com — nội dung cho giao diện Một Nút.
 *
 * Mọi câu chữ ở đây được chép nguyên văn từ trang đang chạy (audit ngày 18/11/2026,
 * nguồn: mealcheck-cloud/digital-web/phuong-an/{e,dat-lam,quyen-rieng-tu}.html, khớp byte với bản live).
 * Concept được sắp xếp lại, tách dòng, đổi bố cục — KHÔNG được sửa, rút gọn, thêm hay bỏ câu chữ.
 * Câu chữ của trình đặt làm (lựa chọn, lỗi) nằm trong worker/order-schema.mjs.
 */

export const brand = {
  name: 'AFYLLX Digital',
  logo: '/brand/logo.webp',
  logoAlt: '',
  homeAria: 'AFYLLX Digital, về trang chủ',
  color: '#2454c6',
  email: 'contact.afyllx@gmail.com',
  parent: { label: 'Thuộc hệ sinh thái AFYLLX', href: 'https://afyllx.com/' },
  skipLink: 'Bỏ qua tới nội dung',
} as const;

export const seo = {
  home: {
    title: 'AFYLLX Digital — Làm website bán hàng, đặt lịch và giới thiệu dịch vụ',
    description:
      'AFYLLX Digital làm website cho cửa hàng và dịch vụ: bán hàng online, nhận đặt lịch, giới thiệu dịch vụ. Xem bản mẫu chạy thử, đặt làm theo nhu cầu và có người lo vận hành sau bàn giao.',
    canonical: 'https://digital.afyllx.com/',
    og: {
      title: 'AFYLLX Digital — Website giúp bạn bán hàng và nhận khách',
      description: 'Xem bản mẫu chạy thử, đặt làm website theo nhu cầu và có người lo vận hành sau bàn giao.',
    },
  },
  order: {
    title: 'Đặt làm website — AFYLLX Digital',
    description:
      'Mô tả website bạn cần qua 6 bước ngắn: mục tiêu, hiện trạng, chức năng, ngân sách và cách liên hệ. AFYLLX Digital liên hệ lại và gửi báo giá bằng văn bản.',
    canonical: 'https://digital.afyllx.com/dat-lam',
  },
  privacy: {
    title: 'Chính sách quyền riêng tư — AFYLLX Digital',
    description:
      'AFYLLX Digital thu thập thông tin gì khi bạn gửi yêu cầu đặt làm website, dùng để làm gì, lưu ở đâu và cách yêu cầu xóa.',
    canonical: 'https://digital.afyllx.com/quyen-rieng-tu',
  },
  jsonLd: {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'AFYLLX Digital',
    url: 'https://digital.afyllx.com/',
    email: 'contact.afyllx@gmail.com',
    parentOrganization: { '@type': 'Organization', name: 'AFYLLX', url: 'https://afyllx.com/' },
  },
} as const;

/** Thanh điều hướng chính. `hash` là id section trên trang chủ. */
export const nav = {
  label: 'Chính',
  items: [
    { label: 'Giải pháp', hash: 'giai-phap' },
    { label: 'Bản mẫu', hash: 'ban-mau' },
    { label: 'Quy trình', hash: 'quy-trinh' },
    { label: 'Bảng giá', hash: 'bang-gia' },
  ],
  cta: 'Đặt làm website',
  menuOpen: 'Mở menu',
  menuClose: 'Đóng menu',
  themeDark: 'Chế độ tối',
  themeToLight: 'Chuyển sang chế độ sáng',
  themeToDark: 'Chuyển sang chế độ tối',
} as const;

export const hero = {
  /** h1 gồm hai phần; phần sau trên trang gốc được bọc <span> để nhấn. */
  title: { lead: 'Xây dựng website của bạn', accent: 'với quy trình chuyên nghiệp' },
  lead: 'AFYLLX Digital làm website cho cửa hàng và dịch vụ của bạn. Bạn xem trước bản mẫu, đặt làm theo nhu cầu, và có người lo vận hành sau khi bàn giao.',
  primary: { label: 'Đặt làm website' }, // -> trang đặt làm
  secondary: { label: 'Xem bản mẫu', hash: 'ban-mau' },
  family: { label: 'Thuộc hệ sinh thái AFYLLX', href: 'https://afyllx.com/' },
  /** Hình minh họa bốn lớp của một website (trên cùng -> dưới cùng). `layer` 3 là lớp trên cùng. */
  layers: [
    { layer: 3, title: 'Giao diện', text: 'Thứ khách của bạn nhìn thấy và bấm vào' },
    { layer: 2, title: 'Nội dung', text: 'Sản phẩm, dịch vụ, hình ảnh, câu chữ của bạn' },
    { layer: 1, title: 'Chức năng', text: 'Giỏ hàng, đặt lịch, form liên hệ' },
    { layer: 0, title: 'Vận hành', text: 'Tên miền, lưu trữ, sao lưu, cập nhật' },
  ],
  caption: 'Hình minh họa các phần của một website, không phải website của khách hàng',
} as const;

/** Section #giai-phap */
export const solutions = {
  id: 'giai-phap',
  title: 'Bạn muốn website làm việc gì',
  sub: 'Chọn việc gần với bạn nhất. Bốn loại đầu có bản mẫu chạy được để bấm thử.',
  items: [
    { title: 'Bán hàng online', text: 'Trưng bày sản phẩm, nhận đơn qua đặt hàng và liên hệ. Dành cho cửa hàng nhỏ.', link: 'Xem website bán hàng', href: '/mau/cua-hang', demo: { route: '/mau/cua-hang', title: 'Cửa hàng gốm' } },
    { title: 'Nhận đặt lịch', text: 'Khách chọn dịch vụ và khung giờ ngay trên website.', link: 'Xem website đặt lịch', href: '/mau/dat-lich', demo: { route: '/mau/dat-lich', title: 'Tiệm tóc' } },
    { title: 'Giới thiệu dịch vụ', text: 'Cho khách biết bạn làm gì, ở đâu và liên hệ thế nào.', link: 'Xem website dịch vụ', href: '/mau/dich-vu', demo: { route: '/mau/dich-vu', title: 'Xưởng nội thất' } },
    { title: 'Ra mắt sản phẩm', text: 'Một trang gọn cho sản phẩm mới, sự kiện hoặc chiến dịch.', link: 'Xem trang ra mắt', href: '/mau/ra-mat', demo: { route: '/mau/ra-mat', title: 'Trang ra mắt loa không dây' } },
    /** Không có bản mẫu: dẫn tới trang đặt làm với ?loai=quan-ly (chọn sẵn mục tiêu). */
    { title: 'Quản lý nội bộ', text: 'Công cụ riêng cho công việc hằng ngày của doanh nghiệp.', link: 'Trao đổi về hệ thống quản lý', href: null, orderQuery: 'loai=quan-ly', demo: null },
  ],
} as const;

/** Section #ban-mau. Mỗi thẻ mở bản mẫu trong hộp xem (dialog + iframe); Ctrl/⌘/Shift-click mở thẳng. */
export const samples = {
  id: 'ban-mau',
  title: 'Bấm thử trước khi quyết định',
  sub: 'Mỗi bản mẫu là một website chạy được với dữ liệu minh họa, cho một doanh nghiệp không có thật.',
  badge: 'Bản mẫu',
  open: 'Mở bản mẫu',
  items: [
    { slug: 'cua-hang', name: 'Gốm Mộc Lam', desc: 'Website bán hàng có giỏ hàng', route: '/mau/cua-hang', dialogTitle: 'Cửa hàng gốm', image: 'cua-hang' },
    { slug: 'dich-vu', name: 'NHÀ ÉN', desc: 'Website giới thiệu dịch vụ', route: '/mau/dich-vu', dialogTitle: 'Xưởng nội thất', image: 'dich-vu' },
    { slug: 'dat-lich', name: 'Chín Giờ', desc: 'Website nhận đặt lịch', route: '/mau/dat-lich', dialogTitle: 'Tiệm tóc', image: 'dat-lich' },
    { slug: 'ra-mat', name: 'Vọng S1', desc: 'Trang ra mắt sản phẩm', route: '/mau/ra-mat', dialogTitle: 'Trang ra mắt loa không dây', image: 'ra-mat' },
    { slug: 'concert', name: 'Vô Cực', desc: 'Trang giới thiệu concert', route: '/mau/concert', dialogTitle: 'Trang giới thiệu concert', image: 'concert' },
    { slug: 'portfolio-nhiep-anh', name: 'Portfolios', desc: 'Portfolio nhiếp ảnh có thư viện ảnh', route: '/mau/portfolio-nhiep-anh/', dialogTitle: 'Portfolio nhiếp ảnh Trần Minh Quân', image: 'portfolio-nhiep-anh' },
  ],
  /** Ảnh chụp bản mẫu: 960x540, có bản 480w. */
  imageSrc: (image: string, w: 480 | 960 = 960) => `/demo-previews/${image}-${w}.webp`,
  imageSrcSet: (image: string) => `/demo-previews/${image}-480.webp 480w, /demo-previews/${image}-960.webp 960w`,
  dialog: { defaultTitle: 'Bản mẫu website', close: 'Đóng bản mẫu', iframePrefix: 'Bản mẫu: ' },
} as const;

/** Section #quy-trinh */
export const process = {
  id: 'quy-trinh',
  title: 'Năm bước, từ lần trao đổi đầu đến ngày bàn giao',
  steps: [
    { title: 'Trao đổi', text: 'Bạn kể mục tiêu và cách đang bán hàng.' },
    { title: 'Đề xuất và báo giá', text: 'Phạm vi công việc và chi phí, bằng văn bản.' },
    { title: 'Thiết kế, duyệt mẫu', text: 'Bạn xem và góp ý trước khi xây.' },
    { title: 'Xây dựng, kiểm thử', text: 'Chạy thử trên điện thoại và máy tính.' },
    { title: 'Bàn giao, vận hành', text: 'Kèm hướng dẫn sử dụng và hỗ trợ sau đó.' },
  ],
} as const;

/** Section #bang-gia */
export const pricing = {
  id: 'bang-gia',
  title: 'Báo giá theo đúng việc bạn cần',
  sub: 'Chưa có bảng giá cố định. Bạn nhận báo giá bằng văn bản sau khi trao đổi nhu cầu, trước khi bắt đầu làm.',
  factors: [
    { title: 'Loại website và số trang', text: 'Trang giới thiệu gọn, website bán hàng hay hệ thống quản lý có khối lượng khác nhau.' },
    { title: 'Tính năng cần có', text: 'Giỏ hàng, đặt lịch, biểu mẫu, trang quản trị nội dung. Chỉ làm những gì bạn dùng.' },
    { title: 'Vận hành sau bàn giao', text: 'Mức hỗ trợ và cập nhật nội dung bạn cần sau khi website chạy.' },
  ],
  note: 'Báo giá sau khi trao đổi nhu cầu.',
  cta: 'Nhận báo giá',
} as const;

/** Section cuối trang chủ, id="dat-lam" */
export const finale = {
  id: 'dat-lam',
  title: 'Bạn lo việc bán hàng, phần còn lại để chúng tôi',
  /** Đoạn văn có email ở cuối: before + <a mailto>email</a> + after */
  textBefore: 'Mô tả website bạn cần qua sáu bước ngắn, mất vài phút. Chúng tôi liên hệ lại và gửi báo giá bằng văn bản sau khi trao đổi. Bạn cũng có thể viết tới ',
  textAfter: '.',
  steps: ['Mục tiêu', 'Hiện trạng', 'Chức năng', 'Ngân sách, thời điểm', 'Liên hệ', 'Xem lại và gửi'],
  cta: 'Bắt đầu mô tả nhu cầu',
} as const;

export const footer = {
  /** "© 2026 AFYLLX Digital, " + <a>thuộc hệ sinh thái AFYLLX</a> */
  copyright: '© 2026 AFYLLX Digital, ',
  parentLink: 'thuộc hệ sinh thái AFYLLX',
  navLabel: 'Chân trang',
  /** Chân trang trang chủ */
  home: [
    { label: 'Giải pháp', hash: 'giai-phap' },
    { label: 'Bản mẫu', hash: 'ban-mau' },
    { label: 'Bảng giá', hash: 'bang-gia' },
    { label: 'Đặt làm website', page: 'order' },
    { label: 'Quyền riêng tư', page: 'privacy' },
    { label: 'contact.afyllx@gmail.com', mailto: true },
  ],
  /** Chân trang trang đặt làm */
  order: [
    { label: 'Trang chủ', page: 'home' },
    { label: 'Quyền riêng tư', page: 'privacy' },
    { label: 'contact.afyllx@gmail.com', mailto: true },
  ],
  /** Chân trang trang quyền riêng tư */
  privacy: [
    { label: 'Trang chủ', page: 'home' },
    { label: 'Đặt làm website', page: 'order' },
    { label: 'contact.afyllx@gmail.com', mailto: true },
  ],
} as const;

/** Trang /dat-lam — phần khung quanh trình 6 bước (câu chữ trong trình nằm ở shared/OrderWizard.tsx). */
export const orderPage = {
  title: 'Kể cho chúng tôi về website bạn cần',
  lead: 'Sáu bước ngắn, mất vài phút. Bạn chưa cần biết gì về kỹ thuật: cứ chọn điều gần đúng nhất, phần còn lại ta trao đổi sau. Báo giá gửi bằng văn bản sau khi trao đổi nhu cầu.',
  noscript: 'Trang này cần bật JavaScript để chạy. Bạn cũng có thể viết thẳng tới ',
  /** Header trang con: nav dẫn về các section trang chủ, không có nút CTA (trang đặt làm). */
} as const;

/** Trang /quyen-rieng-tu — nguyên văn. Đoạn có liên kết được tách thành mảng phần tử. */
export type Rich = string | { text: string; href: string; external?: boolean; strong?: boolean };
export const privacyPage = {
  title: 'Chính sách quyền riêng tư',
  date: 'Cập nhật ngày 18/11/2026. Áp dụng cho website digital.afyllx.com.',
  summary: [
    { text: 'Tóm tắt:', href: '', strong: true },
    ' chúng tôi chỉ nhận thông tin bạn tự điền khi gửi yêu cầu đặt làm website, chỉ dùng để liên hệ lại với bạn về yêu cầu đó, không bán hay chia sẻ cho bên khác để quảng cáo, và xóa khi bạn yêu cầu.',
  ] as Rich[],
  sections: [
    {
      title: 'Thông tin chúng tôi nhận',
      blocks: [
        { p: ['Khi bạn gửi yêu cầu ở trang ', { text: 'Đặt làm website', href: '@order' }, ', chúng tôi nhận đúng những gì bạn điền:'] as Rich[] },
        {
          ul: [
            'Họ tên; email và/hoặc số điện thoại; kênh bạn muốn được liên hệ.',
            'Tên cửa hàng hoặc doanh nghiệp, nếu bạn điền.',
            'Nhu cầu về website: mục tiêu, những gì bạn đang có, chức năng cần có, ngân sách và thời điểm dự kiến, phần mô tả bạn viết.',
          ],
        },
        { p: ['Chúng tôi không yêu cầu giấy tờ tùy thân, thông tin thanh toán hay dữ liệu nhạy cảm. Xin đừng ghi những thông tin đó vào phần mô tả.'] as Rich[] },
      ],
    },
    {
      title: 'Mục đích sử dụng',
      blocks: [
        { p: ['Thông tin chỉ dùng để liên hệ lại với bạn, trao đổi về nhu cầu, và soạn đề xuất, báo giá cho yêu cầu đó. Chúng tôi không dùng thông tin này để gửi quảng cáo và không chuyển cho bên thứ ba vì mục đích tiếp thị.'] as Rich[] },
      ],
    },
    {
      title: 'Thông tin đi đâu và lưu ở đâu',
      blocks: [
        {
          ul: [
            'Yêu cầu được gửi dưới dạng một email tới hộp thư của AFYLLX (contact.afyllx@gmail.com) thông qua dịch vụ định tuyến email của Cloudflare. Hộp thư do Google (Gmail) cung cấp.',
            'Website này không lưu yêu cầu của bạn vào cơ sở dữ liệu nào.',
            'Khi bạn bấm gửi, địa chỉ IP của bạn được Cloudflare dùng tức thời để giới hạn số lần gửi, nhằm chống gửi tự động hàng loạt. Chúng tôi không ghi địa chỉ IP vào yêu cầu.',
            'Trong lúc bạn điền, tiến độ được giữ tạm trong trình duyệt của chính bạn để lỡ tải lại trang không mất. Phần này không rời khỏi máy bạn, tự xóa khi bạn gửi xong hoặc đóng thẻ trình duyệt.',
          ],
        },
      ],
    },
    {
      title: 'Cookie và công cụ theo dõi',
      blocks: [
        { p: ['Website không dùng cookie theo dõi và không gắn công cụ phân tích hay quảng cáo của bên thứ ba. Các trang chính tải phông chữ trực tiếp từ digital.afyllx.com. Trình duyệt lưu lựa chọn giao diện sáng hoặc tối trên thiết bị của bạn.'] as Rich[] },
        { p: ['Các bản mẫu website (đường dẫn bắt đầu bằng /mau/) chỉ chạy trong trình duyệt của bạn: giỏ hàng, lịch hẹn hay biểu mẫu trong đó không gửi dữ liệu đi đâu.'] as Rich[] },
      ],
    },
    {
      title: 'Thời gian lưu',
      blocks: [
        { p: ['Email yêu cầu được giữ trong hộp thư trong thời gian hai bên trao đổi và thực hiện công việc. Nếu yêu cầu không dẫn tới hợp tác, bạn có thể đề nghị xóa bất cứ lúc nào.'] as Rich[] },
      ],
    },
    {
      title: 'Quyền của bạn',
      blocks: [
        {
          p: [
            'Bạn có quyền được biết, xem, chỉnh sửa, yêu cầu xóa thông tin của mình và rút lại sự đồng ý, theo quy định về bảo vệ dữ liệu cá nhân của Việt Nam (Nghị định 13/2023/NĐ-CP). Để thực hiện, viết tới ',
            { text: 'contact.afyllx@gmail.com', href: 'mailto:contact.afyllx@gmail.com' },
            ' từ email bạn đã dùng, hoặc nêu số điện thoại bạn đã để lại.',
          ] as Rich[],
        },
      ],
    },
    {
      title: 'Thay đổi chính sách',
      blocks: [
        { p: ['Khi cách xử lý thông tin thay đổi, ví dụ thêm nơi lưu trữ hay công cụ mới, trang này được cập nhật trước và ghi lại ngày cập nhật ở đầu trang.'] as Rich[] },
      ],
    },
  ] as { title: string; blocks: ({ p: Rich[] } | { ul: string[] })[] }[],
};

/** Các trang công khai khác trên digital.afyllx.com, giữ nguyên (tĩnh, dùng chung cho mọi concept). */
export const otherPages = [
  { route: '/loi-chuc-20-11', title: 'Lời chúc tri ân 20/11', note: 'Trang sự kiện (dải thông báo trên trang chủ đã hết hạn lúc 18:00 ngày 17/11/2026)' },
] as const;
