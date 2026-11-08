# Cloudflare hiện hành

Cập nhật 03/11/2026: theo yêu cầu chủ dự án, danh sách Cloudflare đã được thay bằng **275 học sinh ngẫu nhiên**, 8 lớp 6A (35), 6B (37), 7A (36), 7B (35), 8A (32), 8B (33), 9A (33), 9B (34). Họ tên và mã không trùng trên toàn danh sách; đã cấp đủ QR. API identity đánh dấu `sampleRoster` từ setting `live:roster_kind=synthetic`; giao diện ghi Dữ liệu mẫu. Đây vẫn là deployment cloud-live, không bật lại endpoint seed công khai.

**Checkpoint danh sách thật** được kiểm tra trước khi thay: 34 học sinh, 34 QR và toàn bộ database tại `.migration-private/checkpoints/20261103-real-before-eight-classes/`. SQL đã restore kiểm tra trong SQLite bộ nhớ, integrity và khóa ngoại đạt. Không xuất hoặc đổi runtime QR key; muốn khôi phục, review file README/checkpoint.json và nhập vào D1 mới rồi đối chiếu trước khi đổi binding. Không tự chạy restore, không chạy lại migration lịch sử. File checkpoint/roster/token không nằm trong Git. Bản local thật giữ nguyên.

**Trạng thái hiện hành (từ 03/11/2026):** bản cloud-live công khai, không đăng nhập theo quyết định của chủ dự án, đang phục vụ danh sách giả lập 275 học sinh, không phải danh sách thật. Danh sách thật trên cloud chỉ còn trong checkpoint riêng ở trên; chỉ khôi phục khi chủ dự án yêu cầu rõ ràng. Bản local thật (34 học sinh, 34 QR gốc) giữ nguyên.

Lịch sử triển khai dữ liệu thật trước lần thay: ngày 31/10/2026, chủ dự án xác nhận nhập danh sách thật lên Cloudflare và chấp nhận giao diện quản trị công khai không đăng nhập. Sau đó chủ dự án cho phép cấp QR mới để dùng ngay, giữ bản sao thẻ cũ, và yêu cầu bỏ bản sao khóa cũ. Khóa QR gốc cũ chưa từng xuất được về máy nên không có bản sao khóa gốc để xóa. Không sao chép khóa demo sang dữ liệu thật.

Cấu hình đang áp dụng:

- URL chính: https://edu.afyllx.com/mealcheck. Cài PWA tại https://edu.afyllx.com/mealcheck/cai-dat. `afyllx.com` và `my-website.fyllxestonia.workers.dev` vẫn hoạt động. Trang `/quan-tri` cũ vẫn được phục vụ; điều hướng tab tại `/mealcheck` giữ nguyên đường dẫn này.
- Tên miền chính khai báo bằng `MEALCHECK_PUBLIC_HOST`; host cũ nằm trong danh sách rõ ràng `MEALCHECK_PUBLIC_HOST_ALIASES`. Chỉ chấp nhận HTTPS và hostname khớp chính xác; không tự nhận mọi subdomain. Custom Domain `edu.afyllx.com` thuộc gateway Worker `afyllx-edu`: root phục vụ portal, `/mealcheck` và API/PWA/assets được chuyển tới `my-website` qua service binding giữ nguyên request. Source portal ở `C:/Users/HarmoniaNEXT/.gemini/antigravity/scratch/afyllx-edu`. Worker MealCheck chỉ gắn Custom Domain `afyllx.com`; không gắn lại Edu root khi deploy. Không sao chép database hoặc thay QR key.
- Cấu hình hiện hành: `wrangler.cloud.jsonc`, chế độ `cloud-live`, D1 riêng `afyllx-mealcheck-live-20261031`.
- Chỉ nhận dữ liệu `live`; API `space=demo` và tạo dữ liệu test bị từ chối. Giao diện không có môi trường thử nghiệm hoặc nút tạo học sinh giả lập.
- `POST /api/device/start` (đăng ký kiosk học sinh ẩn danh, giao diện hiện không dùng) trả 404 trên bản công khai để không ai tạo thêm dòng thiết bị. Kiosk đã đăng ký vẫn dùng `kiosk/*`; máy quét vẫn đăng ký qua `qr/scanner/start`. Bản localhost giữ nguyên.
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

## Chống DDoS và chống spam yêu cầu

Có ba lớp bảo vệ, xếp từ ngoài vào trong:

