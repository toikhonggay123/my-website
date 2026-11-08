# AFYLLX Account

Một tài khoản cho mọi sản phẩm AFYLLX. Đây là Worker `afyllx-accounts` với D1 riêng, chạy tại `https://edu.afyllx.com/tai-khoan` qua gateway `afyllx-edu`. Mã nguồn đặt trong thư mục `classhub/` để dùng chung bộ công cụ (React, Vite, Hono, Wrangler, Playwright), nhưng build, cơ sở dữ liệu và triển khai đều tách riêng.

## Phân quyền

| Cấp | Vai trò | Quyền | Bảo vệ |
| --- | --- | --- | --- |
| Hệ thống | **AFYLLX Account Founder** | Cao nhất. Vào mọi sản phẩm với toàn quyền. Tạo, đổi, thu hồi mọi vai trò hệ thống, kể cả Founder khác. Đặt lại xác thực hai lớp của người khác | Phiên tối đa 12 giờ, dải cảnh báo "Đang dùng quyền Founder". Không thể gỡ hoặc khóa Founder cuối cùng (database chặn). Không tự đổi vai trò hoặc tự khóa chính mình |
| Hệ thống | **Quản trị hệ thống** | Tạo tài khoản thường, khóa hoặc mở khóa tài khoản thường, tạo đơn vị, xem nhật ký. Không đụng được tài khoản có vai trò hệ thống | Phiên 12 giờ |
| Hệ thống | **Hỗ trợ** | Xem tài khoản và đơn vị, tạo link đặt lại mật khẩu cho tài khoản thường | Phiên 12 giờ |
| Đơn vị | Chủ đơn vị, Quản trị đơn vị, Thành viên | Đã có bảng `memberships`. Quyền theo từng sản phẩm được nối ở giai đoạn A2 (ClassHub) và A3 (MealCheck) | Phiên 30 ngày tự gia hạn |

**Đăng nhập chỉ bằng mật khẩu** (chủ dự án chọn ngày 07/11/2026): mọi vai trò, kể cả Founder, đăng nhập bằng email và mật khẩu cố định. Xác thực hai lớp là tùy chọn, ai muốn thì tự bật trong tab Bảo mật. Khi đã bật, mỗi lần đăng nhập phải nhập thêm mã 6 số. Founder có thể tắt hai lớp của người khác bằng nút "Đặt lại hai lớp".

Trong A1, Founder và Quản trị hệ thống thấy ClassHub, MealCheck và cổng Edu với nhãn "Toàn quyền". Việc các sản phẩm thật sự nhận phiên AFYLLX Account làm ở A2 và A3.

## Bảo mật

- **Mật khẩu:** PBKDF2-SHA256 100 000 vòng với muối riêng, tối thiểu 12 ký tự. So sánh hằng thời gian. Email không tồn tại cũng mất cùng thời gian xử lý.
- **Phiên:** mã ngẫu nhiên 256 bit, database chỉ lưu SHA-256 của mã. Cookie `afyllx_session` đặt `HttpOnly`, `Secure` (trên HTTPS), `SameSite=Lax`, `Path=/` để các sản phẩm dưới `edu.afyllx.com` dùng chung. Khóa tài khoản, đổi vai trò, đổi mật khẩu hoặc bật hai lớp mới đều đăng xuất các thiết bị khác.
- **Xác thực hai lớp (tùy chọn):** TOTP theo RFC 6238 (đã kiểm bằng bộ vector chuẩn), cho lệch tối đa một bước 30 giây, chặn dùng lại mã. Khóa bí mật được mã hóa AES-GCM bằng secret `ACCOUNTS_ENCRYPTION_KEY`. Có 10 mã khôi phục dùng một lần, chỉ lưu dạng băm. Bật hoặc đổi điện thoại xác thực từ tab Bảo mật phải nhập lại mật khẩu, nên phiên bị mượn hoặc bị lấy cắp không tự gắn được điện thoại khác. Bước xác nhận chỉ nhận đúng lần thiết lập vừa tạo trong cùng phiên, trong 10 phút.
- **Link một lần** (kích hoạt 72 giờ, đặt lại 24 giờ): chỉ lưu SHA-256. Mã nằm sau dấu `#` nên không vào log máy chủ, và bị xóa khỏi thanh địa chỉ sau khi mở. Tạo link mới làm link cũ hết hiệu lực.
- **Chống dò mật khẩu:** giới hạn 10 lần mỗi phút theo IP. Sau 10 lần sai cho cùng một email từ cùng một mạng (một địa chỉ IPv4 hoặc một dải IPv6 /64), mạng đó bị tạm khóa đăng nhập email này 15 phút; chủ tài khoản ở mạng khác vẫn đăng nhập được. Tổng 100 lần sai từ mọi mạng trong 15 phút thì khóa email đó ở mọi nơi. Thông báo giống nhau dù email có tài khoản hay không.
- **Chống dồn yêu cầu:** trên bản web, mọi `/api/*` giới hạn 300 yêu cầu mỗi 10 giây cho mỗi IP (IPv6 theo /64), quá thì trả 429 kèm `Retry-After`. Binding `API_LIMIT` chỉ có trong `cloud/wrangler.jsonc`; thiếu hoặc lỗi thì cho qua. ClassHub gọi qua service binding kèm IP của người dùng nên chỉ tính vào người đó.
- **Trang tĩnh:** `public/_headers` chặn nhúng khung (`X-Frame-Options: DENY`, `frame-ancestors 'none'`), bật HSTS, `nosniff` và `Referrer-Policy` cho các trang trên account.afyllx.com.
- **Yêu cầu ghi:** chỉ nhận JSON và đúng Origin. Mọi đăng nhập, lần sai, thay đổi tài khoản, vai trò và link đều ghi vào nhật ký.

