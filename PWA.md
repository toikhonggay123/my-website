# MealCheck trên Android và iPhone

Link cài: https://my-website.fyllxestonia.workers.dev/cai-dat. Dashboard đặt QR/link cài ngay đầu trang. Manifest dùng standalone, icon PNG 192/512, maskable và Apple touch icon; giao diện hỗ trợ safe area, bàn phím không tự zoom trên iOS, nút chạm lớn và chế độ quét toàn màn hình dự phòng.

Android: mở bằng Chrome, bấm Cài ứng dụng; nếu trình duyệt chưa cung cấp hộp cài, dùng menu Cài đặt ứng dụng/Thêm vào màn hình chính. iPhone/iPad: mở Safari, Chia sẻ, Thêm vào Màn hình chính, bật Mở như ứng dụng web nếu có. Trình duyệt quyết định việc hiển thị hộp cài; website không tự cài thay người dùng.

## Lưu trên từng thiết bị

- Âm báo, rung, nhớ bữa và giữ màn hình sáng tự bật, không có công tắc. Chỉ bữa đã chọn trong cùng ngày Việt Nam được lưu trên máy; các cờ tắt trước đây không còn được dùng. Rung và giữ sáng phụ thuộc hỗ trợ trình duyệt. Mở camera/chọn ảnh sẽ chuẩn bị âm thanh; iOS có thể không hỗ trợ rung web.
- Camera/giải mã ảnh QR chạy trên thiết bị. Tab ẩn sẽ dừng camera. Wake lock được nhả khi dừng quét và thử xin lại khi quay về nếu camera còn chạy.
- Lượt quét chờ nằm trong IndexedDB, chỉ có ciphertext QR, mã yêu cầu, môi trường, phiên ăn, thời điểm và trạng thái. Không lưu họ tên, danh sách học sinh hoặc khóa giải mã trong hàng đợi.
- Phải mở máy quét một lần khi có mạng trên chính app/thiết bị để đăng ký máy quét. iOS có thể tách dữ liệu Safari và app Màn hình chính; hãy mở app đã cài khi có mạng lần đầu.
- Khi mất mạng, lưu lượt trước, hiển thị chờ đồng bộ; không có dấu tích thành công hoặc tăng số điểm danh. Mở/giữ app khi có mạng để đồng bộ, khi tab đang hiển thị tự thử mỗi 10 giây. Không phụ thuộc Background Sync vì mức hỗ trợ khác nhau giữa Android/iOS.
- Gửi lại giữ nguyên request ID; máy chủ tiếp tục kiểm tra mã hóa, thiết bị, phiên/ngày, trạng thái học sinh và chống trùng. HTTP 4xx được giữ riêng để người dùng kiểm tra, không tự đổi ngày/bữa hoặc bỏ qua thu hồi. HTTP 5xx và lỗi mạng giữ pending.
- Không gỡ app, xóa dữ liệu trình duyệt hay chuyển sang app/browser khác khi còn lượt chờ; hàng đợi không tự chuyển giữa thiết bị. Có thể bỏ lượt bị từ chối sau khi kiểm tra; thao tác này không xóa bản ghi máy chủ.

## Offline và cập nhật

Service worker chỉ cache shell HTML của dashboard/trang cài, tệp JS/CSS có hash, manifest, icon, QR cài app và trang offline chung. Không cache `/api/`, POST, JSON roster, báo cáo hoặc thẻ QR học sinh. App có thể mở màn hình quét từ shell đã chuẩn bị và thông tin boot không chứa roster. Cần tải app online trước để có shell/chunk giải mã.

Build tạo `dist/client/precache.json` từ các tệp JS/CSS có hash. Lần cài service worker đầu tiên lưu các module đó cùng shell để mở lại offline không phụ thuộc HTTP cache của trình duyệt. Chỉ chấp nhận đường dẫn asset nội bộ `/_next/static/`; không nhận URL API hay URL ngoài.

Cập nhật mới hiển thị nút Cập nhật ứng dụng; dừng camera trước khi đổi service worker và tải lại trang. IndexedDB giữ hàng đợi qua cập nhật. Khi thay service worker/cache policy, tăng tên cache `mealcheck-pwa-v...`; chỉ dọn cache mang prefix của app. Không xóa toàn bộ cache/storage của origin.

## Kiểm tra

Unit tests kiểm tra chờ offline, trùng bữa, mất phản hồi sau ghi, gửi lại cùng ID, lỗi máy chủ/QR/ngày/thiết bị, tách môi trường và lỗi bộ nhớ. Kiểm tra API/build dùng database QA riêng. Không ghi thử điểm danh vào 34 học sinh thật. Không đổi QR/khóa/database trong công việc PWA.

