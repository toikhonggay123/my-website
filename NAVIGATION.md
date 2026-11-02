# Điều hướng và chuyển động giao diện

Menu chính giữ 7 mục: Tổng quan, Quét QR điểm danh, Lịch sử điểm danh, Học sinh, Báo cáo, Cài đặt và Hướng dẫn sử dụng.

- **Lịch sử điểm danh** có **Đã điểm danh / Chưa điểm danh**. Giữ bộ lọc, xuất Excel, Đặt lại và Khôi phục.
- **Học sinh** có **Danh sách học sinh / Thẻ QR học sinh**. Nhập/sửa danh sách ở tab đầu, tải/in/cấp lại thẻ ở tab sau.
- Bàn phím trái/phải, Home/End chuyển tab; URL và Back/Forward giữ đúng mục. Link cũ `?tab=missing`, `?tab=qrcards` vẫn hoạt động. Đầu trang không có ô môi trường, trạng thái kết nối hay avatar; cảnh báo offline/hàng đợi PWA vẫn còn.

## Chuyển động đầy đủ

Theo yêu cầu chủ dự án, ưu tiên hiệu ứng nổi bật, không giới hạn ở fade ngắn. Không có mục UI riêng tên “Tối ưu hiệu năng”.

- Trang nhỏ (tối đa 240 phần tử, không có video/canvas/iframe) rời đi bằng một lớp DOM tạm thời; trang dài chuyển trực tiếp để tránh sao chép bảng/thẻ lớn. Trang mới mở theo chiều sâu và overshoot nhẹ trong 620 ms, chỉ tween transform/opacity. Lớp tạm inert, aria-hidden, bỏ ID/name/autofocus, không nhận thao tác, không lưu trữ; tự xóa khi xong hoặc bị ngắt. Thanh điều hướng điện thoại luôn nằm trên lớp chuyển cảnh.
- Nền kính trong menu và tab trượt/morph theo vị trí mục được chọn trong 480 ms, đo lại khi đổi kích thước hoặc mở menu. Không khởi động lại animation nếu hình học không đổi; thao tác liên tiếp tiếp tục từ vị trí đang hiển thị.
- Từ Tổng quan sang Quét QR: khung camera mở bằng perspective/scale, ánh sáng lướt qua, bảng AFYLLX nổi lên rồi hòa vào máy quét trong 760 ms. Không tự xin quyền camera hay chờ hiệu ứng để lưu lượt.
- Popup mở 480–560 ms, đóng 320 ms; menu/hộp xác nhận native 600 ms. Popup sửa/cấp lại có nhãn, giữ focus, Escape để hủy khi không bận và trả focus khi đóng.
- Xác nhận QR giữ dấu tích xanh, tên/lớp/mã trong 3 giây, thêm vòng sáng và dấu tích bật nổi. Lưu lịch sử ngay, không chặn quét tiếp. Các phản hồi liên tiếp không phải chờ hiệu ứng.
- Giảm chuyển động của hệ điều hành dùng fade nhẹ; khi in, lớp chuyển cảnh và nền chọn kính không xuất hiện. Bộ đọc thời gian hỗ trợ cả `ms` và `s`, kể cả CSS đã nén thành `.76s`.

## Mục tiêu màn hình tần số cao

Mục tiêu tối ưu là 144 Hz (khoảng 6,94 ms mỗi khung); không có API web ép/cap tần số quét của màn hình hay CSS/WAAPI. Animation theo đồng hồ thời gian của trình duyệt, không thêm vòng setInterval/RAF để giả lập FPS hoặc làm hiệu ứng chạy nhanh hơn trên màn tần số cao. FPS thực tế phụ thuộc trình duyệt, thiết bị, nhiệt độ và chế độ pin. Camera/giải mã QR tiếp tục có nhịp riêng, không tăng lên 144 fps.

Đã bỏ blur động trên toàn trang/modal và clip-path động của khung scanner; giữ kính ở các mặt nhỏ, chuyển động 3D và độ nảy. Snapshot không chạy backdrop blur. Bài kiểm thử kiểm soát chi phí sao chép và thuộc tính animation; đây không phải phép đo 144 fps trên điện thoại. Xem [MDN](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame) và [hướng dẫn animation của Chrome](https://web.dev/articles/animations-guide).

## Checkpoint

Checkpoint trước hiệu ứng đầu tiên: `bf1ec6ec821d0b7cf0fc4a976908f856538377df`, nhánh `codex/checkpoint-before-scanner-popup-20261102` trên GitHub. ZIP cùng mốc nằm trong `.tool-state/checkpoints/MealCheck-before-scanner-popup-20261102.zip` trên máy chủ dự án. Dùng commit revert theo thứ tự mới nhất trước; dừng nếu có xung đột. Không reset/force push main, không ghi đè database hoặc QR.


## Trang chủ gọn trên điện thoại

Header Hôm nay/ngày và tổng học sinh/lớp, một nút Quét QR nổi bật, ba ô bữa trên cùng một hàng. Chạm bữa để xem số chưa điểm danh; Xem danh sách mở đúng bữa và ngày đang hiển thị. Bữa chọn được ghi vào tùy chọn ngày hiện tại của thiết bị, dùng lại khi vào máy quét; không tự chọn theo giờ. Theo lớp mặc định thu gọn, mở ra danh sách dọc, không dùng bảng kéo ngang. Xuất Excel hôm nay nằm trong menu phụ của header và dùng đường xuất cũ.

Liên kết cài app ở gần đầu trang mở QR/hướng dẫn khi cần; ẩn trong PWA standalone hoặc sau sự kiện appinstalled. Trang /cai-dat vẫn có hướng dẫn đầy đủ. Trình duyệt thường không luôn biết app đã cài ở một ngữ cảnh khác. Không thay schema, danh sách, khóa hoặc QR.
