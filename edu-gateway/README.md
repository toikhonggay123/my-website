# Gateway AFYLLX Edu

`afyllx-edu` phục vụ portal trên `edu.afyllx.com`. Gateway chuyển `/classhub` và các đường dẫn con tới Worker `afyllx-classhub`. Các đường dẫn MealCheck tiếp tục dùng binding tới `my-website`. Endpoint liên hệ thuộc gateway.

Thư mục này lưu mã định tuyến, cấu hình binding và bài kiểm thử. Khi triển khai, dùng các tệp `worker/` và `wrangler.jsonc` này trong checkout portal có thư mục `dist/` đã build. Chạy `node --test edu-gateway/tests/*.test.mjs` từ cấp repository để kiểm tra định tuyến trước khi phát hành.
