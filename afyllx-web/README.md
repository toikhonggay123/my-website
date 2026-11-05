# Website AFYLLX

Website thương hiệu AFYLLX giới thiệu ba lĩnh vực Edu, Digital và Gov trong không gian kính đen–xanh Blue Depth. Three.js dựng ánh sáng, vật liệu và camera. GSAP ScrollTrigger liên kết hành trình với vị trí cuộn. Chế độ giảm chuyển động và trình duyệt gặp lỗi WebGL dùng ảnh render của cùng cảnh.

Chạy từ thư mục `afyllx-web` với Node.js 24 và pnpm 10.31.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Mở `http://127.0.0.1:4321/`. Server chỉ nghe trên loopback. `pnpm check` kiểm tra Astro và TypeScript. `pnpm build` tạo website tĩnh trong `dist/`. Sau khi dừng dev server, có thể dùng `pnpm preview` để mở bản build trên cùng cổng.

Nội dung các lĩnh vực nằm trong `src/data.js`. Ảnh tĩnh trong `public/afyllx-media` được render từ `src/motion/depth-scene.js`. Biểu mẫu liên hệ mở bản nháp trong ứng dụng email của người dùng.

## Cloudflare

Website được triển khai bằng cấu hình `wrangler.jsonc` vào Worker tĩnh `afyllx-web`, không gắn tên miền trực tiếp. Worker `my-website` đang sở hữu `afyllx.com` chuyển các trang thương hiệu và ba tiền tố tài nguyên `afyllx-assets`, `afyllx-brand`, `afyllx-media` sang service binding `AFYLLX_WEB`. Các đường dẫn ứng dụng, API và PWA tiếp tục qua handler hiện có. Cổng `edu.afyllx.com` dùng gateway riêng.

Sau khi chạy `pnpm check` và `pnpm build` tại đây, từ thư mục cha chạy:

```sh
node scripts/cli.mjs wrangler deploy --config afyllx-web/wrangler.jsonc
```

Khi thay đổi quy tắc định tuyến hoặc binding lần đầu, cần kiểm tra và triển khai Worker cha bằng `pnpm build:cloud` và `pnpm deploy:cloud`. Các lần sửa giao diện sau chỉ cần triển khai Worker tĩnh. Không chạy migration hoặc thay secrets cho website thương hiệu.

## Hình nền mở đầu

`public/afyllx-media/cinematic-hero.webp` được tạo bằng công cụ ImageGen tích hợp, sau đó chuyển từ PNG sang WebP để dùng trong website. File này là nền điện ảnh của cảnh mở đầu, kết hợp chuyển động ánh sáng và góc nhìn. Các chương tiếp theo dùng cảnh Three.js.

Prompt đã sử dụng

> Use case: stylized-concept. Asset type: production hero environment background for AFYLLX technology brand website, not a mockup, no UI. Create one ultra-premium cinematic 16:9 wide 3D render with a huge pure blue-black negative-space upper 55% for white typography overlaid later. Lower 45% holds an extraordinary abstract architectural landscape of THREE broad curving smoked sapphire glass planes, each a graceful tall folded ribbon with precisely machined blue-black titanium edges. They are staggered at three depths, arranged as a flowing continuous landscape from lower left to lower right, with one in the middle at a slightly larger scale. Not upright phones or rectangular screen frames. Rounded sweeping architectural sculptures, sumptuous deep optical glass, thick refracted cobalt edges, brilliant very thin cold blue light strips tracing curved edges, dimensional blue liquid light caustics on dark polished black floor. A wide vivid cobalt-blue halo and two very broad soft shafts of volumetric blue light behind the sculptures illuminate fine atmospheric haze. Camera is a low architectural 40mm lens, shallow angle, elegant asymmetrical horizon, hyperreal luxury technology launch photography, Octane-quality ray-traced reflections and complex glass optics, immaculate material craft, rich tonal gradients, cinematic film lighting, sophisticated monumental design. Palette 85% near-black navy (#01030a #03091b), deep saturated royal blue accents, small icy blue-white rim highlights. Top half is clean quiet black-blue with barely visible soft atmosphere, no objects in top 50%. Floor ungridded and seamless, smooth subtle mirror reflections. This should feel like an exceptionally art-directed high end Apple product campaign crossed with abstract architectural installation, mesmerizing polished physically plausible surfaces. No text, no logo, no letters, no words, no people, no icons, no panels with interfaces, no computers, no futuristic machinery, no server racks, no grids, no stars, no planets, no HUD, no watermark. Full bleed wide composition.
