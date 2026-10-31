# Xác minh và bàn giao source — 31/10/2026

## Màn quét theo ảnh tham chiếu — 31/10/2026

- Mobile dùng camera toàn trang, khung vuông bo góc, AFYLLX MealCheck, thanh kính chọn bữa/đổi camera/lịch sử và ba tác vụ ảnh/camera/thẻ học sinh. Desktop giữ sidebar quản trị. Camera và fullscreen nằm trong tùy chọn góc trên; flash chỉ bật khi track hỗ trợ.
- Giữ popup tick xanh animation + họ tên/lớp/mã, 3 giây ngay giữa khung; ghi nhận ngay, không khóa quét tiếp. Không đổi luồng xác thực QR, offline pending, chống trùng hay cơ sở dữ liệu.
- `pnpm check` (58 tests, lint/TypeScript), local/cloud builds và QA HTTP riêng: PASS. Hash 34 học sinh/34 QR local giữ nguyên.
- Visual/interaction QA vẫn BLOCKED: Browser use báo disabled kể cả sau khi người dùng gắn @Browser; không có screenshot của bản mới. Xem design-qa.md. Chủ dự án sau đó chỉ định tiếp tục GitHub và link Cloudflare hiện tại; kết quả build/deploy không được gọi là visual pass. Chưa thử camera/flash/rung/wake lock trên điện thoại thật.

## Hướng dẫn, Excel và popup trong camera — 31/10/2026

- Thêm menu Hướng dẫn sử dụng và đường dẫn `/quan-tri?tab=guide`; nội dung cho giáo viên gồm cài PWA, quét, chờ offline, lịch sử/báo cáo, in/cấp lại thẻ, quản lý danh sách/thiết bị và reset/khôi phục.
- Báo cáo ngày BIFF8 `.xls` đổi tên các trang sang tiếng Việt, nhóm cột theo bữa, tiêu đề/ngày dd/mm/yyyy, màu/viền, dòng tổng, chiều cao dòng và cố định 7 dòng đầu. Kiểm thử đọc lại chữ Việt, mã số 0 đầu, chống công thức, tổng số học sinh đang theo dõi và lượt của học sinh đã ngừng theo dõi. API QA xuất đủ 1.000 học sinh giả lập.
- Popup xác nhận chuyển vào chính vùng camera: tick xanh có animation, kính mờ, họ tên/lớp/mã, tự ẩn 3 giây; không trì hoãn ghi nhận hay khóa camera. Trùng có màu vàng và không thêm suất; offline vẫn chỉ pending cho tới server ack.
- Bỏ bốn công tắc âm/rung/nhớ bữa/giữ sáng. Tự bật tiện ích, bỏ qua các cờ tắt cũ; chỉ khôi phục bữa đã lưu đúng ngày. Rung/giữ sáng/âm thanh phụ thuộc nền tảng; chuẩn bị âm thanh khi người dùng mở camera/chọn ảnh.
- `pnpm check`: lint, TypeScript và 58 tests PASS. Build local và QA HTTP riêng PASS. Không ghi thử lên database thật; hash 34 học sinh và 34 QR local không đổi.
- Đã mở mẫu Excel có dữ liệu giả trong Microsoft Excel để xem tiêu đề/nhóm cột/màu; lần cuối sửa thêm chiều cao dòng và bỏ chọn nhiều sheet được kiểm tra bằng đọc BIFF8. Điều khiển UI sau đó bị dừng bằng Escape, nên chưa kiểm tra trực quan trang hướng dẫn/popup cuối hoặc quét camera điện thoại thật. Không suy ra kiểm thử thiết bị thật từ build/unit/API tests.

## PWA Android/iOS — 31/10/2026

- 56 tests, lint, TypeScript, build local/cloud và QA HTTP riêng: PASS. Manifest/icon/Apple metadata, safe-area và QR cài app được thêm; app không đổi database/khóa/QR hiện tại.
- UI QA dùng 1.000 học sinh giả: đã kiểm tra pending IndexedDB khi tắt máy chủ, không có tick thành công; khôi phục kết nối làm đúng một lượt tăng (4 → 5), pending được xóa. Tải lại shell khi máy chủ tắt và cập nhật service worker qua nút trong app: PASS.
- Kiểm tra viewport 390×844 và 412×915, trang cài Android/iPhone không tràn ngang; icon/manifest/viewport metadata đúng. QR/link cài ở trên nội dung dashboard.
- API và POST không đi vào Cache API; precache chỉ gồm shell HTML không có roster và asset công khai có hash. Hàng đợi không lưu tên hoặc khóa, chỉ ciphertext và metadata yêu cầu; ack chỉ sau server xác thực. Giữ nguyên ID khi gửi lại, 4xx giữ lỗi để kiểm tra.
- Chưa cài PWA, thử camera/rung/wake lock trên điện thoại Android/iPhone thật. Không gọi đó là kiểm thử thiết bị thật. Chi tiết vận hành trong PWA.md.

