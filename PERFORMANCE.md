# Checkpoint và tối ưu luồng quét — 03/11/2026

## Điểm quay lại trước thay đổi

- Commit: `f8024acb216ecbe0367387d98b2ab989e4233f06`.
- Nhánh GitHub/local: `codex/checkpoint-before-scan-tray-20261103`.
- ZIP source trên máy: `.tool-state/checkpoints/MealCheck-before-scan-tray-20261103.zip`.
- SHA-256 ZIP: `1F230B62345AC441308D1C123BEA76540F7D3EA472A60A333EA5112F4D990CD7`.
- ZIP được kiểm tra có 182 mục source, không chứa database, roster, QR token, runtime secret hoặc thư mục riêng. Đây là checkpoint mã nguồn, không phải bản sao dữ liệu.
- Muốn quay lại: review và revert commit thay đổi trên nhánh mới; dừng nếu có xung đột. Không reset/force push hoặc phục hồi dữ liệu để rollback giao diện.

## Phản hồi và danh sách quét

Kết quả chỉ được thêm khi API trả `recorded` hoặc `already`. Popup hiện trong khung ngắm rồi dịch xuống ô **Vừa quét** đặt ngay trên thanh chọn bữa. Camera không bị thay kích thước bởi popup, trạng thái chờ hoặc lỗi. Animation dùng WAAPI với `transform`/`opacity`; không tween blur, kích thước hoặc vị trí layout.

Danh sách và số lượng cập nhật ngay khi xác nhận, độc lập với animation. Khi các kết quả đến dồn dập, chuyển động hiện tại được rút ngắn và hiển thị kết quả mới nhất; mọi kết quả vẫn có trong danh sách. Mở ô Vừa quét hiển thị dialog native, có focus trap, Escape, nút đóng, trở về nút mở và reduced motion. Trong khi đọc danh sách, camera vẫn hiển thị nhưng tạm ngừng giải mã; đóng lại để tiếp tục quét.

Danh sách chỉ ở bộ nhớ của lần mở máy quét hiện tại, lọc theo ngày/bữa, tối đa 1.000 kết quả gần nhất và hiển thị từng nhóm 50 dòng. Mỗi học sinh một dòng cho mỗi bữa; quét lại không tăng số lượng và không đổi một lượt đã ghi nhận thành lỗi. Không lưu tên hoặc token vào localStorage mới. Lịch sử chính thức vẫn nằm trong mục Lịch sử điểm danh.

## Camera và giải mã

- Vùng ảnh được ánh xạ từ khung ngắm qua `object-fit: cover`, cộng khoảng an toàn 8%; không xử lý phần ảnh nằm ngoài khung nhìn khi đã có hình học hợp lệ.
- `requestVideoFrameCallback` dùng khung hình mới; có nhánh dự phòng cho trình duyệt thiếu API. Chỉ một lần giải mã đang chạy, mục tiêu tối đa khoảng 12,5 lần/giây; video vẫn có nhịp riêng. Callback được hủy khi dừng/chuyển camera/rời trang.
- BarcodeDetector được kiểm tra khả năng hỗ trợ. Sau ba lần không tìm thấy mã, thử worker; native treo quá 250 ms sẽ chuyển sang dự phòng. Lỗi load worker vẫn có jsQR dự phòng và đóng decoder không treo lời gọi đang chờ.
- Chuyển quyền sở hữu buffer sang worker thay vì sao chép mỗi lượt; chỉ đọc lại canvas nếu worker thật sự lỗi. Thử đảo màu định kỳ ở worker.
- Đọc QR trên máy không thay thế xác thực AES-GCM, QR đã cấp, thiết bị, phiên, ngày và chống trùng ở máy chủ.

## Tối ưu dùng chung

- Khi đang quét không tải lại dashboard theo từng xác nhận và không polling dashboard nền. Quay lại trang cần thống kê sẽ nạp dữ liệu qua luồng sẵn có.
- Chỉ tải roster ở các mục cần danh sách/bộ lọc. Mục Học sinh/Cài đặt/Thẻ QR không phải chờ dashboard không sử dụng.
- Ghi nhớ kết quả tính khối/lớp và lọc tên thay vì tính lại trên mọi render không liên quan.
- Các yêu cầu đồng bộ đang chạy dùng chung một promise; một đợt gọi dồn chỉ yêu cầu thêm một lượt xử lý hàng đợi, giữ nguyên request ID và quy tắc retry.
- Dùng lại `Intl.DateTimeFormat` cho ngày Việt Nam và báo cáo Excel. Microbenchmark 5.000 lần tính ngày trên máy phát triển: 355 ms → 32 ms. Đây là phép đo formatter, không phải FPS hay tốc độ camera trên điện thoại.

## Kiểm tra

Kiểm tra source, lint, TypeScript, unit tests và build. Test mới bao phủ hình học khung ngắm, callback video/hủy, native miss/timeout, xác nhận đủ điều kiện vào danh sách, chống trùng theo ngày/bữa, giới hạn bộ nhớ, ngắt animation và gom tác vụ đồng bộ. HTTP QA luôn dùng database tạm có cờ `disposableTestDatabase`.

Kết quả ngày 03/11/2026: source/lint/TypeScript và 101/101 unit tests đạt; build local và Cloudflare đạt; HTTP QA trên database tách biệt đạt. Hash danh sách local và QR local khớp checkpoint, vẫn là 34 học sinh và 34 thẻ. Browser chặn kiểm tra chuyển động trực quan tại `http://127.0.0.1:4174/` bằng quyền đã lưu. Triển khai dựa trên kiểm tra kỹ thuật đã đạt; chưa xác nhận trực quan animation hoặc FPS camera trên điện thoại.

Không ghi thử vào cloud/local đang dùng; không đổi schema, QR token, khóa, manifest identity hoặc phân quyền. Cần kiểm tra chuyển động trực quan và camera thật trên điện thoại trước khi khẳng định độ mượt/FPS thực tế.
