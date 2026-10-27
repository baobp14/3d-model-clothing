# BÀN GIAO TOÀN DIỆN DỰ ÁN CHO CLAUDE (CLAUDE CODE)
*Cập nhật: Tối 27/10/2026 bởi Antigravity sau khi hoàn thiện tích hợp Logistics GHN và Phiếu in bưu gửi.*

---

## 1. THÔNG TIN BỐI CẢNH & CON NGƯỜI
- **Người dùng:** Phạm Lê Gia Bảo (`legiabao1407@gmail.com`). 
  - Phong cách: Nói tiếng Việt, thân mật, tin nhắn ngắn, tiết kiệm token/quota.
  - Cách ứng xử: Trả lời bằng tiếng Việt, ngắn gọn, thẳng thắn, làm việc dựa trên test tự động, không nói suông.
- **Đồ án tốt nghiệp (DATN):** Võ Minh Nhật + Phạm Lê Gia Bảo.
  - Giảng viên hướng dẫn: **ThS. Võ Anh Tiến**.
  - Đề cương đã nộp: `C:\Users\legia\Downloads\VoMinhNhat_PhamLeGiaBao_DeCuong_Final_v2.docx` (KHÔNG ĐƯỢC TỰ Ý SỬA).
  - Mục tiêu demo tiến độ: **Thứ Năm ngày 29/10/2026**.
  - Hạn chót hoàn thành toàn bộ: **Trước tháng 12/2026**.
- **Định vị dự án:** Hệ thống TMĐT thời trang may sẵn cao cấp **N&B (N&B Fashion Atelier)** kết hợp công nghệ Thử đồ 3D và Vận hành Logistics thực tế.
  - **Quy tắc thương hiệu:** Hạn chế dùng voucher/khuyến mãi tràn lan không cần thiết để giữ vững định vị thương hiệu may sẵn cao cấp.
  - **Quy tắc thuật ngữ:** Dùng thuật ngữ chuẩn logistics & fulfillment (ví dụ *"Tạo vận đơn GHN"*, *"Mã vận đơn bưu cục"*, *"Phiếu giao hàng & Hóa đơn"*). Tuyệt đối **không để lộ** các từ ngữ nghiệp dư như *"sandbox"*, *"demo"*, *"đẩy đơn"* trên giao diện người dùng.

---

## 2. WORKTREE & GIT CONSTRAINTS
- **Thư mục làm việc chính:** `C:\thuchanh\DoAnTotNghiep-dev`
- **Nhánh hiện tại:** `feat/demo-tmdt` (ĐÃ COMMIT LOCAL, **TUYỆT ĐỐI KHÔNG GIT PUSH** nếu chưa có lệnh rõ ràng của người dùng).
- **Tuyệt đối không:** Đổi remote, force-push, làm lộ key API trong `.env` ra ngoài frontend.

---

## 3. CÁC TÍNH NĂNG MỚI ĐÃ HOÀN THIỆN (27/10/2026)

### 3.1. Tích hợp API Đối tác Vận chuyển GHN (Giao Hàng Nhanh)
- **Cổng kết nối:** GHN Sandbox API Gateway: `https://dev-online-gateway.ghn.vn/shiip/public-api`
- **Tài khoản quản trị của Bảo:**
  - Trang web quản lý đơn bưu cục: `https://5sao.ghn.dev`
  - Token API: `6f584dd7-52b3-4950-a28b-0abb0ba8f3c6`
  - Shop ID: `233442`
- **Backend module:** `backend/app/ghn.py`
  - Hàm `create_ghn_shipping_order(order, shop_id, token)`: Tự động trích xuất địa chỉ người nhận, tự động map Quận/Huyện/Phường (hỗ trợ Quận 1 Bến Nghé/Tân Định, TP. Thủ Đức...), tự động cân đối trọng lượng bưu kiện, tính COD thu hộ theo số tiền đơn hàng.
  - Endpoint: `POST /api/admin/orders/{order_id}/push-ghn` trong `backend/app/main.py`.
- **Frontend UI:**
  - Nút **"Tạo vận đơn GHN"** trên danh sách đơn admin (`frontend/src/pages/Orders.jsx`).
  - Khi bấm, backend gọi thẳng sang GHN Dev Gateway, tạo đơn thành công, GHN trả về mã vận đơn chính thức (ví dụ: `LYQGW4`, `LYQGKD`...), cập nhật carrier thành `GHN` và lưu mã vận đơn vào database.
  - Đơn hàng xuất hiện ngay lập tức trên dashboard `https://5sao.ghn.dev` với trạng thái "Chờ lấy hàng" và cước phí ước tính.

### 3.2. Phiếu đóng hàng & Hóa đơn điện tử (Packing Slip & Invoice PDF)
- **Component:** `frontend/src/components/OrderInvoiceModal.jsx`
- **Tính năng:**
  - Hỗ trợ xem dạng Modal và in trực tiếp ra khổ giấy A4 hoặc nhãn A5 qua CSS `@media print`.
  - Thông tin người gửi chuẩn N&B Flagship Store, thông tin người nhận (tên, SĐT, địa chỉ chi tiết).
  - Đơn vị vận chuyển và Mã vận đơn hiển thị to rõ kèm Barcode SVG mô phỏng mã bưu gửi.
  - Bảng danh sách sản phẩm (tên, phân loại màu/size, số lượng, đơn giá, thành tiền).
  - Khung **TIỀN THU NGƯỜI NHẬN (COD)** nổi bật phục vụ bưu tá phát hàng.
  - Nút **"In phiếu / Xuất PDF"** tự động gọi `window.print()` với định dạng ẩn toàn bộ header, nút bấm thừa, chỉ in đúng phiếu hàng.

