# Logo AFYLLX

## Cấu trúc thương hiệu — 03/11/2026

AFYLLX là công ty mẹ; AFYLLX EdTech là phần mềm/hệ sinh thái con; MealCheck là sản phẩm thuộc EdTech. Tên sản phẩm hiển thị thống nhất là **EdTech MealCheck**. Logo AFYLLX được giữ nguyên.

Menu và màn hình tải dùng tên công ty nhỏ phía trên tên sản phẩm. Trang chủ có nhận diện này ở đầu trang cùng dòng “Thuộc AFYLLX EdTech”. Cuối sidebar và menu điện thoại có AFYLLX, AFYLLX EdTech / MealCheck và email hỗ trợ **contact.afyllx@gmail.com** dạng liên kết mailto. Email chỉ mở trình soạn thư, không tự gửi.

Tên hiển thị trên trình duyệt, trang cài ứng dụng, manifest/PWA, máy quét, thẻ xem/in/PNG và báo cáo dùng EdTech MealCheck. Nhãn trong source Android cũng được cập nhật; thay đổi source không tự đổi APK đã cài. Hệ điều hành quyết định thời điểm cập nhật tên của PWA đã cài.

Đây là thay đổi nhận diện. Giữ nguyên định dạng/token QR, chuỗi AAD mã hóa, khóa, dữ liệu và manifest id/start_url. Trường `app` của API health là định danh tương thích cho launcher và bộ kiểm tra, không phải tên hiển thị.

The owner supplied the AFYLLX blue mark on 2 November 2026 and requested replacing the cutlery brand mark. `public/brand/afyllx-logo.png` is the transparent PNG used in navigation, the dashboard, settings, printed cards and PNG card exports.

The built-in image editing tool removed the white background. Prompt: remove only the white background and negative spaces, preserve the logo silhouette, proportions and blue gradients, and add no text, shadow or background tile. The selected result was inspected and resized for web use. The original attachment and unused alternatives remain outside the repository.

Run `python scripts/build-pwa-icons.py` with Pillow installed to derive the 192/512 px app icons, 180 px Apple touch icon and 32 px browser icon. App icons have a white background and keep the full mark within the central maskable safe circle. The website logo itself retains transparency.

This change affects branding only. It does not replace QR tokens, issue cards again or change attendance data. Reload/reprint an existing card to obtain the updated artwork with its existing QR.
