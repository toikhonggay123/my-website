export const demoEmail = 'portfolio@example.com';

export const pages = [
  { id: 'home', label: 'Trang chủ' },
  { id: 'about', label: 'Giới thiệu' },
  { id: 'work', label: 'Ảnh tiêu biểu' },
  { id: 'portraits', label: 'Chuyện qua chân dung' },
  { id: 'services', label: 'Dịch vụ' },
  { id: 'contact', label: 'Liên hệ' },
];

export const categories = {
  All: 'Tất cả',
  Street: 'Đường phố',
  Lifestyle: 'Đời thường',
  Portrait: 'Chân dung',
};

const pexels = (author, slug) => ({ author, url: `https://www.pexels.com/photo/${slug}/` });

export const photoCredits = {
  profile: pexels('Annushka Ahuja', 'photographer-looking-at-camera-8114227'),
  location: pexels('Annushka Ahuja', 'man-holding-a-camera-on-the-street-8114142'),
  studio: pexels('Alexandre Canteiro', 'professional-photography-session-in-studio-33406877'),
};

export const projects = [
  { id: 'old-quarter', title: 'Nhịp phố cổ', category: 'Street', width: 1600, height: 1067, previewWidth: 800,
    alt: 'Người bán hoa dắt xe đạp chở đầy hoa qua một phố rợp bóng cây ở Hà Nội',
    credit: pexels('Quang Nguyen Vinh', 'a-person-selling-bouquet-of-flowers-on-the-street-6713231') },
  { id: 'everyday-stories', title: 'Chuyện đời thường', category: 'Lifestyle', width: 1200, height: 1800, previewWidth: 800,
    alt: 'Hai người bạn trò chuyện bên tách cà phê ở bàn ngoài hiên',
    credit: pexels('Việt Anh Nguyễn', 'two-friends-enjoying-coffee-at-outdoor-cafe-32245549') },
  { id: 'morning-light', title: 'Nắng sớm', category: 'Street', width: 1600, height: 1067, previewWidth: 800,
    alt: 'Hai người lớn tuổi chơi cờ bên chiếc bàn màu vàng ngoài trời',
    credit: pexels('Ai Quoc Nguyen', 'retirees-playing-board-game-17880095') },
  { id: 'urban-silence', title: 'Phố lặng', category: 'Street', width: 1600, height: 1067, previewWidth: 800,
    alt: 'Một chiếc xe máy cũ đỗ trước bức tường loang màu có hình vẽ ở Hà Nội',
    credit: pexels('Aleks Michajlowicz', 'motor-scooter-parked-beside-wall-6468231') },
  { id: 'human-pace', title: 'Nhịp người qua phố', category: 'Lifestyle', width: 1600, height: 1280, previewWidth: 800,
    alt: 'Người bán hoa đội nón lá dắt xe đạp trên phố Hà Nội, phía sau là xe buýt xanh',
    credit: pexels('Duc Nguyen', 'street-vendor-with-bicycle-in-hanoi-vietnam-34998623') },
  { id: 'after-rain', title: 'Sau cơn mưa', category: 'Street', width: 1600, height: 898, previewWidth: 800,
    alt: 'Một người lớn tuổi cầm ô đi qua mặt đường ướt trước những căn nhà cũ ở Hà Nội',
    credit: pexels('Hòa Lê Đình', 'elderly-man-walking-in-rainy-hanoi-street-30829086') },
  { id: 'soft-light', title: 'Ánh sáng dịu', category: 'Portrait', width: 1150, height: 1734, previewWidth: 750,
    alt: 'Cô gái mặc áo sáng màu ngồi bên khung cửa gỗ trong ánh sáng tự nhiên',
    credit: pexels('Dang Hong', 'portrait-of-a-young-woman-in-hanoi-s-soft-light-28942236') },
  { id: 'window-light', title: 'Nắng bên cửa sổ', category: 'Portrait', width: 1500, height: 998,
    alt: 'Một chàng trai mặc áo đen nghe điện thoại bên cửa chớp xanh có nắng',
    credit: pexels('Phil Nguyen', 'man-wearing-black-t-shirt-1059689') },
  { id: 'in-bloom', title: 'Hoa cài tóc', category: 'Portrait', width: 1500, height: 1000,
    alt: 'Chân dung ngoài trời của cô gái cài hoa trên tóc',
    credit: pexels('Hồng Quang Official', 'young-woman-in-hanoi-with-flower-accessory-36776785') },
  { id: 'years', title: 'Dấu năm tháng', category: 'Portrait', width: 1600, height: 1200, previewWidth: 800,
    alt: 'Chân dung nghiêng của người đàn ông lớn tuổi đội nón đan ở Lào Cai',
    credit: pexels('Son Hoa Nguyen', 'elderly-man-in-traditional-vietnamese-hat-34152755') },
  { id: 'afternoon', title: 'Một chiều thong thả', category: 'Portrait', width: 1600, height: 1061, previewWidth: 800,
    alt: 'Cô gái mỉm cười và chạm hai ngón tay lên má trong ánh sáng ngoài trời',
    credit: pexels('Dang Hong', 'casual-portrait-of-smiling-woman-outdoors-28942228') },
];

export const services = [
  { id: 'Portrait Photography', title: 'Chụp chân dung', scope: 'Tạp chí / Cá nhân', detail: 'Ảnh chân dung cho cá nhân, người làm sáng tạo và chuyên gia. Tôi cùng bạn chọn bối cảnh, ánh sáng và sắc thái phù hợp với người đứng trước ống kính.' },
  { id: 'Street & Lifestyle', title: 'Ảnh đường phố và đời thường', scope: 'Tư liệu / Đời sống', detail: 'Ảnh cho các bài viết, câu chuyện du lịch và đời sống thường ngày. Tôi quan sát và ghi lại những khoảnh khắc tự nhiên mang nét riêng của từng nơi.' },
  { id: 'Brand Content', title: 'Hình ảnh thương hiệu', scope: 'Chiến dịch / Bộ sưu tập', detail: 'Xây dựng bộ ảnh nhất quán cho chiến dịch, nhận diện thương hiệu, bộ sưu tập và mạng xã hội. Hướng sáng tạo được phát triển từ yêu cầu của từng dự án.' },
  { id: 'Event Coverage', title: 'Chụp ảnh sự kiện', scope: 'Ra mắt / Hội thảo', detail: 'Ghi lại lễ ra mắt, hội thảo và hoạt động thương hiệu, từ chi tiết của không gian đến những khoảnh khắc tự nhiên giữa người tham dự.' },
];

export const process = [
  ['Trao đổi', 'Cùng xác định mục tiêu, đối tượng xem và mục đích sử dụng ảnh.'],
  ['Lên ý tưởng', 'Thống nhất tinh thần hình ảnh, hướng thực hiện và kế hoạch chụp.'],
  ['Chụp ảnh', 'Chụp tại địa điểm đã chọn và dành thời gian cho những khoảnh khắc tự nhiên.'],
  ['Bàn giao', 'Bạn nhận bộ ảnh đã được chọn lọc và chỉnh sửa.'],
];
