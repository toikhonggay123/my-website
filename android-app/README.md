# APK cho host mới

Source giữ camera, chọn ảnh, lưu PNG, in/PDF, splash và thông báo lỗi mạng. Host HTTPS được đưa vào BuildConfig khi build; không còn URL hosting cũ trong ứng dụng.

Chỉ dựng khi URL độc lập đã được triển khai và xác minh. Chưa có URL mới thì không tạo APK giả hoặc đổi APK cũ.

Thiết lập biến môi trường:

- `MEALCHECK_URL`: origin HTTPS thật, không có `/quan-tri` (ứng dụng tự nối đường dẫn).
- `ANDROID_TOOLS_JSON`: file JSON riêng với đường dẫn `jdk`, `buildTools`, `androidJar` của Android SDK/JDK.
- `OUTPUT_DIR`: thư mục artifact ngoài source; nên dùng đường dẫn ASCII cho Android tools trên Windows.
- `SIGNING_KEYSTORE`, `SIGNING_PASSWORD_FILE`: đường dẫn đến khóa ký và password file cũ. Không gửi vào Git hoặc Codex Cloud.

Chạy `python build.py`. Phiên bản cập nhật là 1.0.1, versionCode 2, package giữ `vn.afyllx.mealcheck`. Script yêu cầu khóa ký hiện có, không tự sinh khóa khác; từ chối ghi đè artifact. Sau build cần cài thử trên Android và kiểm tra camera trước khi phát hành. APK 1.0.0 đã bàn giao trước đây vẫn mở host cũ.
