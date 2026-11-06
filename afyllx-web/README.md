# Website AFYLLX

Website thương hiệu AFYLLX giới thiệu ba lĩnh vực Edu, Digital và Gov trên nền xanh đêm. Three.js dựng ba vật thể, ánh sáng và camera; một bộ điều khiển cuộn riêng (`src/motion/stage-journey.js`) gắn chúng với vị trí cuộn. Chế độ giảm chuyển động và trình duyệt gặp lỗi WebGL dùng ảnh render của cùng cảnh.

Chạy từ thư mục `afyllx-web` với Node.js 24 và pnpm 10.31.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Mở `http://127.0.0.1:4321/`. Server chỉ nghe trên loopback. `pnpm check` kiểm tra Astro và TypeScript. `pnpm build` tạo website tĩnh trong `dist/`. Sau khi dừng dev server, có thể dùng `pnpm preview` để mở bản build trên cùng cổng.

Nội dung các lĩnh vực nằm trong `src/data.js`. Ảnh tĩnh trong `public/afyllx-media` được render từ `src/motion/stage-scene.js`. Biểu mẫu liên hệ mở bản nháp trong ứng dụng email của người dùng.

## Kiểm tra 3D

Mở preview rồi chạy `pnpm test:webgl`. Có thể chọn URL bằng biến môi trường `AFYLLX_TEST_URL`. Trên Windows, bài kiểm tra dùng Edge đã cài và GPU thật, không ép SwiftShader. Dùng `pnpm test:webgl --software` để đối chiếu thêm với bộ dựng giả lập. Ảnh kiểm tra được lưu trong `.preview/webgl-hardware` hoặc `.preview/webgl-software`.

Bài kiểm tra đọc framebuffer để phát hiện cảnh rỗng hoặc chỉ vẽ một phần, so sánh hai khung hình để phát hiện animation đứng, rồi kiểm tra mọi chương, cuộn ngược, viewport cao/mobile, mở thẳng chương, đổi tab và các trang riêng.