1. **Cloudflare edge (tự động, mọi gói):** chặn DDoS tầng mạng (L3/L4) và bộ luật HTTP DDoS Managed Ruleset (L7) cho mọi request qua `afyllx.com`, `edu.afyllx.com` và `*.workers.dev`. Không cần code.
2. **Lớp chắn trong Worker (`lib/shield.mjs`, gọi đầu tiên trong `worker/index.ts`):** giới hạn tốc độ theo IP (IPv6 gộp theo /64) bằng Workers Rate Limiting binding khai báo trong `wrangler.cloud.jsonc`. Chạy trước khi chuyển sang `afyllx-web`, render trang hoặc truy vấn D1. Gateway Edu chuyển nguyên request nên `CF-Connecting-IP` vẫn là IP thật của người dùng.

   | Nhóm | Route | Giới hạn mỗi IP |
   |---|---|---|
   | `page` | trang, RSC, trang thương hiệu | 200 / 10 giây |
   | `read` | GET `/api/*` (board, records, students, health…) | 300 / 10 giây |
   | `write` | POST `/api/*` (quét QR, duyệt…) | 100 / 10 giây |
   | `heavy` | export, daily, audit, qr/cards, reset-preview/backups, devices | 60 / 60 giây |
   | `enroll` | `device/start` (404 trên bản công khai), `qr/scanner/start` (tạo dòng thiết bị trong D1) | 20 / 60 giây; thêm trần chung 300 / 60 giây cho mỗi route |
   | `directory` | `/api/v1/shared-directory` (ClassHub đồng bộ danh sách chung) | 600 / 60 giây |

   ClassHub gọi danh sách chung qua service binding, request không có `CF-Connecting-IP` nên mọi lượt đồng bộ dùng chung khóa `directory:unknown`. Nhóm `directory` (binding `RL_DIRECTORY`, `namespace_id` 7107) tách lượt đồng bộ khỏi khóa `unknown` của nhóm `read`/`write`; route vẫn yêu cầu `MEALCHECK_DIRECTORY_KEY`.

   Ngưỡng được tính cho một mạng trường dùng chung IP (NAT), có nhiều máy quét và tab quản trị làm mới mỗi 10 giây. Vượt ngưỡng sẽ nhận 429 kèm `Retry-After`. Hàng đợi quét offline coi 429 là lỗi tạm thời: giữ nguyên lượt quét và gửi lại sau, không mất dữ liệu. URL dài hơn 4096 ký tự bị trả 414, phương thức API lạ bị trả 405. Bộ đếm tính riêng theo từng vị trí Cloudflare. Nếu dịch vụ rate limit lỗi, request vẫn được cho qua. Bản localhost không khai báo binding nên không bị giới hạn.
3. **Ứng dụng:** kiểm tra Origin cho POST, giới hạn body 2 MB, cookie thiết bị HttpOnly, thu hồi thiết bị phía server.

Muốn đổi ngưỡng, sửa `limit` trong `wrangler.cloud.jsonc` (`period` chỉ nhận 10 hoặc 60 và phải khớp `SHIELD_BUCKETS`), chạy `pnpm check` rồi build/deploy như trên. Không đổi `namespace_id` đang dùng.

### Cấu hình nên bật trên Cloudflare dashboard (zone `afyllx.com`)

- **Security → WAF → Rate limiting rules** (gói Free được 1 rule): `URI Path starts with "/api/"`, đếm theo IP, 10 giây, ngưỡng khoảng 400, hành động Block 10 giây. Rule này chặn ngay tại edge, trước khi Worker chạy, nên request bị chặn không bị tính vào hạn mức Worker. Lớp trong Worker vẫn bị tính phí cho từng request bị từ chối.
- **Security → DDoS → HTTP DDoS attack protection:** giữ mặc định. Khi đang bị tấn công có thể nâng sensitivity lên High.
- **Không bật Bot Fight Mode hoặc "I'm Under Attack" thường xuyên.** Hai chế độ này đưa ra thử thách JavaScript, làm hỏng các lệnh `fetch` API từ PWA và máy quét. Chỉ bật Under Attack khi khẩn cấp: máy quét vẫn lưu lượt quét offline và gửi lại sau. Nếu cần thử thách, tạo Custom rule với Managed Challenge cho trang và bỏ qua `/api/`.
- Host `my-website.fyllxestonia.workers.dev` không nằm trong zone nên không áp dụng rule WAF ở trên. Nó vẫn có DDoS edge và lớp chắn trong Worker. Tắt host cũ này là quyết định của chủ dự án; trước đó phải chuyển ClassHub sang host khác (xem mục Danh sách chung với ClassHub).