## Chuyển Cloudflare sang dữ liệu thật — 31/10/2026

- Chủ dự án xác nhận nhập file danh sách thật lên Cloudflare, chấp nhận quản trị công khai không đăng nhập và cho phép QR mới dùng ngay. Khóa gốc cũ không có bản sao; khóa demo được thay bằng khóa live mới, không ghi ra file hoặc Git.
- Đã kiểm tra 34 dòng, không trùng mã, khớp 34 học sinh local. Chỉ nhập mã, họ tên, khối và lớp; không nhập các cột thông tin riêng khác. Không có giá trị roster trong commit.
- Tạo D1 live tách riêng; áp schema đã rà soát; nhập roster và 34 QR mã hóa đã kiểm tra giải mã trước khi lưu. Đối chiếu toàn bộ giá trị nhập/QR trên D1 khớp bản chuẩn bị. Không tạo điểm danh thử cho học sinh thật.
- Sau khi chuyển Worker sang cloud-live: xác minh qua API 34 học sinh, 34 QR ổn định không thiếu/trùng, 0 điểm danh test; từ chối demo/seed/QA endpoint; xuất hôm nay lấy dữ liệu live. Database demo cũ đã xóa.
- 52 tests, lint, TypeScript và source checks PASS; local/cloud build và QA riêng được kiểm tra trước bàn giao. Cookie live tách khỏi cookie demo cũ; không thay đổi kiểm tra thu hồi.
- Localhost và 34 QR cũ được giữ, không nhập đè database local. Mẫu thẻ ngang/PNG/in hiện có được giữ nguyên. Camera vật lý chưa thử; thao tác tải Excel trên trình duyệt bản cuối chưa thử vì điều khiển trình duyệt đang tắt.
- Cấu hình hiện hành: CLOUDFLARE_LIVE.md. Các đoạn bên dưới lưu kết quả các lần bàn giao trước.

Repository đích được chủ dự án xác nhận: https://github.com/toikhonggay123/my-website, nhánh `main`. Đây là lần bàn giao source đầu tiên; trước đó local chưa có commit hoặc remote.

## Kiểm tra ứng dụng

| Phần | Kết quả |
|---|---|
| Source check, lint, TypeScript, 47 unit tests | PASS |
| Production build | PASS |
| API trên database QA mới, tách biệt | PASS: QR, chống trùng, cấp lại thẻ demo, thẻ đã cấp, CRUD học sinh, thu hồi thiết bị, nhật ký, bộ lọc, CSV/XLSX/XLS, reset/restore, CSRF và bỏ đăng nhập giáo viên |
| Lưu QR tức thời | PASS: hai học sinh liên tiếp cùng thời điểm trong unit test; hai ảnh QR liên tiếp trên UI xuất hiện ngay trong lịch sử. Không đếm ngược hoặc khóa chờ; thông báo thành công không chặn thao tác |
| Giao diện học sinh | PASS: thêm, sửa, khóa mã khi chỉnh sửa, vô hiệu hóa và kích hoạt lại trên QA |
| Nhập danh sách | PASS: CSV tiếng Việt có dấu phẩy trong tên, XLSX và từ chối CSV lỗi |
| QR trên giao diện | PASS: quét ảnh, tên/mã/lớp, quét trùng không tăng suất, từ chối QR sai, bật/tắt âm báo, vào/thoát toàn màn hình |
| Đặt lại/khôi phục trên giao diện | PASS: Hủy nhận focus mặc định; đặt lại và khôi phục 3 lượt giả lập. Test backend xác nhận không ghi đè lượt mới, không khôi phục hàng chờ |
| Thiết bị, nhật ký | PASS: tìm kiếm, nhóm thiết bị, phân trang, thu hồi và ghi nhật ký trên QA |
| Chưa điểm danh, báo cáo | PASS: học sinh đã ăn sáng bị loại khỏi danh sách thiếu sáng, vẫn có trong bữa trưa; bộ lọc lớp, tên/mã, 7 ngày và biểu đồ ba bữa |
| Thẻ ngang | PASS: đọc lại 40 thẻ QA và 34 thẻ thật; không thay token. Mẫu 85,6 × 54 mm; kiểm tra màn hình nhỏ không tràn. PNG 1011 × 638, metadata 300 dpi và QR đọc lại đúng đã được xác minh |
| Dependency audit | Không có advisory đã biết ở mức kiểm tra production hiện tại |
| Chốt kiểm thử | PASS: HTTP tests từ chối bản thật trước mọi thao tác ghi. Công cụ xóa cookie phiên QA chỉ bật trên database thử; endpoint này trả 404 ở bản thật |
| Dữ liệu thật | Đối chiếu hash students/student_qr/attendance/requests trước và sau: không đổi; 34 học sinh, 34 thẻ |

