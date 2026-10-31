# Triển khai Cloudflare và chuyển dữ liệu

## Điều kiện

- Repository phải private, `main` là production; tạo bằng tài khoản GitHub được chủ dự án cấp quyền.
- Cloudflare có Workers Free và D1; kiểm tra tài khoản đang ở gói Free. Không nâng cấp, thêm billing hoặc mua tên miền tự động.
- Có bản sao dữ liệu đã kiểm tra và **đúng khóa QR cũ**. Sites che giá trị secret sau khi lưu; source và token QR không khôi phục được khóa AES-GCM.
- Chốt thời điểm chuyển dữ liệu với người quản lý trước khi ngừng ghi ở hệ thống cũ. Không tự đổi, khóa hoặc xóa Site cũ.

## Provision

1. `pnpm cf login`, `pnpm cf whoami`; người sở hữu tự hoàn tất OAuth và quyền cần thiết. CLI không được suy ra quyền từ phiên đăng nhập quản trị của ứng dụng.
2. Tạo hai database **mới**, không dùng database sản xuất cũ:

```sh
pnpm cf d1 create afyllx-mealcheck-production
pnpm cf d1 create afyllx-mealcheck-preview
```

3. Đặt `CF_PRODUCTION_D1_ID` và `CF_PREVIEW_D1_ID` từ kết quả thật, chạy `node scripts/configure-cloudflare.mjs production` và `node scripts/configure-cloudflare.mjs preview`. Các ID D1 không phải secret. Những UUID 00000000 trong bản chuẩn bị chỉ dành cho local và bị guard từ chối deploy.
4. Preview dùng khóa QR mới chỉ cho dữ liệu demo, `pnpm cf secret put MEALCHECK_QR_KEY --env preview`. Không dùng khóa hoặc backup sản xuất trên preview. Áp migrations vào **preview** bằng `pnpm cf d1 migrations apply DB --env preview --remote`.

## Backup và restore

Bản sao hiện có được đọc qua công cụ Sites từng bảng, đã kiểm tra tất cả trang và không có ô/dòng bị cắt. Nó không phải transaction snapshot; dữ liệu phát sinh sau lần đọc không có trong bản sao. Chỉ nhập vào D1 mới sau khi có bản chốt cuối và được người quản lý chấp thuận.

```sh
node scripts/prepare-backup.mjs /private/sites-d1-backup.json /private/.migration-private/mealcheck-restore.sql
```

Script từ chối bản sao thiếu, cột sai hoặc khóa ngoại hỏng; tạo SQL chứa schema, indexes, dữ liệu, triggers và lịch sử migration D1. Các trigger chỉ tạo sau khi nhập dữ liệu lịch sử để không sinh thêm bản ghi/outbox. SQL và manifest chứa thông tin riêng: giữ ngoài Git, không upload làm CI artifact.

Đặt khóa QR cũ bằng cơ chế secret riêng. Chạy `node scripts/verify-qr-key.mjs /private/sites-d1-backup.json` với `MEALCHECK_QR_KEY` trong môi trường; nó phải xác minh tất cả thẻ trước khi chuyển. Không gõ khóa vào prompt hoặc commit. Sau đó `pnpm cf secret put MEALCHECK_QR_KEY` để lưu vào Worker sản xuất.

Chạy `node scripts/import-backup.mjs BACKUP.json RESTORE.sql` với `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` và khóa QR cũ trong môi trường. Công cụ kiểm tra database đích hoàn toàn mới/rỗng, khóa đúng và SQL đúng bản sao; từ chối ghi đè bảng có sẵn, sau import đối chiếu hash và số dòng. Nếu import lỗi giữa chừng, dừng và dùng database mới khác sau khi kiểm tra; không tự xóa phần đã nhập. Không chạy migrations lịch sử thêm lần nữa sau import, vì lịch sử đã được đánh dấu.

Giữ QR token, ID học sinh và snapshot điểm danh cũ. Cookie máy quét thuộc domain cũ nên cần mở lại máy quét trên host mới; thẻ QR không đổi khi dữ liệu và khóa giữ nguyên.

## CI/CD

Nếu tiếp tục dùng bảng tính cũ, lấy `GOOGLE_SPREADSHEET_ID` từ bản cấu hình riêng đã lưu ngoài repository và đặt trên Worker. Không còn hardcode ID bảng cá nhân trong source. `GOOGLE_SERVICE_ACCOUNT_JSON` vẫn cần được người quản lý cấp riêng; chưa có credential này trên hệ thống nguồn.

Tạo repository variables `CLOUDFLARE_ACCOUNT_ID`, `CF_PRODUCTION_D1_ID`, `CF_PREVIEW_D1_ID`. Cloudflare API token cần quyền Workers Scripts Edit và D1 Edit trên tài khoản đích, chỉ cấp phạm vi cần dùng. Người sở hữu tự phê duyệt việc tạo credential/quyền đó. Lưu token vào secret `CLOUDFLARE_API_TOKEN` của GitHub environment tương ứng; không đặt khóa QR trong GitHub Actions. Worker giữ runtime secret của nó khi deploy code.

Production và preview nên dùng account/token tách biệt; không chạy workflow preview cho code chưa tin cậy. Nếu gói GitHub hỗ trợ required reviewers cho environment private, bật review cho `production` và `preview`. Không giả định tính năng trả phí đã bật.

- CI: install → source check → lint → typecheck → unit tests → build → local integration.
- Production: kiểm thử lại, xác nhận merge vào main có review APPROVED của người khác có quyền write/maintain/admin, rồi cấu hình D1 → build → deploy. Direct push không tự deploy.
- Lần deploy đầu: người sở hữu đặt `MEALCHECK_BOOTSTRAP_SHA` bằng đúng commit đã duyệt rồi chạy Production thủ công trên `main`. Xóa variable bootstrap sau lần đầu. Đây là ngoại lệ có kiểm soát cho repo chưa có PR merge.
- Preview: workflow_dispatch với một ref tin cậy, build và deploy vào Worker/D1 riêng; không tự trao token cho PR từ fork.
- Schema migration: thao tác được review riêng với backup; không có bước tự migrate trong CI production.

## Rollback

Trước deploy ghi lại `pnpm cf deployments list`. Nếu bản mới lỗi, `pnpm cf rollback VERSION_ID` chọn ID thật từ kết quả deployment/version của Worker. Không đoán ID. Rollback code không rollback D1; chỉ áp schema tương thích ngược hoặc chuẩn bị database khôi phục mới và được duyệt trước. Bản SQL khôi phục chứa các trigger cùng phiên bản source.

Không redirect hoặc đóng Site cũ trước khi đối chiếu dữ liệu, thử QR/camera, chức năng xuất báo cáo và URL mới. Tạo URL mới thực tế xong mới build APK 1.0.1 cho domain mới; APK 1.0.0 vẫn trỏ tới Site cũ.

## Miễn phí và giới hạn

Workers/D1 có gói Free với hạn mức; không cam kết miễn phí vô hạn. Kiểm tra request/ngày, CPU, D1 rows read/written và dung lượng sau khi chạy thử. Nhiều màn hình mở lâu với SSE/polling có thể chạm hạn mức. GitHub Actions private cũng có quota theo tài khoản. Không tự bật trả phí khi hết quota.

Nguồn: https://developers.cloudflare.com/workers/platform/pricing/ ; https://developers.cloudflare.com/d1/platform/pricing/ ; https://developers.cloudflare.com/d1/best-practices/import-export-data/ ; https://developers.cloudflare.com/workers/configuration/versions-and-deployments/rollbacks/
