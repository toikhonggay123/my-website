export const contactEmail = 'contact.afyllx@gmail.com';

export const divisions = [
  {
    id: 'edu', number: '01', name: 'Edu', fullName: 'AFYLLX Edu', category: 'Giáo dục', status: 'Đã triển khai',
    title: 'Công nghệ cho vận hành nhà trường.',
    description: 'Phát triển các công cụ số từ những công việc lặp lại hằng ngày trong nhà trường.',
    focusTitle: 'Bắt đầu từ một ngày ở trường.',
    focus: 'AFYLLX Edu tập trung vào những tác vụ diễn ra mỗi ngày, nơi giáo viên và người quản lý cần ghi nhận thông tin nhanh và tra cứu thuận tiện.',
    audience: 'Ban giám hiệu, giáo viên và các bộ phận vận hành nhà trường.',
    next: 'Tìm hiểu các công cụ hiện có tại cổng AFYLLX Edu hoặc trao đổi một nhu cầu cụ thể của trường.',
    action: 'Đến cổng AFYLLX Edu', destination: 'https://edu.afyllx.com/',
  },
  {
    id: 'digital', number: '02', name: 'Digital', fullName: 'AFYLLX Digital', category: 'Kinh doanh trực tuyến', status: 'Chưa triển khai',
    title: 'Nền tảng kinh doanh website trực tuyến.',
    description: 'Định hướng một nơi để tìm giải pháp website, đặt làm và đưa website vào sử dụng.',
    focusTitle: 'Từ mục tiêu kinh doanh đến website.',
    focus: 'AFYLLX Digital dự kiến bắt đầu từ mục tiêu của khách hàng, như bán hàng, giới thiệu dịch vụ hay nhận lịch hẹn. Từ đó xác định loại website, phạm vi công việc và cách vận hành sau khi bàn giao.',
    audience: 'Cá nhân và doanh nghiệp cần đưa hoạt động kinh doanh lên website.',
    next: 'Chia sẻ mục tiêu và cách bạn đang bán hàng hoặc phục vụ khách. Thông tin này giúp AFYLLX xác định phạm vi cần phát triển trước.',
    action: 'Trao đổi nhu cầu website', destination: '/lien-he?chu-de=digital',
  },
  {
    id: 'gov', number: '03', name: 'Gov', fullName: 'AFYLLX Gov', category: 'Khu vực công', status: 'Chưa triển khai',
    title: 'Kiến tạo giải pháp chuyển đổi số chính phủ.',
    description: 'Định hướng phát triển giải pháp số từ quy trình thực tế của cơ quan và đơn vị khu vực công.',
    focusTitle: 'Làm rõ quy trình trước khi số hóa.',
    focus: 'AFYLLX Gov dự kiến bắt đầu bằng việc khảo sát ai thực hiện từng bước, thông tin đang chuyển qua đâu và kết quả được kiểm tra thế nào. Những thông tin đó giúp chọn một phần việc phù hợp để xây mẫu thử.',
    audience: 'Cơ quan và đơn vị khu vực công đang xác định nhu cầu chuyển đổi số.',
    next: 'Chia sẻ một quy trình cần cải thiện và kết quả bạn muốn đo khi thử giải pháp.',
    action: 'Trao đổi nhu cầu chuyển đổi số', destination: '/lien-he?chu-de=gov',
  },
];

export const topics = [
  ...divisions.map(({ id, fullName }) => ({ id, name: fullName })),
  { id: 'hop-tac', name: 'Hợp tác chung' },
];
