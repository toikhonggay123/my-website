# Triển khai ClassHub P0–P4 lên edu.afyllx.com

Runbook cho bản gồm: sửa lỗi quản trị (P0), chế độ trường học và thời khóa biểu (P1), trang giáo viên `/classhub/gv` (P2), trang học sinh `/classhub/hs` (P3) và báo cáo (P4). Chỉ chạy khi chủ dự án đồng ý từng bước có ghi lên Cloudflare.

## Đã kiểm tra ngày 06/11/2026 (chỉ đọc)

| Mục | Kết quả |
| --- | --- |
| Đăng nhập Wrangler 4.92.0 | Có quyền trên tài khoản chứa `afyllx-classhub` |
| Migration chờ áp dụng | Live và demo đều chờ đúng `0005_school_mode.sql`, `0006_public_timetable.sql`. 0001–0004 đã áp dụng |
| Phiên bản Worker đang chạy | `14c254ff-0ab0-4cfd-abc2-b2a7abded68b` (05/11/2026 19:46 UTC), dùng để quay lui |
| Secret trên Worker | `BETTER_AUTH_SECRET`, `MEALCHECK_DIRECTORY_KEY` đã có. Không cần đặt lại |
| Sao lưu | Bản xuất SQL của live và demo cùng mốc time-travel nằm trong `.migration-private/classhub-backups/20261106-before-p0-p4/`. Thư mục riêng tư, không đưa vào Git |
| Diễn tập migration | Áp 0005 và 0006 lên bản sao trong bộ nhớ của cả hai database: integrity `ok`, 0 lỗi khóa ngoại, 22 bảng cũ giữ nguyên số dòng, thêm 7 bảng và các cột `shift`, `pinned`, `public_slug` |
| Dữ liệu live hiện có | 1 đơn vị loại Trường học, 8 lớp và 275 học sinh lấy từ danh sách chung với MealCheck, chưa có buổi điểm danh nào |
| Build cloud và `wrangler deploy --dry-run` | Đạt. Binding: D1 live và demo, service `my-website`, rate limit, cron `*/15 * * * *` |
| Gateway `afyllx-edu` | Đã chuyển mọi đường dẫn `/classhub/*` sang Worker ClassHub, nên `/classhub/gv` và `/classhub/hs` không cần sửa gateway |
| Kiểm thử local | Typecheck, build, 4 unit test, 10 E2E (7 local và 3 qua gateway) đều đạt trên D1 tạm |

## Kết quả triển khai ngày 06/11/2026

- Migration 0005 và 0006 đã áp dụng cho `afyllx-classhub-demo` rồi `afyllx-classhub-live`. Không còn migration chờ. Số dòng sau migration giống lúc sao lưu: live có 1 đơn vị, 8 lớp, 275 học sinh, 0 buổi; demo có 7 đơn vị, 11 lớp, 21 học sinh, 53 buổi, 72 lượt điểm danh.
- Worker `afyllx-classhub` đã triển khai, version `9b3da8b2-3860-4501-bb16-6c933e229fc4`. Bản trước đó để quay lui là `14c254ff-0ab0-4cfd-abc2-b2a7abded68b`.
- Kiểm tra chỉ đọc: `/classhub/api/health` trả 200. API công khai trả `enabled: false` vì chưa có trường nào công bố. `/api/v1/me` khi chưa đăng nhập trả 401. `/hs`, `/thoi-khoa-bieu` (lịch mẫu), `/gv` (màn đăng nhập giáo viên) và Báo cáo trong bản dùng thử đều mở được. `/mealcheck` vẫn trả 200.
- Console trình duyệt báo script Cloudflare Web Analytics bị chặn bởi CSP `script-src 'self'`. Lỗi này do Cloudflare tự chèn script ở cấp zone, không phát sinh từ bản này.

## Bản màn chào, giao diện mới và đặt lại mật khẩu (06/11/2026)

