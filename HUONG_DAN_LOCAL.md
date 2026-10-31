# MealCheck chạy trên máy — 31/10/2026

Địa chỉ: http://localhost:3000/quan-tri

- Bật/mở ứng dụng: bấm `MO_MEALCHECK.cmd` trong thư mục này.
- Tắt server: bấm `DUNG_MEALCHECK.cmd`. Database vẫn được giữ.
- Source đang dùng: thư mục `mealcheck-cloud`. Đây là tên thư mục đã đặt lúc chuẩn bị trước đó; hiện chạy local, không có GitHub remote hay deployment cloud mới.
- Thư mục `mealcheck` là checkout Site cũ, không phải source của bản localhost đang mở.

## Dữ liệu

Đã khôi phục 11 bảng từ bản sao: 34 học sinh thật lớp 9B, 1.000 học sinh demo, 34 token QR và các bản ghi/lịch sử/cấu hình đọc được tại thời điểm sao lưu. Đối chiếu số dòng, hash nội dung và khóa ngoại sau nhập đều đúng. Không ghi đè hoặc xóa dữ liệu Site cũ. Dữ liệu phát sinh trên Site sau lần sao lưu không tự xuất hiện ở local.

Database local thật ở `mealcheck-cloud/.wrangler/local-state`; dấu xác minh nhập ở `mealcheck-cloud/.local-server/data-import.json`. Khi sao lưu, dừng server rồi sao chép cả thư mục database để giữ các file SQLite/WAL. Không chạy lại `initialize-local.mjs` để nhập đè dữ liệu đang dùng.

**Theo lựa chọn của chủ dự án: giữ nguyên QR cũ, bổ sung khóa sau.** Sites không cho đọc lại giá trị secret mã hóa đã lưu. Chưa có khóa nên bản local chưa quét được các thẻ đã phát. Không tạo QR hoặc khóa mới. Khi có đúng khóa, đặt `MEALCHECK_QR_KEY` trong `.dev.vars` trên máy, kiểm tra bằng `scripts/verify-qr-key.mjs` với bản sao riêng, rồi khởi động lại server. Không dán khóa vào chat, source hoặc log.

## Thẻ học sinh ngang

Trong **Thẻ QR học sinh**, chọn khối/lớp rồi bấm **Tải thẻ đã cấp**. Mẫu liquid glass ngang **85,6 × 54 mm** có QR lớn bên trái và thông tin bên phải. Tải lại chỉ đọc đúng QR đã cấp; không sinh khóa hoặc tạo/cấp lại mã. Thẻ chưa có QR được thông báo riêng. Có thể hiển thị/in lại 34 thẻ cũ ngay cả khi chưa bổ sung khóa; quét xác thực vẫn cần đúng khóa gốc.

**Tải thẻ PNG** xuất cả thẻ ở 300 dpi (1011 × 638 px), có metadata kích thước in. **In / Lưu PDF** dùng A4 với thẻ đúng khổ; chọn **100% / Kích thước thực**, tắt đầu trang/chân trang. Muốn giữ màu kính trên bản in, bật **Đồ họa nền**; vùng QR luôn có nền trắng để dễ quét. Kiểm tra thước đo một bản in trước khi in hàng loạt.

Các tính năng Google Sheets đã được bỏ: không còn mục kết nối, import từ Sheets hoặc đồng bộ ra ngoài. Nhập danh sách bằng tệp và xuất CSV/Excel vẫn dùng trên máy.

## Xuất danh sách ngày hôm nay

Trong **Tổng quan**, **Lịch sử điểm danh**, **Báo cáo** và **Chưa điểm danh**, bấm **Xuất danh sách Excel ngày hôm nay**. Tải file `.xls` nhị phân (Excel 97–2003), không phải HTML đổi đuôi.

File gồm `TONG_HOP`, `BUA_SANG`, `BUA_TRUA`, `BUA_TOI`, một trang `LOP_...` cho mỗi lớp và `CHUA_DIEM_DANH`. Có mã, tên, khối, lớp, trạng thái và giờ điểm danh theo từng bữa; giữ mã có số 0 đầu và tiếng Việt. Ngày xuất do máy chủ tính theo giờ Việt Nam, không phụ thuộc bộ lọc lịch sử; xuất toàn bộ môi trường đang chọn. Nút **Excel theo bộ lọc** vẫn xuất `.xlsx` như trước.