## Chạy và kiểm tra trên máy

Chạy trong thư mục `classhub`:

```
node accounts/scripts/accounts.mjs setup
node node_modules/vite/bin/vite.js build --config accounts/vite.config.ts
node --test accounts/tests/crypto.test.ts accounts/tests/schema.test.ts accounts/tests/api.test.ts
node node_modules/@playwright/test/cli.js test --config accounts/playwright.config.ts
```

Test E2E dùng Miniflare với D1 tạm và một Founder hư cấu, không đụng dữ liệu thật.

## Triển khai lần đầu (cần chủ dự án đồng ý từng bước)

1. `wrangler d1 create afyllx-accounts-live`, rồi ghi `database_id` vào `accounts/cloud/wrangler.jsonc`.
2. `wrangler d1 migrations apply afyllx-accounts-live --remote --config accounts/cloud/wrangler.jsonc`.
3. Đặt secret `ACCOUNTS_ENCRYPTION_KEY` (64 ký tự hex ngẫu nhiên) cho Worker `afyllx-accounts`, nhập qua stdin. Không lưu khóa này ở đâu khác.
4. Build `--mode cloud` rồi `wrangler deploy --config accounts/.wrangler/web-build/afyllx_accounts/wrangler.json`.
5. Gateway: chép `edu-gateway/worker/index.mjs` và thêm binding `ACCOUNTS → afyllx-accounts` vào bản checkout portal, rồi deploy `afyllx-edu`. Phải deploy Worker accounts trước, vì binding trỏ tới một Worker chưa tồn tại sẽ khiến deploy gateway thất bại.
6. `node accounts/scripts/accounts.mjs founder <email> "<Tên>" --remote`. Lệnh in link kích hoạt Founder một lần, sống 72 giờ. Mở link và đặt mật khẩu là xong.

**Quay lui:** gỡ binding `ACCOUNTS` khỏi gateway (đường `/tai-khoan` sẽ trả 503), hoặc quay gateway về phiên bản trước. Các sản phẩm khác chưa phụ thuộc AFYLLX Account trong A1.

## Kết quả triển khai A1 (07/11/2026)

