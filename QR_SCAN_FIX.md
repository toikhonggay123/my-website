# Sửa luồng xác nhận QR — 05/11/2026

Đã tái hiện trường hợp máy chủ xác nhận nhưng điện thoại lệch ngày: bộ lọc ngày phía client giấu cả popup lẫn danh sách vừa quét. Phiên camera mở qua nửa đêm cũng giữ session cũ, khiến lượt tiếp theo bị máy chủ từ chối.

- Dùng thời gian máy chủ và đồng hồ đơn điệu để chọn ngày phiên quét; chuẩn bị lại phiên khi sang ngày mới.
- Hiển thị kết quả theo ngày máy chủ xác nhận; bộ lọc lịch sử đang theo hôm nay tự cập nhật ngày, giữ lựa chọn ngày cũ nếu người dùng chọn riêng.
- Kết quả xác nhận kích hoạt tải lại danh sách ngay. Popup hiển thị ba giây cả khi giảm chuyển động/không có WAAPI.
- Lượt bị từ chối được báo ngay trong camera. Quét lại một lượt đã lỗi không còn báo sai rằng nó vừa được đưa vào hàng đợi; lượt lỗi vẫn giữ để xem xét.

Xác minh trên bản vá riêng: source check, lint, TypeScript, 107 unit tests và production build đạt. HTTP QA trên database riêng kiểm tra ngày phiên, QR, lưu/chống trùng, báo cáo và khôi phục đạt. Luồng React + IndexedDB + API thật trên database QA tái hiện đồng hồ lệch hai ngày, xác minh popup/danh sách/cờ rung chỉ sau ghi nhận, bản ghi đã lưu và thông báo QR lỗi. Chưa kiểm tra camera điện thoại vật lý trong lượt này.

Không đổi khóa hoặc QR đã cấp, không ghi thử điểm danh vào dữ liệu cloud/local đang dùng. Phần danh sách dùng chung đang sửa trong workspace không nằm trong commit bản vá; hai bài kiểm thử backup của workspace đó cần được xử lý cùng migration riêng.