Đã thử trên trình duyệt với QA riêng: quét ảnh online; tắt máy chủ rồi quét ảnh khác bữa tạo đúng một pending không hiện thành công; nối lại máy chủ làm số lượt tăng 4 lên 5 và hàng đợi hết; cập nhật service worker qua nút trong app; tải lại từ shell khi máy chủ tắt; giao diện 390px/412px và hướng dẫn iOS/Android không tràn. Chưa cài thử trên điện thoại Android/iPhone thật hoặc thử camera, rung và wake lock bằng phần cứng thật.

Nguồn kỹ thuật: [MDN PWA installation](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable), [WebKit Home Screen web apps](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/), [MDN Screen Wake Lock](https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API).

## Máy quét tự bật tiện ích

Âm báo, rung khi xác nhận, nhớ bữa trong ngày trên thiết bị và giữ màn hình sáng lúc camera chạy luôn được bật; không còn nút/công tắc cho bốn mục này. Các thiết lập tắt cũ không được sử dụng. Âm báo cần thao tác mở camera/chọn ảnh; rung và giữ sáng phụ thuộc hỗ trợ của thiết bị. Popup kính mờ xuất hiện ngay trong vùng camera sau xác nhận máy chủ, tự ẩn sau 3 giây và không chặn quét tiếp. Quét trùng dùng thông báo màu vàng, không tính thêm suất; mất mạng chỉ báo chờ đồng bộ.

## Giao diện quét tập trung

Màn quét trên điện thoại phủ toàn trang, camera làm nền, khung vuông bo góc và đường quét chuyển động (tắt chuyển động khi người dùng bật reduced motion). Thanh dưới chọn bữa và đổi camera; hai nút Chọn ảnh QR và Mở/Tắt camera. Thẻ QR được quản lý trong Học sinh → Thẻ QR học sinh. Tùy chọn camera và toàn màn hình nằm ở góc trên; đèn flash chỉ hoạt động khi track hỗ trợ. Camera không tự xin quyền khi mở trang, giáo viên chủ động bấm Mở camera. Desktop giữ sidebar và khung quét lớn. Popup 3 giây nằm chính giữa khung, không khóa quét tiếp hoặc trì hoãn lưu; offline tiếp tục chờ xác nhận như trước.

## Tương thích iPhone/iPad

- Trên iPhone/iPad, nút hướng dẫn cài mở các bước Safari → Chia sẻ → Thêm vào Màn hình chính. Website không tự hiện hộp cài như Android. Trên iPadOS dùng giao diện desktop, nhận diện bằng thông tin Mac và màn hình cảm ứng.
- Khi kết nối IndexedDB bị đóng trong lúc app tạm dừng, ứng dụng mở lại kết nối. Chỉ thử lại thao tác chưa tạo transaction; không tự lặp lại một giao dịch ghi đã bắt đầu.
- Gửi hàng đợi dùng AbortController và bộ hẹn giờ, không bắt buộc Safari phải có AbortSignal.timeout. Đọc ảnh QR có phương án dùng phần tử ảnh nếu ImageBitmap thiếu hoặc không đọc được định dạng.
- Khi app quay lại màn hình hoặc có mạng, kiểm tra cập nhật service worker. Theo dõi cả worker đang cài từ trước, không chỉ sự kiện updatefound mới.
- Đã kiểm tra bằng Chromium với profile iPhone SE/iPhone 13/iPad, mô phỏng các API Safari thiếu và chạy service worker thật trên HTTP cục bộ: mở offline, giữ request ID qua cập nhật, gửi lại sau khi có mạng. Đây không phải bằng chứng đã thử Safari/WebKit hoặc cài lên iPhone thật. WebKit hiện chưa tải được vì chính sách mạng; cần kiểm tra tiếp camera, cài từ màn hình chính và hệ điều hành tạm dừng app trên thiết bị iOS thật.

## Biểu tượng ứng dụng AFYLLX
Icon Android 192/512 px, maskable 512 px, Apple touch icon 180 px và favicon đều dùng logo AFYLLX đã duyệt, nền trắng. Đường dẫn `afyllx-*` tách khỏi đường dẫn cũ để tránh giữ icon cũ trong cache; service worker dùng phiên bản cache v9. Giữ nguyên manifest id, start_url và dữ liệu ứng dụng.

Khi cài mới, Android và iPhone lấy bộ icon này. Với app đã cài, hệ điều hành/trình duyệt quyết định thời điểm đổi icon; cập nhật nội dung app không bảo đảm đổi ngay biểu tượng màn hình chính. Không xóa dữ liệu/gỡ app khi còn lượt quét chờ đồng bộ. Tham khảo [Chrome về cập nhật web app](https://developer.chrome.com/blog/improvements-to-web-app-updates) và [Apple về apple-touch-icon](https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/ConfiguringWebApplications/ConfiguringWebApplications.html).


Trang Tổng quan dùng liên kết Cài ứng dụng thu gọn ở gần đầu trang; mở để xem QR/hướng dẫn. Trong app standalone hoặc sau khi trình duyệt báo appinstalled, liên kết này được ẩn. Trang cài đặt /cai-dat vẫn cung cấp hướng dẫn và link chia sẻ.
