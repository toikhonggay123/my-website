# AFYLLX ClassHub

Ứng dụng quản trị lớp học chạy trên máy. Dùng khóa học để tạo lớp, ghi danh học viên, phân công giáo viên, tạo buổi học từ lịch lặp và ghi điểm danh trong ClassCheck.

## Chạy trên Windows

Yêu cầu Node.js 22.22 trở lên (khuyến nghị 24) và pnpm 11.25, theo `engines` và `packageManager` trong `package.json`. Mở PowerShell tại thư mục `classhub`.

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

### Chế độ trường học

Chọn loại hình **Trường học** trong **Thiết lập** để bật học kỳ, môn học, khung giờ tiết, ngày nghỉ và mục **Thời khóa biểu**. Lớp tạo trong chế độ này là lớp sinh hoạt, không cần khóa học và mở ngay.

1. Trong **Thiết lập**, thêm học kỳ, bấm **Thêm bộ môn THCS** và lưu khung giờ tiết.
2. Trong **Thời khóa biểu → Phân công**, chọn giáo viên chủ nhiệm và giáo viên từng môn cho mỗi lớp.
3. Trong **Soạn**, tạo bản nháp và xếp tiết cho từng lớp, có thể dán từ Excel. Bản nháp báo giáo viên bị trùng tiết và môn chưa có giáo viên.
4. Trong **Công bố**, chọn ngày áp dụng. ClassHub tạo một buổi điểm danh cho mỗi lớp, mỗi buổi sáng hoặc chiều có tiết, trong 14 ngày tới. Giáo viên chủ nhiệm phụ trách buổi đó. Dùng **Đồng bộ buổi điểm danh** để chuẩn bị thêm ngày.

Công bố lại, đổi chủ nhiệm hoặc thêm ngày nghỉ chỉ thay đổi buổi chưa bắt đầu và chưa có điểm danh. Buổi đã điểm danh giữ nguyên. Trong bản này chỉ chủ đơn vị dùng được các mục của chế độ trường học.

### Báo cáo

Mục **Báo cáo** có ba phần. Chỉ tính buổi đã chốt.

- **Chi tiết:** từng lượt điểm danh theo bộ lọc, xuất CSV tối đa 10.000 dòng. Khoảng ngày tối đa 366 ngày.
- **Tổng hợp:** chọn nhanh theo học kỳ, 30 ngày qua hoặc tháng này. Bảng theo lớp gồm số buổi đã chốt trên số buổi đã diễn ra, tỷ lệ chuyên cần và số lượt vắng có phép (P), không phép (K), đi muộn (M). Có danh sách học sinh cần chú ý và nút xuất Excel (CSV) cho từng học sinh.
- **Sổ điểm danh tháng:** chọn lớp và tháng, mỗi cột là một buổi (S sáng, C chiều). Ký hiệu như sổ giấy: để trống là có mặt, M đi muộn, P có phép, K không phép, – là buổi chưa chốt. Có cột tổng, xuất Excel (CSV) và nút **In sổ** in khổ A4 ngang.

Học sinh cần chú ý là em có từ 3 buổi vắng không phép, 5 buổi vắng tính cả có phép, hoặc 5 lần đi muộn trong khoảng đang xem. Trang **Hôm nay** của quản trị hiện tối đa 8 em chạm ngưỡng này trong 30 ngày qua. File CSV có BOM UTF-8 để Excel mở đúng tiếng Việt. Mỗi lần xuất được ghi vào nhật ký.

### Trang giáo viên

`/classhub/gv` là trang gọn cho điện thoại, gồm **Hôm nay**, **Tuần** và **Lớp**. Trong **Nhân sự**, mời giáo viên sẽ tạo một link kích hoạt dùng một lần trong 24 giờ. Mã nằm sau dấu `#` nên không đi vào log máy chủ. Giáo viên mở link, đặt mật khẩu rồi vào thẳng trang. Đăng nhập ở trang giáo viên được nhớ 30 ngày và tự gia hạn khi dùng. Đăng nhập ở trang quản trị vẫn chỉ kéo dài một ngày trong phiên trình duyệt.

- Điểm danh: cả lớp mặc định có mặt, chạm vào tên để đổi Vắng → Đi muộn → Có phép. Bản đang sửa được giữ trên máy nếu mất mạng. Chốt qua hộp xác nhận của ứng dụng.
- Buổi điểm danh của trường do giáo viên chủ nhiệm phụ trách. Giáo viên có tiết với lớp trong buổi đó cũng mở và điểm danh được. Người đã chốt có 30 phút để tự mở lại và sửa; sau đó cần quản trị mở lại. Buổi của khóa học giữ quy tắc cũ: chỉ giáo viên phụ trách buổi.
- Lớp: sĩ số và số lần vắng, đi muộn, có phép của từng học sinh trong 30 ngày, đánh dấu em từ 2 lần trở lên.
- Buổi điểm danh 14 ngày tới được chuẩn bị tự động khi quản trị hoặc giáo viên mở ClassHub lần đầu trong ngày.

ClassHub chạy trên máy không có tài khoản giáo viên nên trang này chỉ dùng trên bản web.

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

