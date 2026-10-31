## Thay đổi

Nêu lỗi/tính năng và kết quả đối với người dùng.

## Kiểm tra

- [ ] `pnpm check`
- [ ] `pnpm build`
- [ ] `node scripts/local-qa.mjs`
- [ ] Nếu có schema migration: kèm kế hoạch backup, áp dụng và rollback dữ liệu.
- [ ] Không có dữ liệu học sinh, token, khóa QR hoặc khóa ký APK trong diff.

## Triển khai

Được một người khác review trước khi merge vào `main`. Đổi schema/secret cần thao tác riêng theo DEPLOYMENT.md.