- Nội dung: màn chào `/classhub` (Cán bộ, giáo viên · Học sinh, quản trị sau ổ khóa, `/quan-tri`), trang học sinh và trang giáo viên làm lại theo tông gradient sáng có chuyển động, link đặt lại mật khẩu do chủ đơn vị tạo.
- Sao lưu trước khi đổi: `.migration-private/classhub-backups/20261106-before-front-door/`. Có bản xuất SQL, mã băm và mốc time-travel của live (`0000001f-…-dcc6239fc9ffe901e1ecc01585a67048`) và demo (`00000074-…-906f8adf40b28123af946a095bbb5b87`).
- Diễn tập `0007_password_resets.sql` trên bản sao của cả hai database: integrity ok, 0 lỗi khóa ngoại, 29 bảng cũ giữ nguyên số dòng.
- Đã áp 0007 cho demo rồi live, không còn migration chờ. Live giữ nguyên 1 đơn vị, 8 lớp, 275 học sinh. Demo thay đổi do lệnh dọn không gian dùng thử chạy định kỳ.
- Worker version mới `9486831f-6408-49ee-a398-44925aac45ae`. Quay lui về `9b3da8b2-3860-4501-bb16-6c933e229fc4`; code đó chạy được với bảng mới.
- Kiểm tra chỉ đọc: health 200; `/`, `/quan-tri`, `/hs`, `/gv`, `/gv/dat-lai-mat-khau`, `/thu` trả 200; `/api/v1/me` khi chưa đăng nhập trả 401; mã đặt lại giả trả 404; `/mealcheck` trả 200. Màn chào hiện đủ hai lối vào và ổ khóa.

## Các bước triển khai

Chạy trong thư mục `mealcheck-cloud/classhub`. Ví dụ dưới đây dùng `wrangler` của dự án: `node node_modules/wrangler/bin/wrangler.js`. Không cần dừng MealCheck local vì ClassHub build vào thư mục riêng.

1. **Migration demo trước.** Lệnh dọn bản dùng thử của Worker mới đọc các bảng mới.
   ```
   wrangler d1 migrations apply afyllx-classhub-demo --remote --config cloud/wrangler.jsonc
   ```
2. **Migration live.** Chỉ thêm bảng và cột, code đang chạy vẫn hoạt động bình thường với schema mới.
   ```
   wrangler d1 migrations apply afyllx-classhub-live --remote --config cloud/wrangler.jsonc
   ```
3. **Kiểm tra không còn migration chờ:** chạy `wrangler d1 migrations list <db> --remote --config cloud/wrangler.jsonc` cho từng database.
4. **Build và triển khai Worker.**
   ```
   node scripts/build-cloud.mjs
   wrangler deploy --config .wrangler/web-build/afyllx_classhub/wrangler.json
   ```
   Ghi lại version ID mới từ kết quả lệnh.
5. **Kiểm tra sau triển khai, chỉ đọc, không ghi dữ liệu thật:**
   - `GET https://edu.afyllx.com/classhub/api/health` trả 200.
   - `/classhub/hs` mở được. Chưa có trường nào công bố nên trang hiện lịch mẫu.
   - `/classhub/gv` hiện màn đăng nhập giáo viên.
   - `/classhub/thu` (bản dùng thử) mở được trang Hôm nay.
   - `wrangler tail afyllx-classhub` trong vài phút không có lỗi 5xx.
   - Chủ đơn vị đăng nhập quản trị và thấy mục **Thời khóa biểu**, các mục trường học trong **Thiết lập**, và ba tab trong **Báo cáo**.

## Quay lui

- **Worker:** `wrangler rollback 14c254ff-0ab0-4cfd-abc2-b2a7abded68b --name afyllx-classhub`. Code cũ chạy được với schema mới. Riêng lệnh dọn bản dùng thử của code cũ không xóa các bảng mới, nên những không gian dùng thử đã tạo dữ liệu trường học sẽ không dọn được cho tới khi triển khai lại bản mới.
- **Database:** migration chỉ thêm bảng và cột nên thường không cần hoàn tác. Nếu bắt buộc, dùng `wrangler d1 time-travel restore <db> --bookmark=<mốc>` với mốc đã lưu trong thư mục sao lưu. Lệnh này **xóa mọi thay đổi sau mốc**, nên chỉ chạy khi chủ dự án đồng ý.

## Sau khi triển khai (chủ đơn vị tự làm trên giao diện)

1. **Thiết lập:** thêm học kỳ, bấm **Thêm bộ môn THCS**, chỉnh rồi lưu **Khung giờ tiết**, thêm các ngày nghỉ đã biết.
2. **Nhân sự:** mời từng giáo viên và gửi riêng **link kích hoạt** (hiệu lực 24 giờ).
3. **Thời khóa biểu → Phân công:** chọn GVCN và giáo viên bộ môn cho 8 lớp.
4. **Soạn:** xếp tiết từng lớp, có thể dán từ Excel. **Công bố:** chọn ngày áp dụng. ClassHub tạo buổi điểm danh cho 14 ngày tới.
5. **Thiết lập → Trang học sinh:** chọn tên ngắn, bấm Công bố, rồi gửi link cho học sinh.

## Không thay đổi trong lần này

Worker MealCheck `my-website`, D1 MealCheck, khóa QR, gateway `afyllx-edu` và custom domain không bị sửa. Bản dùng thử vẫn dùng D1 demo riêng.