MealCheck web giữ danh sách gốc. ClassHub lấy học sinh và lớp sinh hoạt về mỗi khi mở **Học viên** hoặc **Thiết lập**. Các màn khác dùng lại lần kiểm tra trong 15 giây gần nhất để không tải lại cả danh sách ở mỗi yêu cầu. ClassHub giữ liên kết ổn định để dùng trong lịch học và điểm danh. **Học viên** cho phép thêm hoặc sửa học sinh chung; **Thiết lập → Lớp sinh hoạt chung** cho phép thêm hoặc đổi tên lớp. Lớp theo khóa học vẫn quản lý riêng trong ClassHub. Khi mất kết nối, danh sách đã tải vẫn dùng được; cần có mạng để sửa dữ liệu chung.

Sau khi MealCheck web có API danh sách chung, chạy `pnpm db:local` và đặt `MEALCHECK_DIRECTORY_ORIGIN=https://my-website.fyllxestonia.workers.dev`, `MEALCHECK_DIRECTORY_ORG_ID` và `MEALCHECK_DIRECTORY_KEY` trong `.dev.vars` riêng của ClassHub. Giá trị khóa phải khớp secret cùng tên của Worker MealCheck. Khởi động lại ClassHub sau khi thay cấu hình. Dữ liệu QR và các lượt ăn không truyền qua kết nối này.

## Bản web

Gateway AFYLLX Edu chuyển `/classhub` và các đường dẫn con tới Worker `afyllx-classhub`. Cloudflare D1 `afyllx-classhub-live` lưu tài khoản, lịch học và chuyên cần. Tài khoản quản trị kích hoạt bằng mã mời một lần. Khi tạo đơn vị từ mã mời đã cấp cho bản web, ClassHub dùng danh sách chung của MealCheck qua service binding.

Khách mở `/classhub` sẽ vào thẳng bản dùng thử. Mỗi trình duyệt nhận một không gian mẫu có thể chỉnh sửa trong 24 giờ. Dữ liệu dùng thử nằm trong D1 `afyllx-classhub-demo` và được dọn định kỳ khi phiên hết hạn. Mục **Không gian riêng** mở luồng tài khoản và mã mời.

### Thời khóa biểu học sinh

`/classhub/hs` là trang tra cứu công khai, không cần đăng nhập. Link cũ `/classhub/thoi-khoa-bieu` vẫn dùng được. Chia sẻ link theo lớp bằng `?truong=<tên ngắn>&lop=8a`.

**Thời khóa biểu thật từ ClassHub:** trong chế độ trường học, chủ đơn vị vào **Thiết lập → Trang học sinh**, chọn tên ngắn rồi bấm **Công bố trang học sinh**. Trang đọc trực tiếp thời khóa biểu đã công bố, ngày nghỉ và buổi bị quản trị hủy, rồi hiện tiết đang học hoặc tiết tiếp theo trong ngày. Dữ liệu trả về chỉ gồm tên lớp, môn, giờ, phòng và thông báo. Không có tên giáo viên, danh sách học sinh hay kết quả điểm danh. **Ngừng công bố** sẽ đóng trang ngay. Khi chỉ có một trường công bố, `/classhub/hs` mở thẳng trường đó.

Buổi điểm danh do quản trị hủy hoặc đổi giờ bằng tay được giữ nguyên khi đồng bộ thời khóa biểu. Buổi theo thời khóa biểu chỉ đổi được giờ trong cùng ngày.

**Lịch soạn sẵn trong file:** khi chưa có trường nào công bố, trang dùng lịch chuẩn bị riêng dưới đây. Khi chưa nhận lịch chính thức, `src/web/published-timetable.json` để `null` và trang hiển thị lịch minh họa cho 6A–9B. Khi công bố lịch chính thức, điền tên trường, mọi lớp cần tra cứu, ngày thứ Hai của các tuần đã công bố, và từng tiết thực tế theo ngày. Tuần có ngày nghỉ giữ ngày đó trống. Tuần chưa được công bố không có trong `weeks`. Ví dụ một lớp:

```json
{
  "school": "Trường của bạn",
  "classes": [{
    "id": "8a",
    "grade": 8,
    "name": "8A",
    "weeks": ["2026-11-09"],
    "periods": [{
      "date": "2026-11-09",
      "shift": "morning",
      "number": 1,
      "subject": "Toán",
      "start": "07:00",
      "end": "07:45",
      "room": "P.08"
    }]
  }]
}
```

`shift` nhận `morning`, `afternoon` hoặc `evening`. Dữ liệu được kiểm tra trước khi build cloud. Công bố hoặc sửa lịch công khai bằng cách cập nhật file và triển khai lại Worker ClassHub.

Trước khi triển khai bản có migration mới, sao lưu rồi áp dụng migration cho **cả hai** D1 `afyllx-classhub-live` và `afyllx-classhub-demo`, vì Worker và lệnh dọn bản dùng thử đọc các bảng mới. Không áp dụng tự động.

Build từ thư mục này bằng `pnpm build:cloud`. Dùng Wrangler với cấu hình `.wrangler/web-build/afyllx_classhub/wrangler.json` để triển khai Worker. Cấu hình `cloud/wrangler.jsonc` khai báo D1 và các binding. Hai secret `BETTER_AUTH_SECRET` và `MEALCHECK_DIRECTORY_KEY` được quản lý trên Worker. Gateway nằm trong `edu-gateway` ở cấp repository.

Chạy kiểm thử bản web qua gateway bằng cách đặt biến môi trường `CLASSHUB_QA_WEB=1`, chạy `pnpm build:cloud` rồi `pnpm test:e2e`. Kịch bản dùng database và danh sách giả lập.