| Bước | Kết quả |
| --- | --- |
| D1 `afyllx-accounts-live` | Tạo mới, id `688f31ca-c3d0-4504-82c9-06848396deac`, đã áp migration `0001_accounts.sql` |
| Worker `afyllx-accounts` | Version `f677cfb2-e3a0-42fa-865a-41c9d48e498e`, không có `workers.dev`, chỉ đi qua gateway |
| Secret `ACCOUNTS_ENCRYPTION_KEY` | Sinh ngẫu nhiên và nạp thẳng qua stdin, không in và không lưu ở đâu khác |
| Gateway `afyllx-edu` | Version `e079f1b2-eb90-4e4d-b932-dfb08ad2a063` (thêm `/tai-khoan` → `ACCOUNTS`). 10/10 test định tuyến đạt. Asset portal giữ nguyên |
| Founder đầu tiên | `contact.afyllx@gmail.com`. Link kích hoạt một lần gửi riêng cho chủ dự án, hết hạn sau 72 giờ |
| Kiểm tra chỉ đọc | `/tai-khoan`, `/tai-khoan/dat-mat-khau` → 200; `/tai-khoan/api/health` → 200; `/tai-khoan/api/me` → 401; `/`, `/classhub`, `/classhub/api/health`, `/mealcheck` → 200 |

Cùng ngày, theo yêu cầu chủ dự án, bỏ bắt buộc xác thực hai lớp (đăng nhập chỉ bằng mật khẩu): Worker `afyllx-accounts` version `8fc58ba3-dec0-45bb-b919-7d8e6b3f9d2d`. Không đổi database, link Founder cũ vẫn dùng được.

### Nối các sản phẩm (08/11/2026)

| Sản phẩm | Cách nối | Phiên bản | Quay lui về |
| --- | --- | --- | --- |
| ClassHub | Service binding `ACCOUNTS`. Founder và Quản trị hệ thống là chủ mọi đơn vị. Ô đăng nhập ClassHub nhận cả mật khẩu AFYLLX Account, đăng xuất ClassHub thì thoát cả AFYLLX Account (`src/server/platform.ts`) | `72a85840-14a8-4c9b-a8b9-2b1cdbc29758` | `9486831f-6408-49ee-a398-44925aac45ae` |
| Cổng Edu | Nút tài khoản trên thanh đầu trang và mục trong menu điện thoại (`src/components/AccountButton.tsx` trong checkout portal) | `e1677d2c-1a34-4305-9a6d-32e81008cc1c` | `e079f1b2-eb90-4e4d-b932-dfb08ad2a063` |
| MealCheck | Chủ dự án chọn **giữ quản trị công khai**. Chỉ thêm lối tắt AFYLLX Account không bắt buộc ở thanh bên và menu (`app/account-link.tsx`), và lối tắt này chỉ hiện trên edu.afyllx.com | `d479d741-9603-4ba2-9f9d-b208f2103f92` | `2ac41e4e-4aac-4422-9510-8cb33b985a00` |

Không đổi database. Lần đầu Founder vào ClassHub, hệ thống tạo một người dùng ClassHub cùng email (không có mật khẩu ClassHub), hoặc dùng lại người dùng sẵn có nếu trùng email. Kiểm tra sau triển khai (chỉ đọc): `/`, `/classhub`, `/classhub/gv`, `/mealcheck` → 200; `/classhub/api/v1/me`, `/tai-khoan/api/me` → 401 khi chưa đăng nhập; bundle mới đã lên.

### Tên miền riêng account.afyllx.com (08/11/2026)

- **Trang AFYLLX Account** chạy tại `https://account.afyllx.com`, gắn Custom Domain thẳng vào Worker `afyllx-accounts`. Biến môi trường: `APP_ORIGIN=https://account.afyllx.com`, `EXTRA_ORIGINS=https://edu.afyllx.com`, `COOKIE_DOMAIN=afyllx.com`.
- **Cookie `afyllx_session`** giờ đặt `Domain=afyllx.com`, nên mọi sản phẩm `*.afyllx.com` dùng chung một lần đăng nhập. Cookie cũ (chỉ thuộc edu.afyllx.com) được xóa khi đăng nhập hoặc đăng xuất. Server thử lần lượt mọi giá trị cookie gửi lên, nên phiên cũ vẫn dùng được cho tới khi hết hạn.
- **Trên edu.afyllx.com**, `/tai-khoan/api/*` vẫn chuyển tới Worker: cổng Edu và MealCheck dùng nó để đọc người đang đăng nhập (cùng origin), ClassHub gọi qua service binding. Các trang `/tai-khoan/...` chuyển hướng 302 sang account.afyllx.com, và link một lần cũ vẫn giữ được `#mã`.
- **Sau khi đăng nhập**, `?tiep=` chỉ nhận đường dẫn trong site hoặc địa chỉ https thuộc `afyllx.com` và các tên miền con.
- **Link kích hoạt hoặc đặt lại** in từ `accounts.mjs --remote` giờ dùng `https://account.afyllx.com/dat-mat-khau#…`.

