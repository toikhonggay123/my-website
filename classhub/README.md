# AFYLLX ClassHub

Ứng dụng quản trị lớp học chạy trên máy. Dùng khóa học để tạo lớp, ghi danh học viên, phân công giáo viên, tạo buổi học từ lịch lặp và ghi điểm danh trong ClassCheck.

## Chạy trên Windows

Yêu cầu Node.js 24 và pnpm 11.25. Mở PowerShell tại thư mục `classhub`.

```powershell
pnpm install --frozen-lockfile
pnpm setup:local
pnpm build
pnpm start
```

Mở [ClassHub trên localhost](http://127.0.0.1:5174/) để vào thẳng quản trị. Dùng đúng địa chỉ này để kiểm tra nguồn yêu cầu khớp cấu hình. Dừng bằng Ctrl+C. Có thể dùng `pnpm dev` thay cho `pnpm start` khi sửa giao diện.

1. Đổi tên đơn vị trong **Thiết lập** nếu cần.
2. Thêm khóa học ở **Khóa học**, tạo lớp ở **Lớp học** và thêm hồ sơ giáo viên ở **Nhân sự**.
3. Trong lớp, ghi danh học viên, phân công giáo viên và mở **Lịch & điểm danh** để tạo lịch lặp hoặc buổi riêng. Chọn **Tạo các buổi học** để sinh lịch theo khoảng ngày.
4. Mở buổi đã tới giờ bắt đầu để lưu nháp hoặc chốt điểm danh. Xem số liệu và tải CSV ở **Báo cáo**. Khi cần sửa, mở lại điểm danh và ghi lý do trước khi chốt lại.

## Kiểm tra

```powershell
pnpm check
pnpm test:e2e
pnpm audit --prod --audit-level moderate
```

E2E dùng Microsoft Edge trên Windows, Chromium trên hệ khác và Worker mô phỏng tại cổng 5175–5178. Cài Chromium với `pnpm exec playwright install chromium` nếu máy ngoài Windows chưa có. Mỗi chế độ E2E dùng một D1 tạm riêng. Kịch bản danh sách chung dùng nguồn MealCheck giả lập tại cổng 5180.

## Dữ liệu và vận hành

D1 local nằm trong `.wrangler/state`, tách biệt với MealCheck. `pnpm setup:local` chạy các migration còn thiếu và thiết lập quản trị trên máy. Khi cơ sở dữ liệu trống, lệnh tạo **Đơn vị của tôi** và **Cơ sở chính**. Dừng ClassHub trước khi sao lưu cả `.wrangler/state` và giữ riêng bản sao `.dev.vars`. Để kiểm tra phục hồi, chép chúng vào môi trường ClassHub local khác, đặt lại origin riêng nếu đổi cổng, rồi xác minh truy cập, số lớp và một báo cáo đã chốt. Dùng dữ liệu hư cấu trong thư mục kiểm thử.

Build Worker và tài nguyên tĩnh ở `dist/`. Tệp cấu hình sinh ra dùng D1 giả lập và Worker local. Giữ `.dev.vars` và bản sao trong thư mục build ở môi trường riêng tư. Chế độ quản trị trên máy chỉ dùng với loopback. Triển khai pilot cần Worker/D1 riêng, xác thực tài khoản, cấu hình HTTPS, bí mật quản lý bên máy chủ, thử phục hồi trên staging và quy trình cấp lại quyền truy cập. Theo dõi `GET /api/health` và lỗi 5xx khi có môi trường staging. Xem [kế hoạch và giới hạn](docs/DEVELOPMENT_PLAN.md) trước khi dùng với hồ sơ thật.

### Danh sách chung với MealCheck web

MealCheck web giữ danh sách gốc. ClassHub lấy học sinh và lớp sinh hoạt về khi mở danh sách, rồi giữ liên kết ổn định để dùng trong lịch học và điểm danh. **Học viên** cho phép thêm hoặc sửa học sinh chung; **Thiết lập → Lớp sinh hoạt chung** cho phép thêm hoặc đổi tên lớp. Lớp theo khóa học vẫn quản lý riêng trong ClassHub. Khi mất kết nối, danh sách đã tải vẫn dùng được; cần có mạng để sửa dữ liệu chung.

Sau khi MealCheck web có API danh sách chung, chạy `pnpm db:local` và đặt `MEALCHECK_DIRECTORY_ORIGIN=https://my-website.fyllxestonia.workers.dev`, `MEALCHECK_DIRECTORY_ORG_ID` và `MEALCHECK_DIRECTORY_KEY` trong `.dev.vars` riêng của ClassHub. Giá trị khóa phải khớp secret cùng tên của Worker MealCheck. Khởi động lại ClassHub sau khi thay cấu hình. Dữ liệu QR và các lượt ăn không truyền qua kết nối này.

## Bản web

Gateway AFYLLX Edu chuyển `/classhub` và các đường dẫn con tới Worker `afyllx-classhub`. Cloudflare D1 `afyllx-classhub-live` lưu tài khoản, lịch học và chuyên cần. Tài khoản quản trị kích hoạt bằng mã mời một lần. Khi tạo đơn vị từ mã mời đã cấp cho bản web, ClassHub dùng danh sách chung của MealCheck qua service binding.

Build từ thư mục này bằng `pnpm build:cloud`. Dùng Wrangler với cấu hình `.wrangler/web-build/afyllx_classhub/wrangler.json` để triển khai Worker. Cấu hình `cloud/wrangler.jsonc` khai báo D1 và các binding. Hai secret `BETTER_AUTH_SECRET` và `MEALCHECK_DIRECTORY_KEY` được quản lý trên Worker. Gateway nằm trong `edu-gateway` ở cấp repository.

Chạy kiểm thử bản web qua gateway bằng cách đặt biến môi trường `CLASSHUB_QA_WEB=1`, chạy `pnpm build:cloud` rồi `pnpm test:e2e`. Kịch bản dùng database và danh sách giả lập.