Không bật MSAA trên render target của EffectComposer: khi kết hợp UnrealBloomPass trên NVIDIA/ANGLE D3D11, bản cũ xuất khung hình rỗng hoặc chỉ còn một dải nhỏ dù không có lỗi WebGL. Đã tái hiện với GPU RTX 3080 Laptop; SwiftShader không tái hiện được nên kiểm tra giả lập riêng từng bỏ sót lỗi. Bộ dựng giữ HDR và bloom, dùng [SMAAPass trước OutputPass](https://threejs.org/docs/pages/SMAAPass.html) để làm mịn cạnh.

## Cloudflare

Website được triển khai bằng cấu hình `wrangler.jsonc` vào Worker tĩnh `afyllx-web`, không gắn tên miền trực tiếp. Worker `my-website` đang sở hữu `afyllx.com` chuyển các trang thương hiệu và ba tiền tố tài nguyên `afyllx-assets`, `afyllx-brand`, `afyllx-media` sang service binding `AFYLLX_WEB`. Các đường dẫn ứng dụng, API và PWA tiếp tục qua handler hiện có. Cổng `edu.afyllx.com` dùng gateway riêng.

Sau khi chạy `pnpm check` và `pnpm build` tại đây, từ thư mục cha chạy:

```sh
node scripts/cli.mjs wrangler deploy --config afyllx-web/wrangler.jsonc
```

Khi thay đổi quy tắc định tuyến hoặc binding lần đầu, cần kiểm tra và triển khai Worker cha bằng `pnpm build:cloud` và `pnpm deploy:cloud`. Các lần sửa giao diện sau chỉ cần triển khai Worker tĩnh. Không chạy migration hoặc thay secrets cho website thương hiệu.

## Cảnh 3D và ảnh dự phòng

Màn hình đầu trang chủ là HTML/CSS tĩnh: logo AFYLLX, hai vòng sáng và ba thẻ chương. Bên dưới là một sân khấu ghim cố định (`.stage`): chữ của chương ở bên trái, một vật thể 3D ở bên phải (trên điện thoại: vật thể ở trên, chữ ở dưới) và thanh ba chương có vạch tiến độ ở đáy.

- `src/motion/stage-objects.js`: ba vật thể. Edu là quyển sách bìa cứng mở ra, lật ba trang có độ cong như giấy rồi đưa lên thước kẻ, ê-ke và bút. Digital là cửa sổ website tự lắp nội dung theo thứ tự đọc, kèm bảng mã, điện thoại và con trỏ bấm nút. Gov là ngôi sao năm cánh nhiều mặt cắt có lõi pha lê, ba nguồn sáng màu bay quanh để vệt sáng lướt trên các mặt, các cạnh sáng dần và tia sáng phía sau.
- `src/motion/stage-scene.js`: ánh sáng, camera, vị trí đặt vật thể và chuyển giao giữa các chương. Chế độ `journey` dùng cho trang chủ, `detail` cho trang lĩnh vực, `lineup` cho trang Về AFYLLX và ảnh chia sẻ.
- `src/motion/stage-journey.js`: đổi vị trí cuộn thành chương và thời gian trong chương, rồi điều khiển cả chữ lẫn vật thể theo cùng một mốc.

Mỗi chương có cùng một dòng thời gian: vào 0–0,12, phóng ra 0,12–0,66, giữ 0,66–0,78, thu gọn 0,78–0,94, rời sân khấu 0,9–1. Chỉ một vật thể ở trên sân khấu tại một thời điểm. Các bước là hàm của vị trí cuộn, nên cuộn ngược sẽ chạy ngược đúng trình tự; ba từ khoá của chương sáng dần theo tiến độ phóng ra. Mỗi chương dài `--chapter` (110svh khi dùng chuột, 300svh trên điện thoại). Sân khấu không bám tức thời theo con lăn: nó đuổi theo vị trí cuộn bằng lò xo mềm (0,45 s) với tốc độ tối đa 0,38 chương mỗi giây, nên một cú lăn mạnh vẫn phát từng bước đủ chậm để nhìn rõ; liên kết `#chuong-edu`, `#chuong-digital`, `#chuong-gov` dẫn tới điểm giữ của chương. Vật thể nghiêng theo hướng con trỏ chuột. Trang lĩnh vực phát trình tự phóng ra một lần khi mở.

Ảnh dự phòng được render từ chính bộ dựng này để giữ cùng hình dáng và bố cục khi giảm chuyển động hoặc WebGL không hoạt động.

Sau khi ổn định hình khối và ánh sáng, mở Astro dev server rồi chạy:

```sh
pnpm render:posters
```

Lệnh dùng URL `http://127.0.0.1:4321` mặc định. Có thể chọn dev server khác bằng biến `AFYLLX_TEST_URL`; bản `pnpm preview` không cung cấp module nguồn cần để render. Trên Windows, lệnh dùng Edge đã cài và GPU mặc định, không ép bộ dựng giả lập.

`scripts/render-posters.mjs` chờ ảnh tra cứu SMAA tải xong, dựng từng cảnh trên một canvas riêng, kiểm tra framebuffer phủ kín hơn 99% rồi mã hóa WebP chất lượng 95% bằng trình duyệt. Ảnh được ghi vào `public/afyllx-media`:

- `depth-{edu,digital,gov}.webp`: sân khấu ngang tại điểm giữ của chương, 2400 × 1500 px.
- `depth-{edu,digital,gov}-mobile.webp`: sân khấu dọc, 810 × 1752 px.
- `depth-hero.webp`: ba vật thể cạnh nhau, dùng làm ảnh chia sẻ mặc định.
- `sculpture-{hero,edu,digital,gov}.webp`: góc máy riêng cho trang lĩnh vực và thẻ giới thiệu, 1920 × 1440 px.

Các ảnh dùng mật độ điểm ảnh 1,5× và được tái tạo khi thay vật thể hoặc ánh sáng.
