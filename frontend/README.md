# Frontend

React (JavaScript/JSX), Vite và Tailwind CSS.

## Chạy dự án

```sh
npm install
npm run dev
```

Mở địa chỉ được Vite hiển thị trong terminal.

Các API catalog, địa chỉ, kho/sản phẩm và đặt đơn hiện chạy qua backend Python.
Chạy backend cổng 8000 theo [backend/README.md](../backend/README.md) trước.
Vite proxy `/api` tới backend; khi deploy khác origin, đặt `VITE_API_URL` gồm `/api`.
Supabase client chỉ tiếp tục xử lý đăng nhập/đăng ký/reset mật khẩu.

Khi tải từ GitHub, ảnh sản phẩm và catalog quần áo đã có trong `public/img/clothing` và `src/data/products.js`; không cần tải lại ZIP để chạy ứng dụng. Backend local được khởi tạo bằng `python -m app.init_db`. Tạo file cấu hình từ `frontend/.env.example` và `backend/.env.example` rồi điền thông tin Supabase của project bạn dùng. Database và các đơn mẫu trên máy tác giả không nằm trong repo; dùng cùng database Supabase để xem dữ liệu demo hiện có.

Tìm kiếm ở header dẫn tới `/search?q=...`, hỗ trợ Việt/Anh và từ không dấu,
lọc theo loại/màu/size, sắp xếp và xem thêm như trang danh mục. Khi API mất kết nối,
catalog tĩnh vẫn cho phép duyệt/tìm kiếm và báo đang dùng dữ liệu dự phòng;
không giả lập tồn kho hoặc kết quả lưu địa chỉ/đặt đơn.

## Cấu trúc

- `src/App.jsx`: giao diện chính.
- `src/components/`: component dùng chung.
- `src/pages/`: các trang.
- `src/assets/`: ảnh, font được import trong code.
- `src/index.css`: import Tailwind và CSS toàn cục.
- `public/`: tài nguyên tĩnh.

Build production: `npm run build`. Xem bản build: `npm run preview`.

Cấu hình Tailwind theo https://tailwindcss.com/docs/installation/using-vite.
