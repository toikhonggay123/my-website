# Cộng tác với hai tài khoản Codex

Hai người dùng ChatGPT Plus và GitHub riêng; không chia sẻ phiên đăng nhập, token hoặc workspace ChatGPT.

## Quyền repository

Chủ repository mời GitHub username `SucVatHoaThan` qua Settings → Collaborators → Add people, chọn quyền write nếu được hỏi. Người nhận phải chấp nhận lời mời. Quyền này cho sửa source và mở PR; không cấp tài khoản cloud hoặc runtime secrets cho Codex. Trạng thái lời mời hiện tại được ghi trong MIGRATION_STATUS.md.

Với mỗi tài khoản ChatGPT, kết nối GitHub của chính người đó và cấp ứng dụng Codex quyền với đúng repository private. Tạo Cloud environment riêng: Work in → Cloud → Select environment → Create environment → chọn repository → Get started. Dùng Node 22.22+, `pnpm install --frozen-lockfile`, `pnpm check`, `pnpm build`; kiểm tra setup rồi Publish environment. Mỗi người chỉ dùng môi trường của mình, cùng đọc source từ repository chung.

Đối với dữ liệu sản xuất, chỉ dùng bản ghi giả trong Codex Cloud. Không tải roster, bản sao database hoặc khóa QR sản xuất lên môi trường phát triển. Việc tạo hai môi trường cần đăng nhập và cấp quyền trực tiếp từ hai tài khoản; một kết nối GitHub trong chat không tự cấu hình tài khoản còn lại.

Hướng dẫn OpenAI: https://learn.chatgpt.com/docs/environments/cloud-environments

## Quy trình thay đổi

1. Cập nhật `main`, tạo nhánh `codex/ten-tinh-nang`. Hai người dùng nhánh khác nhau, tránh sửa cùng tệp khi có thể.
2. Sửa code, chạy `pnpm check`, `pnpm build`, `node scripts/local-qa.mjs` khi thay backend/build. Ghi kết quả và giới hạn kiểm tra trong PR.
3. Mở PR vào `main`. Người còn lại review và chấp thuận. Tác giả không tự phê duyệt PR của mình.
4. Kiểm tra CI và ảnh preview nếu thay giao diện. Maintainer có thể chạy workflow Preview cho nhánh tin cậy; môi trường preview chỉ có dữ liệu demo.
5. Merge sau review. Workflow Production kiểm tra commit và người review, kiểm thử lại rồi triển khai.
6. Nếu có migration, backup và duyệt riêng trước khi áp dụng. CI không tự migrate database sản xuất.

## Bảo vệ main và giới hạn gói miễn phí

Nếu gói GitHub cho phép branch protection với private repo, bật yêu cầu PR, một review độc lập, dismiss stale approvals, required check `verify`, chặn force-push và xóa nhánh. Cấu hình này phải được xác minh trong repository, không được suy ra từ việc có workflow YAML.

GitHub Free không hỗ trợ protected branches cho private repository. Không tự mua gói khác hoặc đổi repo thành public. Trong trường hợp đó, quy trình PR là thỏa thuận làm việc; workflow Production từ chối deploy direct push không có PR đã được duyệt. Chủ repository vẫn có thể sửa/bypass workflow, nên đây không thay thế branch protection ở cấp GitHub.

Nguồn: https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches
