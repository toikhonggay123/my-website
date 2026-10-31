# AFYLLX MealCheck — localhost và Cloudflare

Ứng dụng chạy trên máy tại http://localhost:3000/quan-tri và trên Cloudflare. Chủ dự án đã xác nhận thay dữ liệu demo trên cloud bằng danh sách thật, chấp nhận quản trị công khai không đăng nhập và cấp QR mới riêng cho cloud. Xem [CLOUDFLARE_LIVE.md](CLOUDFLARE_LIVE.md) cho cấu hình hiện hành; CLOUDFLARE_DEMO.md chỉ là lịch sử. Source được đồng bộ qua main của toikhonggay123/my-website; dữ liệu, token và khóa không có trong Git. Database local cùng thẻ cũ vẫn giữ nguyên.

Bấm `MO_MEALCHECK.cmd` ở thư mục cha để bật; `DUNG_MEALCHECK.cmd` để tắt. Server chỉ lắng nghe `127.0.0.1`. Đã bỏ hẳn đăng nhập, tài khoản giáo viên và API cấp quyền; mở ứng dụng là vào quản trị. Không dùng danh tính từ header của khách.

## Dữ liệu và QR

Database thật ở `.wrangler/local-state`. Không nhập đè/khởi tạo lại, không dùng làm database test. Giữ `.dev.vars`, `.local-server` và backup riêng trên máy. Không đưa danh sách, token QR, khóa hoặc database vào Git/log.

Đã giữ 34 học sinh và 34 QR cũ. Chờ bổ sung đúng `MEALCHECK_QR_KEY` cũ; không tạo khóa hoặc cấp lại thẻ. Camera thật chưa được kiểm thử với khóa gốc.

## Chức năng hiện tại

- PWA cho Android/iPhone, QR/link cài ngay đầu dashboard và trang `/cai-dat`. Tùy chọn âm/rung/nhớ bữa/giữ sáng lưu trên từng máy. Mất mạng lưu QR mã hóa vào hàng đợi trên máy, chỉ báo thành công sau khi máy chủ xác nhận. Xem [PWA.md](PWA.md) cho cách cài, đồng bộ và giới hạn.

- Giáo viên chọn bữa và quét QR; tự ghi nhận, chống trùng ngày/bữa, thông báo thành công không chặn quét tiếp; âm báo tùy chọn, toàn màn hình nếu trình duyệt hỗ trợ.
- Thẻ học sinh liquid glass ngang 85,6 × 54 mm: QR lớn bên trái, thông tin bên phải; PNG cả thẻ 300 dpi và in theo khổ thẻ. Tải lại thẻ đã cấp không cần khóa, không sinh/cấp lại token; quét vẫn cần khóa gốc.
- Báo cáo, lịch sử và danh sách chưa điểm danh theo ngày/bữa/lớp.
- **Xuất danh sách Excel ngày hôm nay** tạo `.xls` BIFF8 thật, chia trang tổng hợp, ba bữa, từng lớp và chưa điểm danh. Ngày do server tính theo giờ Việt Nam; bỏ qua bộ lọc lịch sử.
- CSV/XLSX theo bộ lọc và nhập danh sách từ tệp vẫn có. Google Sheets đã bỏ hoàn toàn khỏi luồng sử dụng.
- **Đặt lại** hiển thị số lượt, lưu snapshot điểm danh trong cùng giao dịch trước khi xóa. **Khôi phục sau đặt lại** thêm lượt còn thiếu, không ghi đè lượt mới; yêu cầu cũ giữ làm tham chiếu, không mở lại hàng chờ.
- Thiết bị có tìm kiếm, phân trang, nhóm máy quét/thiết bị cũ và lần điểm danh gần nhất. Không tự thu hồi thiết bị.
- Không còn EventSource hàng đợi; chỉ cập nhật số liệu khi tab hiển thị.

Snapshot trước reset không thay thế backup database đầy đủ: dừng server rồi sao chép cả thư mục `.wrangler/local-state` (kể cả WAL). Xem `../HUONG_DAN_LOCAL.md`.

## Kiểm tra và dựng lại

Node 22.22+; pnpm theo packageManager. Dừng bản thật trước khi build:

```powershell
.\Stop-Local.ps1
pnpm check
pnpm build
node scripts/local-qa.mjs
.\Start-Local.ps1
```

QA tự tạo database và khóa QR thử riêng, không đụng dữ liệu thật hoặc `.dev.vars`. Không chạy `initialize-local.mjs` hoặc migration lên database thật. DEPLOYMENT/CONTRIBUTING, CLOUDFLARE_DEMO và ví dụ workflow trong .github/archive là tài liệu lịch sử. CI kiểm tra source, local build, QA và cloud-live build; Workers Builds triển khai bản chính thức theo wrangler.cloud.jsonc. Đây là Workers, không phải Pages. Roster/token được nhập riêng sau xác nhận của chủ dự án; không có trong source/CI. Khóa cloud mới được lưu trong runtime secret; khóa gốc cũ không khôi phục được.
