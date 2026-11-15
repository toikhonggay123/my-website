import { divisions } from '../data.js';

// Nội dung lấy nguyên từ trang chủ hiện tại; không thêm số liệu hay khách hàng.
export const hero = {
  lines: ['Xây nền tảng số', 'cho công việc thực tế'],
  body: 'Công nghệ cho nhà trường, kinh doanh website trực tuyến và chuyển đổi số khu vực công.',
};
export const manifest = 'Một công việc, một cách làm tốt hơn. AFYLLX phát triển theo ba hướng, cùng bắt đầu từ người dùng và công việc thực tế.';
export const stories = [
  { ...divisions[0], headline: ['Công nghệ cho', 'nhịp vận hành', 'nhà trường'], body: 'Từ những công việc mỗi ngày, mở ra cách tổ chức và vận hành thuận tiện hơn.' },
  { ...divisions[1], headline: ['Từ ý tưởng kinh doanh', 'đến một website'], body: 'Định hướng nền tảng kinh doanh website trực tuyến, kết nối nhu cầu với một không gian số có thể đưa vào sử dụng.' },
  { ...divisions[2], headline: ['Hiểu quy trình', 'kiến tạo', 'giải pháp số'], body: 'Định hướng giải pháp chuyển đổi số chính phủ, bắt đầu từ thực tế của từng cơ quan và đơn vị.' },
];
export const approach = [
  { title: 'Hiểu nhu cầu', text: 'Bắt đầu với người thực hiện và công việc họ cần hoàn thành.' },
  { title: 'Xác định phạm vi', text: 'Chọn bài toán, kết quả cần đạt và phần việc nên làm trước.' },
  { title: 'Dựng giải pháp', text: 'Kết nối trải nghiệm, thiết kế và công nghệ trong một sản phẩm.' },
  { title: 'Hoàn thiện', text: 'Quan sát cách sử dụng và tiếp tục cải thiện từ thực tế.' },
];
export const concepts = [
  { id: 'man-sang', name: 'Màn sáng', note: 'Bay dưới những màn cực quang' },
  { id: 'lang-kinh', name: 'Lăng kính', note: 'Cực quang khúc xạ qua khối kính' },
  { id: 'quy-dao', name: 'Quỹ đạo', note: 'Vành cực quang nhìn từ quỹ đạo' },
];
