# Cloudflare dữ liệu chính thức

Ngày 31/10/2026, chủ dự án xác nhận nhập danh sách thật lên Cloudflare và chấp nhận giao diện quản trị công khai không đăng nhập. Sau đó chủ dự án cho phép cấp QR mới để dùng ngay, giữ bản sao thẻ cũ, và yêu cầu bỏ bản sao khóa cũ. Khóa QR gốc cũ chưa từng xuất được về máy nên không có bản sao khóa gốc để xóa. Không sao chép khóa demo sang dữ liệu thật.

- URL: https://my-website.fyllxestonia.workers.dev/quan-tri
- Cấu hình hiện hành: `wrangler.cloud.jsonc`, chế độ `cloud-live`, D1 riêng `afyllx-mealcheck-live-20261031`.
- Chỉ nhận dữ liệu `live`; API `space=demo` và tạo dữ liệu test bị từ chối. Giao diện không có môi trường thử nghiệm hoặc nút tạo học sinh giả lập.
- Database demo cũ đã được xóa sau khi đối chiếu dữ liệu live thành công. Tên/ID demo trong cấu hình lịch sử không còn trỏ đến tài nguyên đang chạy.
- Chỉ nhập các trường cần điểm danh: mã học sinh, họ tên, khối và lớp. Không nhập ngày sinh, địa chỉ hoặc thông tin bổ sung trong tệp Excel.
- QR mới mã hóa AES-GCM theo định dạng hiện có; mẫu thẻ ngang 85,6 × 54 mm, QR lớn bên trái và thông tin bên phải. Token/khóa không nằm trong repository. Khóa mới được tạo trong bộ nhớ, lưu bằng Cloudflare runtime secret; khóa demo được thay thế, không lưu bản sao.
- Database thật và 34 QR cũ trên localhost được giữ nguyên. Thẻ cũ không dùng trên Cloudflare sau khi cấp mới. Site cũ không thay đổi.
- Máy quét cloud-live dùng cookie riêng, không tái sử dụng phiên demo đã bị xóa. Thu hồi thiết bị vẫn được xác minh phía server.
- Xuất `.xls` hôm nay tạo file trong trình duyệt, với ngày và dữ liệu từ server, giữ nguyên các trang tổng hợp/bữa/lớp/chưa điểm danh.

## Build và triển khai

```text
pnpm check
pnpm build:cloud
pnpm deploy:cloud
```

Cloudflare Workers Builds hiện lưu các tên lệnh cũ `pnpm check && pnpm build:demo` và `pnpm deploy:demo`. Hai script đó là alias tương thích tới **cloud-release.mjs và cloud-live**, không triển khai demo. Dùng các tên `build:cloud`/`deploy:cloud` cho thao tác mới. CI kiểm tra build local và HTTP QA riêng rồi build cloud-live. Không có bước nhập roster hoặc migration tự động trong CI.

Trước build tại máy: dừng localhost. Sau triển khai cloud, chạy build local bình thường rồi khởi động lại. Không dùng build cloud để chạy launcher local. Kiểm tra hash và số học sinh thật không đổi.

Không chạy HTTP write tests lên bản cloud-live hoặc database local thật. Chỉ đối chiếu danh sách/QR đã nhập và cấu hình theo cách đọc; kiểm tra quét/chống trùng/reset bằng dữ liệu QA riêng. Bài kiểm tra cloud-demo phải từ chối bản live trước mọi ghi.

Không commit roster, SQL nhập riêng, token QR, khóa, `.dev.vars`, database hoặc bản sao riêng. Đồng bộ source không tự chia sẻ tệp riêng. `SucVatHoaThan` có quyền Write source; quyền đó không cấp quyền Cloudflare dashboard hoặc dữ liệu trên máy.
