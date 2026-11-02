# Điều hướng và chuyển động giao diện

Menu chính giữ 7 mục: Tổng quan, Quét QR điểm danh, Lịch sử điểm danh, Học sinh, Báo cáo, Cài đặt và Hướng dẫn sử dụng.

- **Lịch sử điểm danh** có **Đã điểm danh / Chưa điểm danh**. Giữ bộ lọc, xuất Excel, Đặt lại và Khôi phục.
- **Học sinh** có **Danh sách học sinh / Thẻ QR học sinh**. Nhập/sửa danh sách ở tab đầu, tải/in/cấp lại thẻ ở tab sau.
- Bàn phím trái/phải, Home/End chuyển tab; URL và Back/Forward giữ đúng mục. Link cũ `?tab=missing`, `?tab=qrcards` vẫn hoạt động. Đầu trang không có ô môi trường, trạng thái kết nối hay avatar; cảnh báo offline/hàng đợi PWA vẫn còn.

## Chuyển động đầy đủ

Theo yêu cầu chủ dự án, ưu tiên hiệu ứng nổi bật, không giới hạn ở fade ngắn. Không có mục UI riêng tên “Tối ưu hiệu năng”.

- Trang cũ rời đi bằng một lớp ảnh DOM tạm thời; trang mới mở theo chiều sâu, blur và overshoot nhẹ trong 620 ms. Lớp tạm inert, aria-hidden, bỏ ID/name/autofocus, không nhận thao tác, không lưu trữ; tự xóa khi xong hoặc bị ngắt. Thanh điều hướng điện thoại luôn nằm trên lớp chuyển cảnh.
- Nền kính trong menu và tab trượt/morph theo vị trí mục được chọn trong 480 ms, đo lại khi đổi kích thước hoặc mở menu.
- Từ Tổng quan sang Quét QR: khung camera mở bằng perspective và clip-path, ánh sáng lướt qua, bảng AFYLLX nổi lên rồi hòa vào máy quét trong 760 ms. Không tự xin quyền camera hay chờ hiệu ứng để lưu lượt.
- Popup mở 480–560 ms, đóng 320 ms; menu/hộp xác nhận native 600 ms. Popup sửa/cấp lại có nhãn, giữ focus, Escape để hủy khi không bận và trả focus khi đóng.
- Xác nhận QR giữ dấu tích xanh, tên/lớp/mã trong 3 giây, thêm vòng sáng và dấu tích bật nổi. Lưu lịch sử ngay, không chặn quét tiếp. Các phản hồi liên tiếp không phải chờ hiệu ứng.
- Giảm chuyển động của hệ điều hành dùng fade nhẹ; khi in, lớp chuyển cảnh và nền chọn kính không xuất hiện. Bộ đọc thời gian hỗ trợ cả `ms` và `s`, kể cả CSS đã nén thành `.76s`.

## Checkpoint

Checkpoint trước hiệu ứng đầu tiên: `bf1ec6ec821d0b7cf0fc4a976908f856538377df`, nhánh `codex/checkpoint-before-scanner-popup-20261102` trên GitHub. ZIP cùng mốc nằm trong `.tool-state/checkpoints/MealCheck-before-scanner-popup-20261102.zip` trên máy chủ dự án. Dùng commit revert theo thứ tự mới nhất trước; dừng nếu có xung đột. Không reset/force push main, không ghi đè database hoặc QR.