## Header bảo mật và nhật ký

- `worker/index.ts` bọc mọi phản hồi bằng `lib/security-headers.mjs`: trang, API, phản hồi 429/414/405 của lớp chắn và trang thương hiệu `afyllx.com` chuyển từ `afyllx-web`. Thêm `X-Frame-Options: SAMEORIGIN`, `Content-Security-Policy: frame-ancestors 'self'` (chỉ khi chưa có CSP), `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, và `Strict-Transport-Security: max-age=31536000; includeSubDomains` chỉ trên HTTPS. Header do handler đặt sẵn được giữ nguyên; status, redirect, nhiều `Set-Cookie` và body stream không đổi.
- Không trang nào nhúng `/mealcheck`, `/quan-tri` hoặc `/cai-dat` bằng iframe; portal Edu chỉ dẫn link cùng origin. Nếu sau này cần nhúng từ site khác, đổi chính sách này trước.
- Tệp tĩnh do assets binding phục vụ không đi qua Worker; `public/_headers` khai báo cùng bộ header (trừ HSTS). Sửa một nơi thì sửa cả nơi còn lại.
- Workers Logs bật trong `wrangler.cloud.jsonc` (`observability.enabled=true`, `head_sampling_rate=1`). Nhật ký gồm thông tin mỗi lượt gọi (URL, phương thức, status, lỗi chưa bắt) theo hạn mức và thời gian lưu của gói Cloudflare. Code trong `app/`, `lib/`, `worker/` không gọi `console.*` (có test kiểm tra) và URL API không chứa token/QR, nên token, cookie, danh sách học sinh hoặc body không được ghi vào nhật ký. Không thêm log in dữ liệu yêu cầu.

## Danh sách chung với ClassHub

MealCheck web là nguồn chính cho học sinh và lớp sinh hoạt. Migration `0004_shared_directory.sql` bổ sung mã lớp ổn định, phiên bản danh sách và thông tin chống ghi trùng khi gửi lại thao tác. Migration không sửa hồ sơ học sinh, QR hay dữ liệu điểm danh đã lưu.

Trước khi áp dụng riêng migration này, kiểm tra migration đang chờ, sao lưu D1 và thử restore, rồi lưu phiên bản Worker hiện hành. API `/api/v1/shared-directory?space=live` dùng secret riêng `MEALCHECK_DIRECTORY_KEY`; chỉ cấu hình khóa trên hai máy chủ. ClassHub đồng bộ qua service binding với origin cố định `https://my-website.fyllxestonia.workers.dev` (`MEALCHECK_DIRECTORY_ORIGIN`), nên host cũ này phải giữ trong `MEALCHECK_PUBLIC_HOST_ALIASES`; bỏ alias sẽ làm hỏng đồng bộ danh sách chung. Kiểm tra đọc danh sách, số lớp và số thẻ sau triển khai; dùng dữ liệu QA riêng cho mọi phép thử ghi. Nếu cần quay lại phiên bản Worker cũ, có thể giữ schema bổ sung trên D1. Cách đó không hoàn tác những sửa đổi danh sách đã lưu, nên tránh phục hồi đè dữ liệu đang chạy.

## Website thương hiệu tại afyllx.com

Từ bản website tổng ngày 06/11/2026, Worker `my-website` giữ custom domain `afyllx.com` và chuyển các trang thương hiệu sang Worker tĩnh `afyllx-web` qua service binding `AFYLLX_WEB`. Quy tắc nằm trong `lib/brand-routing.mjs`; chỉ áp dụng GET/HEAD trên chính `afyllx.com`. API, quản trị, tài nguyên ứng dụng và PWA giữ handler hiện có. Gateway Edu và origin workers.dev tiếp tục chạy như trước.

Worker tĩnh không có database, secrets hoặc custom domain. Xem `afyllx-web/README.md` để build/deploy giao diện độc lập. Khi rollback lần nối đầu tiên, dùng phiên bản trước đó của `my-website` đã ghi từ `wrangler deployments list`; không rollback dữ liệu. Các bản cập nhật giao diện tiếp theo có thể rollback riêng `afyllx-web`.