Đã sửa lỗi xuất CSV/XLSX theo bộ lọc bỏ qua ô tìm tên/mã. Xuất `.xls` hôm nay vẫn chủ ý xuất toàn bộ môi trường đang chọn, dùng ngày Việt Nam.

## Giới hạn kiểm tra

- Chưa thử camera vật lý, Android/APK và máy in thật. Nút in/PDF và CSS kích thước đã được kiểm tra; không khẳng định đã in thử trên giấy.
- Quét 34 thẻ thật vẫn cần đúng khóa QR gốc chưa được bổ sung. Không tạo khóa thay thế hoặc cấp lại thẻ thật.
- Toàn bộ thao tác ghi trong kiểm thử diễn ra trên SQLite QA với học sinh/khóa giả lập, không dùng database thật.

## Git và Cloudflare

Chỉ source được phép đưa lên GitHub. `.dev.vars`, `.wrangler`, `.local-server`, `.tool-state`, database, backup, roster riêng và khóa ký APK bị loại bởi `.gitignore`; staged snapshot và lịch sử commit phải được Gitleaks kiểm tra trước push. Không force push.

Runtime hiện cấu hình cho localhost/Cloudflare Workers với D1; chưa có cấu hình Cloudflare Pages hoàn chỉnh và chưa có binding/database cloud đã xác minh. API giữ giới hạn localhost. Push source không chứng nhận một website Internet đã chạy. Cloudflare hướng dẫn [Vinext triển khai lên Workers](https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/); Pages Advanced Mode cần output `_worker.js` theo [tài liệu Pages](https://developers.cloudflare.com/pages/functions/advanced-mode/).

Các workflow Worker production/preview cũ được giữ tại `.github/archive` dạng văn bản, không tự chạy. CI kiểm tra source/build/QA vẫn bật trên `main`. Không provision cloud, nhập dữ liệu hoặc thay cấu hình Site cũ trong lần bàn giao này.

## Rà soát trước commit

### Bổ sung bản demo Cloudflare — 31/10/2026

- Chủ dự án đã xác nhận bật Cloudflare chỉ với dữ liệu demo, tạo D1 mới và QR key riêng cho demo; giữ toàn bộ dữ liệu thật/khóa gốc trên máy. Hạn chế local-only trước đó được giữ cho dữ liệu thật.
- Worker `my-website` tại https://my-website.fyllxestonia.workers.dev/quan-tri đã triển khai qua cấu hình demo riêng. Lỗi cũ do Cloudflare bỏ bước build và chạy raw Wrangler trên virtual entry của Vinext. Đã lưu build command `pnpm check && pnpm build:demo`, deploy command `pnpm deploy:demo`.
- Source check, lint, TypeScript, 50 unit tests, local build, HTTP QA riêng và demo build: PASS.
- HTTP trên cloud demo: PASS — xác minh demoOnly trước mọi ghi; 1.000 mã TEST giả lập; QR/key demo; hai lượt liên tiếp và chống trùng; reset/restore; từ chối live và nhập/sửa roster; CSRF; ngày hôm nay do server tính; workbook `.xls` BIFF8 đầy đủ các trang.
- Phát hiện Cloudflare 1102 khi server tạo workbook 1.000 học sinh. Bản cloud chuyển sang trang `/xuat-excel`, tải JSON hôm nay rồi tạo cùng file BIFF8 trong trình duyệt. Endpoint `.xls` local giữ nguyên. Test xác minh chuyển hướng cloud, JSON ngày server và workbook generator; chưa bấm tải bản sửa cuối trên trình duyệt vì người dùng đã tắt Local browser use. Không khẳng định đã kiểm thử thao tác tải file cuối trên UI.
- Trước bản sửa Excel cuối, đã kiểm tra dashboard cloud hiển thị demo/1.000 học sinh; không có môi trường chính thức hoặc nút nhập/sửa danh sách. Camera vật lý, Android và máy in vẫn chưa kiểm thử.
- GitHub API đã xác minh `SucVatHoaThan` có quyền Write sau lời mời được chủ dự án xác nhận.
- Các mục Git/Cloudflare ở trên mô tả lần bàn giao local đầu tiên; tài liệu triển khai hiện hành là `CLOUDFLARE_DEMO.md`.

- Gitleaks 8.30.1 từ bản phát hành chính thức, đối chiếu SHA256 trước khi chạy.
- Scan staged snapshot: 152 tệp source, khoảng 610 KB; không phát hiện bí mật.
- Gate tên tệp: không có `.dev.vars`, database, `.wrangler`, backup, `.local-server`, `.tool-state`, APK hoặc khóa ký trong index.
- `git diff --cached --check`: PASS sau khi bỏ một dòng trống thừa ở cuối `app/qr-panel.tsx`.
- Repository đích trống tại lúc đối chiếu; không có merge conflict. Lịch sử commit được quét lại trước push, chỉ sử dụng push không force.
