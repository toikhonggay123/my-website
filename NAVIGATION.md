# Điều hướng và chuyển động giao diện

Menu chính có 7 mục, giữ các tác vụ thường dùng ở đầu: Tổng quan, Quét QR điểm danh, Lịch sử điểm danh, Học sinh, Báo cáo, Cài đặt và Hướng dẫn sử dụng.

- **Lịch sử điểm danh** có hai tab **Đã điểm danh** và **Chưa điểm danh**. Tab đầu giữ bộ lọc khoảng ngày, xuất báo cáo, Đặt lại và Khôi phục. Tab sau tra cứu một ngày/bữa cụ thể.
- **Học sinh** có **Danh sách học sinh** và **Thẻ QR học sinh**. Nhập/sửa danh sách nằm ở tab đầu; tải/in/cấp lại thẻ ở tab sau.
- Trên điện thoại, hai nhóm này vẫn nằm ở thanh điều hướng dưới. Menu Thêm chỉ chứa 7 mục chính.
- Tab con dùng được bằng phím trái/phải, Home/End. URL lưu mục đang mở; tải lại hoặc quay lại/tiến tới vẫn đúng tab. Link cũ `?tab=missing` và `?tab=qrcards` còn hoạt động; link mới dùng `?tab=attendance&view=missing` và `?tab=students&view=qrcards`.

Đầu trang chỉ giữ vị trí hiện tại; đã bỏ ô chọn môi trường, trạng thái kết nối và avatar. Cảnh báo mất mạng và hàng đợi quét của PWA vẫn hoạt động.

Chuyển trang dùng WAAPI 180 ms; popup và tùy chọn camera mở 240 ms, đóng 180 ms; nút phản hồi 140 ms. Chỉ chuyển opacity/transform, không tạo vòng render mỗi khung hình. Menu/hộp xác nhận native giữ cơ chế focus và có chuyển cảnh trên trình duyệt hỗ trợ discrete transitions. Thiết bị bật giảm chuyển động dùng fade 90 ms; chuyển bằng bàn phím không làm nội dung trượt.

Máy quét giữ nguyên quá trình ghi nhận ngay, popup dấu tích và thông tin học sinh trong 3 giây, không chặn lượt tiếp theo. Vệt quét dùng transform thay vì thay đổi vị trí layout. Giao diện giữ chất liệu kính hiện có, không thêm blur động toàn trang. Độ mượt thực tế còn cần đánh giá trên thiết bị Android/iPhone sử dụng tại trường.