### 3.3. Quản lý Mã vận đơn & Đơn vị vận chuyển thủ công
- **Thư viện:** `frontend/src/lib/shipping.js` (hỗ trợ GHN, GHTK, Viettel Post, VNPost, Shopee Xpress, J&T).
- **Tính năng:** Tra cứu lộ trình trực tiếp (`getTrackingUrl()`) dẫn thẳng sang website theo dõi đơn của từng hãng khi khách hàng hoặc admin click vào mã vận đơn.
- **Component:** `frontend/src/components/ShippingModal.jsx` cho phép đổi đơn vị vận chuyển hoặc nhập mã vận đơn tùy biến.
- **Endpoint:** `PATCH /api/admin/orders/{order_id}/shipping`.

### 3.4. Hệ thống gợi ý kích cỡ cơ thể thông minh (Smart Size Recommendation)
- **Thuật toán:** `frontend/src/lib/sizeRecommendation.js`
  - Cho phép khách hàng nhập số đo 3 vòng (ngực, eo, mông) hoặc chỉ cần nhập Chiều cao & Cân nặng (hệ thống tự động nội suy số đo qua nhân trắc học).
  - So khớp tự động với Bảng size thực tế của từng thương hiệu (AS Colour, Bella Canvas...) hoặc số đo thực tế của shop.
  - Tự động hiển thị huy hiệu: *"Gợi ý cho bạn: Size S/M/L"* ngay trên giao diện chọn sản phẩm.

### 3.5. Mở khóa Thử đồ 3D cho Áo sơ mi & Bổ sung Dataset Quần áo (27/10/2026)
- **Mở khóa Áo sơ mi 3D:** Trong `frontend/src/tryon/links.js` và `src/components/garment-test/GarmentTestApp.tsx`, mở khóa slot `top: ['tshirt', 'shirt']` và `'m-shirts': 'top'`. Toàn bộ 5 dòng sơ mi AS Colour (9 màu) giờ đã có nút "Thử đồ 3D" và có thể thử trực tiếp trong phòng thử 3D.
- **Bổ sung Dataset trang phục mới:**
  - Dòng áo thun kinh điển **AS Colour 5001 Staple Tee** (7 màu: Navy, Charcoal, Carolina Blue, Dark Chocolate, Pistachio, Pale Blue, Copper).
  - Bổ sung 2 màu mới cho Quần dài **Relax Track Pants 5932** (Grey Marle, Butter).
  - Bổ sung 1 màu mới cho Áo thun nữ **Maple Tee 4001** (Mineral).
  - Tổng catalog tăng lên **55 styles, 118 biến thể màu** (toàn bộ đều có ảnh trước/sau và texture 3D trong `public/prints/`).

### 3.6. Slide Báo Cáo Tiến Độ Thuyết Trình (27/10/2026)
- Đã tạo sẵn file PowerPoint chuẩn tỷ lệ 16:9 cao cấp tại: `BaoCao_TienDo_DATN_N&B_Fashion.pptx` (gồm 7 slide chuẩn: Bìa đề tài, Đặt vấn đề & Định vị, Ngăn xếp công nghệ, 4 Trụ cột tính năng, Luồng vận hành logistics GHN, Kịch bản Live Demo 3 bước, và Kết luận / Kế hoạch đến tháng 12/2026).

---

## 4. BỘ TEST BẮT BUỘC TRƯỚC KHI BÁO XONG HOẶC COMMIT
Mọi thay đổi trên `DoAnTotNghiep-dev` bắt buộc phải vượt qua 4 bộ test sau (đang pass 100%):
```bash
# 1. Backend pytest (78 passed)
cd C:\thuchanh\DoAnTotNghiep-dev\backend && .venv\Scripts\python -m pytest -q

# 2. Frontend Node tests (60 passed)
cd C:\thuchanh\DoAnTotNghiep-dev\frontend && node --test --test-concurrency=1 src/lib/*.test.js supabase/*.test.mjs

# 3. Frontend Vitest UI tests (65 passed)
cd C:\thuchanh\DoAnTotNghiep-dev\frontend && npx vitest run --maxWorkers=1

# 4. Production Build
cd C:\thuchanh\DoAnTotNghiep-dev\frontend && npx vite build
```

---

## 5. DỊCH VỤ ĐANG CHẠY (LOCAL PORTS)
- **Backend:** `http://localhost:8000` (FastAPI uvicorn từ `C:\thuchanh\DoAnTotNghiep-dev\backend`)
- **Frontend:** `http://localhost:5173` (Vite từ `C:\thuchanh\DoAnTotNghiep-dev\frontend`)
- **Đường dẫn Admin đơn hàng:** `http://localhost:5173/admin/orders`
- **Đường dẫn Khách hàng xem đơn:** `http://localhost:5173/account/orders`

---

## 6. LƯU Ý KHI TIẾP QUẢN
1. Nếu sửa backend, phải restart lại uvicorn (vì không bật auto-reload để tránh xung đột file db).
2. Khi người dùng yêu cầu làm thêm tính năng gì, hãy kiểm tra danh mục TMĐT hiện có để tránh làm trùng lặp.
3. Luôn giữ tinh thần đồ án thời trang cao cấp: giao diện tinh tế, chữ nghĩa chuẩn chỉ tiếng Việt có dấu.
