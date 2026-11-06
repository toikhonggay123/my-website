# Website AFYLLX

Website thương hiệu AFYLLX giới thiệu ba lĩnh vực Edu, Digital và Gov trong không gian kính đen–xanh Blue Depth. Three.js dựng ánh sáng, vật liệu và camera. GSAP ScrollTrigger liên kết hành trình với vị trí cuộn. Chế độ giảm chuyển động và trình duyệt gặp lỗi WebGL dùng ảnh render của cùng cảnh.

Chạy từ thư mục `afyllx-web` với Node.js 24 và pnpm 10.31.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Mở `http://127.0.0.1:4321/`. Server chỉ nghe trên loopback. `pnpm check` kiểm tra Astro và TypeScript. `pnpm build` tạo website tĩnh trong `dist/`. Sau khi dừng dev server, có thể dùng `pnpm preview` để mở bản build trên cùng cổng.

Nội dung các lĩnh vực nằm trong `src/data.js`. Ảnh tĩnh trong `public/afyllx-media` được render từ `src/motion/depth-scene.js`. Biểu mẫu liên hệ mở bản nháp trong ứng dụng email của người dùng.

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

Các khối AFYLLX được dựng trực tiếp bằng Three.js: ba hình điêu khắc trong `src/motion/sculpture-models.js`, vật liệu, ánh sáng, mặt phản chiếu và camera trong `src/motion/depth-scene.js`. Hero và các chương dùng cùng cảnh chuyển động; các trang riêng dùng góc máy `detail`. Ảnh dự phòng được render từ chính bộ dựng này để giữ cùng hình dáng và bố cục khi giảm chuyển động hoặc WebGL không hoạt động.

Sau khi ổn định hình khối và ánh sáng, mở Astro dev server rồi chạy:

```sh
pnpm render:posters
```

Lệnh dùng URL `http://127.0.0.1:4321` mặc định. Có thể chọn dev server khác bằng biến `AFYLLX_TEST_URL`; bản `pnpm preview` không cung cấp module nguồn cần để render. Trên Windows, lệnh dùng Edge đã cài và GPU mặc định, không ép bộ dựng giả lập.

`scripts/render-posters.mjs` chờ ảnh tra cứu SMAA tải xong, dựng cảnh tại thời điểm cố định, kiểm tra framebuffer phủ kín hơn 99% rồi mã hóa WebP chất lượng 95% bằng trình duyệt. Ảnh được ghi vào `public/afyllx-media`:

- `depth-{hero,edu,digital,gov,panorama}.webp`: cảnh ngang, 2400 × 1500 px.
- `depth-{hero,edu,digital,gov,panorama}-mobile.webp`: cảnh dọc, 810 × 1752 px.
- `sculpture-{hero,edu,digital,gov}.webp`: góc máy riêng cho trang lĩnh vực và thẻ giới thiệu, 1920 × 1440 px.

Các ảnh dùng mật độ điểm ảnh 1,5× và được tái tạo khi thay mô hình hoặc ánh sáng. Lệnh giải phóng tài nguyên của từng cảnh và đóng trình duyệt sau khi hoàn tất.