Mục **Chưa điểm danh** lọc theo ngày/bữa/lớp hoặc tên/mã. Trạng thái này nghĩa là chưa có bản ghi bữa ăn, không khẳng định học sinh vắng học.

## Đặt lại và khôi phục điểm danh

Trong **Lịch sử điểm danh**, **Đặt lại** mở popup hiển thị ngày và số lượt bị ảnh hưởng. Sau xác nhận, hệ thống tự lưu bản sao điểm danh trước khi xóa cả ba bữa hôm nay trong môi trường đang chọn. Lưu bản sao và xóa dùng cùng một giao dịch: lỗi lưu sẽ hủy đặt lại. Ngày khác, danh sách và QR giữ nguyên.

Nút **Khôi phục sau đặt lại** cho chọn một trong 20 bản sao gần nhất của môi trường đang chọn. Chỉ thêm lượt còn thiếu, giữ các lượt mới đã có, không mở lại yêu cầu chờ duyệt. Mỗi bản sao khôi phục một lần và được ghi nhật ký. Bản sao phục hồi điểm danh được lưu trong database local, không phải bản sao toàn bộ máy; vẫn sao lưu cả thư mục database khi server đã dừng để phòng hỏng/mất ổ đĩa. Lịch sử yêu cầu đã xử lý được giữ làm tham chiếu; yêu cầu chờ được kết thúc khi đặt lại. Các lần đặt lại trước bản sửa này không có bản sao tự động.

Cài đặt đã bỏ công tắc duyệt, thời gian chờ 5 giây và cấp tài khoản cũ. QR dùng thông báo thành công không chặn quét tiếp, có bật/tắt âm báo và toàn màn hình nếu trình duyệt hỗ trợ. Thiết bị có tìm kiếm, nhóm máy quét/thiết bị cũ, phân trang và lần điểm danh gần nhất. Ứng dụng không còn kênh hàng đợi liên tục; cập nhật mỗi 10 giây khi tab hiển thị, dừng khi ẩn và tải lại khi quay về.

## Dùng và sửa bằng tài khoản khác

Đã bỏ hẳn hệ thống đăng nhập và tài khoản giáo viên theo yêu cầu mới. Mở localhost là vào quản trị, không cần cờ mở tạm thời. Người dùng trên cùng máy có quyền mở ứng dụng có thể sử dụng. Tài khoản ChatGPT khác chạy Codex trên chính máy này, mở đúng thư mục source và có quyền tệp thì sửa được. Đăng nhập ChatGPT trên thiết bị khác không tự cấp quyền truy cập máy hoặc source.

Server chỉ nghe `127.0.0.1:3000`. `localhost` trên điện thoại/máy khác trỏ về chính thiết bị đó; muốn dùng qua LAN hoặc từ xa cần cấu hình riêng. Máy chạy server phải bật thì ứng dụng mới hoạt động.

Khi sửa code: dừng ứng dụng → mở thư mục `mealcheck-cloud` → sửa → `pnpm check` → `pnpm build` → mở lại bằng `MO_MEALCHECK.cmd`. Nếu file build đang bị khóa, kiểm tra server đã dừng trước khi dựng lại. Không sửa database hoặc QR secret ngoài yêu cầu đã được duyệt.

## Xác minh đã thực hiện

- Cài dependency từ lockfile; vá Next.js 16.4.1, eslint-config-next 16.4.1, Zod 4.6.6.
- Source check, lint, TypeScript và 47 unit tests: pass.
- Production build: pass.
- Kiểm thử API trên database QA riêng: chuyển hướng, header giả danh, CSRF, QR, chống trùng, cấp lại QR demo, CSV/XLSX: pass. Chỉ ghi vào dữ liệu demo.
- `pnpm audit --prod --audit-level high`: không có advisory đã biết tại thời điểm kiểm tra.
- Thao tác mở → tắt → mở lại server: pass; vẫn đọc được 34 học sinh thật.
- Trình duyệt tại localhost:3000 mở đúng dashboard; đã kiểm tra bố cục desktop và kích thước điện thoại.
- Chưa thử camera vật lý/Android. QR thật chờ khóa cũ; không báo là đã quét thành công.

Các tệp `.dev.vars`, `.wrangler`, `.local-server` và bản sao `.migration-private` chứa cấu hình/dữ liệu riêng; giữ trên máy, không đưa vào source chia sẻ. APK cũ vẫn trỏ tới Site cũ; localhost trên điện thoại không phải máy tính này.