| Worker | Phiên bản mới | Quay lui về |
| --- | --- | --- |
| afyllx-accounts | `d4ec896d-0721-4543-be1a-b7cd8170c3b2` | `8fc58ba3-dec0-45bb-b919-7d8e6b3f9d2d`, và gỡ Custom Domain account.afyllx.com |
| afyllx-edu (gateway, cổng) | `e64c2b9b-35dd-4a80-9c02-226c77fc8d7e` | `e1677d2c-1a34-4305-9a6d-32e81008cc1c` |
| afyllx-classhub (kèm "Xem trang giáo viên") | `546b5148-f54f-4baa-bb4d-86bc434dc2b6` | `72a85840-14a8-4c9b-a8b9-2b1cdbc29758` |
| my-website (MealCheck) | `66836200-dd1e-40a1-b27f-d88bd881cee3` | `d479d741-9603-4ba2-9f9d-b208f2103f92` |

Cập nhật sau đó: logo AFYLLX thay chữ "A" (`accounts/public/afyllx-mark-192.png`, `favicon-64.png`, thu nhỏ từ `afyllx-web/public/afyllx-brand/afyllx-logo.png`). afyllx-accounts `87cb5167-770a-4a1e-b9d8-cdef9c5d153f`, quay lui về `d4ec896d-0721-4543-be1a-b7cd8170c3b2`.

Nếu quay lui Account về bản cũ, phải quay lui gateway cùng lúc, vì bản Account cũ phục vụ trang ở `/tai-khoan/`.

Quay lui gateway: `wrangler rollback 7ff0e6d4-c52c-4172-9d59-502ab6306740` trong bản checkout portal (phiên bản trước khi có `/tai-khoan`). Bản sao file cũ nằm ở `.local-server/checkpoints/before-accounts-gateway-20261107/` của checkout portal.

### Bản vá sau rà soát bảo mật (08/11/2026)

Khóa đăng nhập theo (email, mạng), nhập lại mật khẩu khi bật/đổi 2FA, `_headers` chặn nhúng trang và HSTS, giới hạn `/api/*` 300 request/10 giây mỗi IP, cache thời khóa biểu công khai 60 giây, link đặt lại mật khẩu ClassHub chỉ cho tài khoản thuộc một đơn vị. MealCheck: header bảo mật, `init()` mỗi ngày một lần, `device/start` 404 trên cloud, bucket `RL_DIRECTORY`, bật Workers Logs. Không đổi database.

| Worker | Phiên bản mới | Quay lui về |
| --- | --- | --- |
| afyllx-accounts | `66053041-2da7-4ffc-8a6d-35eae78b98dd` | `87cb5167-770a-4a1e-b9d8-cdef9c5d153f` |
| afyllx-classhub | `89e3070e-e7eb-4cd6-a5bb-ce7113f39a69` | `546b5148-f54f-4baa-bb4d-86bc434dc2b6` |
| my-website (MealCheck) | `ec87e57e-8bdf-4800-b551-36b1c933681f` | `71379b73-2c8a-4526-8872-a43571ed1ad2` |

Kiểm tra chỉ đọc sau triển khai: trang account.afyllx.com và /classhub có `X-Frame-Options: DENY`, CSP và HSTS; /mealcheck, afyllx.com, workers.dev có `SAMEORIGIN`, `frame-ancestors 'self'` và HSTS; `/classhub/api/v1/public/timetable` lần hai trả `X-Edge-Cache: hit`; `POST /api/device/start` trên edu.afyllx.com → 404; live 275 học sinh mẫu, local 34 học sinh. Cổng `afyllx-edu` (trang gốc edu.afyllx.com) chưa có header vì source chưa vào git.

Nếu link Founder hết hạn trước khi dùng: lệnh `founder` từ chối chạy lại khi đã có Founder, nên cần tạo mã mới cho đúng tài khoản đó (chủ dự án yêu cầu thì làm).
