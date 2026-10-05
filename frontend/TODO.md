# Tiến độ — đã làm và chưa làm

Ghi lại ngày 29/09/2026. Cập nhật backend Python và tìm kiếm ngày 03/10/2026.
Cấu hình dashboard Supabase/Google và trạng thái deploy chưa được xác minh.

Trạng thái “đã làm” bên dưới xác nhận code local đã có; không đồng nghĩa đã
deploy hoặc chạy end-to-end trên dịch vụ thật.

## 0. Backend — hiện trạng và hướng triển khai

- [x] Đã tích hợp **Supabase Auth**. Client đăng nhập/đăng ký/reset mật khẩu
  qua `src/lib/supabase.js`; nghiệp vụ shop đã chuyển sang API Python.
- [x] Đã có code backend **SQL/PL/pgSQL** trong `supabase/`: schema catalog,
  quản lý địa chỉ (`manage_customer_address`), thêm/sửa sản phẩm
  (`add_inventory_product`, `update_inventory_product`), đặt đơn
  (`place_shop_order`) và RLS/quyền gọi hàm.
- [x] Có backend **Python/FastAPI + SQLAlchemy** trong `../backend/`.
  Supabase tiếp tục cung cấp Auth/PostgreSQL; có SQLite local với catalog mẫu.
  SQL hiện có vẫn dùng để định nghĩa database/migration trên Supabase.
- [x] API Python cho catalog/tìm kiếm, địa chỉ, thêm/sửa sản phẩm và đặt đơn;
  xác minh token qua Supabase Auth, kiểm tra admin ở server, kiểm tra dữ liệu,
  lấy giá từ DB, trừ kho trong transaction và chống tạo đơn/trừ kho lặp.
- [x] Frontend đã gọi Python cho toàn bộ nghiệp vụ shop, không còn gọi
  `supabase.from`/`supabase.rpc`. Supabase JS vẫn xử lý đăng nhập.
- [x] Có `.env.example`, dependencies lock, hướng dẫn chạy/deploy, lệnh chạy cả
  backend/frontend (`../backend/run_dev.py`) và 24 test API Python: SQLite tạm + mock
  Auth, thêm kiểm thử psycopg trên PostgreSQL/WASM với migration hiện có.
  Xem `../backend/README.md`. Chưa xác minh trên Supabase thật.
- [ ] Xác minh các SQL hiện có đã được áp dụng trên Supabase thật và kiểm tra
  phân quyền, địa chỉ, đặt hàng/tồn kho end-to-end.
- [x] `3d-model-clothing` hiện dùng Next.js + TypeScript cho giao diện/3D;
  có script Python tạo asset, nhưng đây chưa phải server API backend Python.

Ký hiệu mức độ: **[1]** cần cho buổi bảo vệ · **[2]** nên có · **[3]** để sau cũng được.

---

## 1. Tài khoản & đăng nhập

Giao diện đã xong hết (drawer trượt phải + 4 trang `/login`, `/register`,
`/forgot-password`, `/reset-password`), phần kiểm tra dữ liệu nhập cũng chạy.
Đăng nhập/đăng ký/quên/đặt lại mật khẩu đã nối API Supabase thật.

- ~~**[1] Nối đăng nhập / đăng ký vào Supabase Auth.**~~ ✅ Đã xong —
  `hooks/useAuth.jsx` lo phiên đăng nhập; form đăng nhập/đăng ký ở drawer và
  `pages/Auth.jsx` đều gọi chung.
- ✅ **[1] Code quên / đặt lại mật khẩu.** Hai form dùng chung
  `PasswordResetRequest`; gọi `resetPasswordForEmail`, khóa submit, chờ 60s
  trước khi gửi lại, hiển thị lỗi API. Trang reset kiểm tra phiên recovery,
  gọi `updateUser`, thông báo kết quả và yêu cầu đăng xuất toàn bộ phiên.
  Có test API với mock; chưa kiểm chứng nhận email/đổi mật khẩu end-to-end
  trên Supabase thật. Xem `AUTH_SETUP.md`.
- **[1] Cấu hình email cho khách hàng thật.** Giữ *Confirm email* bật,
  cấu hình URL và custom SMTP; người dùng chưa có domain/SMTP (03/10/2026).
  SMTP mặc định chỉ gửi đến email thành viên tổ chức Supabase; muốn gửi đến
  email người dùng khác cần custom SMTP. Chưa xác minh dashboard.
- ✅ Đã bỏ admin cố định/localStorage và không tin `user_metadata.role`.
  Hook đọc `app_metadata.role` do server quản lý; mặc định là customer.
- ✅ **[1] Code phân quyền admin cho thêm/sửa sản phẩm.** RPC trong
  `supabase/inventory.sql` và `supabase/inventory-details.sql` kiểm tra
  `app_metadata.role` phía database; route frontend cũng kiểm tra vai trò.
- **[1] Xác minh phân quyền trên Supabase thật.** Cấp admin bằng công cụ
  server tin cậy/dashboard; kiểm tra khách không gọi được RPC quản trị,
  không đọc địa chỉ/đơn của người khác. Chưa xác minh SQL đã deploy.
  Khi có API Python, API cũng phải xác minh token và quyền phía server.
- **[1] Bật Google provider.** Code đã viết xong ở
  `components/auth/GoogleButton.jsx`, hiện chỉ có nút trong drawer, chưa có
  ở trang `/login`. Cần kiểm tra cấu hình phía dashboard:
  1. Google Cloud Console → Credentials → Create OAuth client ID (Web).
  2. Authorized redirect URI: `https://mxiveirwjjneygevvosr.supabase.co/auth/v1/callback`
  3. Authorized JavaScript origins: thêm `http://localhost:5173` để test.
  4. Supabase → Authentication → Providers → Google → bật, dán Client ID + Secret.
  5. URL Configuration: cho phép URL frontend dùng trong `redirectTo`.
- ~~**[2] Trạng thái đã đăng nhập.**~~ ✅ Đã xong — đăng nhập rồi thì icon
  người có chấm màu (champagne = khách hàng, đỏ = admin), mở drawer thấy tên,
  vai trò và nút đăng xuất.
- ✅ **[2] Khung trang quản trị.** `/admin` dùng layout riêng, có sidebar và
  các trang tạm: tổng quan doanh thu, kho/sản phẩm, giá sản phẩm, khuyến mãi,
  quản lý đơn hàng. Đăng nhập admin chuyển thẳng vào dashboard.
  Trang kho đã có đọc catalog, thêm sản phẩm và sửa chi tiết qua Supabase RPC
  (`pages/Inventory.jsx`, `pages/InventoryDetail.jsx`); hiện đã chuyển sang Python API.
  Tổng quan doanh thu,
  khuyến mãi và quản lý vòng đời đơn hàng vẫn cần hoàn thiện.
- **[2] Bảng `profiles`.** Lưu tên, số đo cơ thể, gắn với `auth.users` qua
  `user_id`, bật RLS để mỗi người chỉ đọc/sửa dòng của mình.

## 2. Mua hàng

- ✅ **[1] Trang chi tiết sản phẩm (PDP).** Route `/product/:id`, chọn size,
  màu, số lượng, mô tả cơ bản. Thẻ danh sách và trang chủ dẫn đến chi tiết.
- ✅ **[1] Giỏ hàng.** Route `/cart`, thêm/xóa/sửa số lượng theo màu và size,
  lưu localStorage. Header hiển thị số lượng thật.
- **[2] Yêu thích.** Nút trái tim ở header và trên thẻ sản phẩm chưa gắn hàm
  xử lý nào.
- ✅ **[1] Sổ địa chỉ khách hàng.** Có giao diện quản lý/chọn địa chỉ; frontend
  gọi Python `/api/addresses`. SQL/RPC cũ giữ làm migration/tham chiếu:
  `manage_customer_address`, bảng `customer_address_books`, RLS; xem
  `supabase/customer-addresses.sql` và `supabase/ADDRESS_SETUP.md`.
- ✅ **[1] Code đặt hàng và trừ tồn kho.** `/checkout` gọi Python `/api/orders`;
  Python lưu `shop_orders`, lấy giá từ database, kiểm tra size/màu/tồn kho,
  khóa bản ghi và chống trừ kho lặp bằng request ID. Thành công mới xóa giỏ.
  Chưa xác minh chạy end-to-end trên Supabase thật.
- **[1] Thanh toán trực tuyến thật.** COD đã có lựa chọn; QR vẫn là demo,
  chưa tích hợp cổng thanh toán hoặc xác nhận giao dịch/webhook.
- **[2] Lịch sử mua và quản lý đơn.** Chưa có luồng hoàn chỉnh để khách xem
  đơn, admin cập nhật trạng thái/hủy đơn và xử lý hoàn tồn kho.

## 3. Tìm kiếm

- ✅ **[1] Tìm kiếm sản phẩm.** Enter, từ khóa phổ biến và lịch sử tìm kiếm
  dẫn tới `/search?q=`. Python tìm theo tên Việt/Anh, loại, màu, danh mục và mã;
  không phân biệt hoa thường/dấu. Có lọc loại/màu/size, sắp xếp và xem thêm.
  Khi API lỗi, tìm trong catalog tĩnh và hiển thị thông báo ngoại tuyến.
  Hiện dùng lọc trong Python với dataset nhỏ, chưa dùng full-text index.

## 4. Thử đồ 3D — phần lõi của đồ án

Project `3d-model-clothing` chạy độc lập ở cổng 3000, **chưa nối với web bán
hàng**. Người dùng yêu cầu tạm hoãn phần nối 3D và các hạng mục ngoài backend/
tìm kiếm trong đợt 03/10/2026.

- **[1] Nối catalog vào try-on.** Nút "Thử 3D" trên thẻ sản phẩm hiện chỉ
  nhảy về `/#studio` (mục giới thiệu ở trang chủ), chưa mang ảnh sản phẩm
  sang để chiếu lên avatar.
- **[1] Thiếu ảnh mặt sau.** Cả hai dataset chỉ có ảnh chụp mặt trước, trong
  khi `GarmentUploadPanel.tsx` có 2 ô trước/sau. Hai hướng: chỉ chiếu mặt
  trước, hoặc lật gương ảnh trước làm mặt sau tạm.
- **[2] Gộp hai project.** Hiện là hai app riêng (Vite 5173 + Next 3000).
  Lúc demo phải mở hai cửa sổ.
- **[2] Lưu số đo người dùng.** Nút "Cập nhật số đo" ở trang chủ chưa chạy.

## 5. Dữ liệu

- **[2] `w-trousers` (quần nữ) chỉ có 4/10 sản phẩm nhiều màu.** 6 sản phẩm
  còn lại lấy từ Myntra nên chỉ có 1 màu, do lúc nhập bị Kaggle chặn
  (HTTP 429). Chạy lại `node tools/import-hm.mjs 10` khi hạn mức mở là tự bù.
- **[2] Ảnh trang chủ phụ thuộc link ngoài.** Phần Editorial, banner cuối
  trang và ảnh avatar ở mục thử đồ đang lấy từ
  `storage.googleapis.com/banani-generated-images/...`. Link hỏng là mất ảnh,
  nên tải về `public/img/` như đã làm với ảnh sản phẩm.
- ✅ Khối tuyển chọn trang chủ đọc 4 sản phẩm từ catalog nữ (Supabase hoặc
  dữ liệu dự phòng). Chưa cá nhân hóa theo số đo.
- **[3] 16 link `href="#"` được render trong footer** (12 ở ba cột,
  Instagram và 3 link pháp lý) chưa trỏ tới đâu.
- **[3] Form đăng ký nhận tin** ở footer chỉ hiện lời cảm ơn, chưa lưu email.

## 6. Kỹ thuật

- **[2] Supabase bản free tự ngủ sau 7 ngày không dùng.** Đã bị một lần.
  Vào dashboard một lần trong tuần trước khi bảo vệ. App có sẵn cơ chế lùi về
  dữ liệu tĩnh nên không trắng trang, nhưng dữ liệu sẽ là bản cũ.
- **[2] Tối ưu bundle.** Build ngày 03/10/2026 sau thêm API/tìm kiếm: JS khoảng 770KB/190KB gzip;
  Vite cảnh báo chunk lớn hơn 500KB. Phân tích trước khi tách module.
- ✅ Có 7 test luồng API reset: `node --test src/lib/passwordReset.test.js`.
- ✅ Có test địa chỉ và kho/đơn hàng trong
  `supabase/customer-addresses.test.mjs`, `supabase/inventory.test.mjs`;
  `npm test` chạy test thư viện/Supabase và test giao diện tìm kiếm bằng Vitest.
  Backend có test riêng `python -m pytest -q`.
- ✅ Có test tìm kiếm local/API và test giao diện điều hướng, lọc/sắp xếp,
  trạng thái rỗng/ngoại tuyến. Chưa kiểm tra hình ảnh thực tế trên trình duyệt
  trong đợt này do không có trình duyệt được kết nối với công cụ UI.
- **[3] Kiểm tra/hoàn thiện deploy.** Chưa xác minh trạng thái hosting.
  Vercel hoặc Netlify đều nhận Vite sẵn; nhớ khai báo 2
  biến `VITE_SUPABASE_*` trong phần Environment Variables của nhà cung cấp.

## 7. Giấy phép — nhớ ghi trong báo cáo

- Ảnh quần áo và túi: **H&M Group** qua cuộc thi Kaggle *H&M Personalized
  Fashion Recommendations* — chỉ dùng cho **nghiên cứu, phi thương mại**.
- Ảnh đồng hồ và phụ kiện: **Myntra** qua *Fashion Product Images Dataset*
  (paramaggarwal), license **MIT** — tự do dùng.
- Nếu sau này mở bán thật thì phải thay toàn bộ ảnh H&M bằng ảnh tự chụp.

---

## Chạy lại các script dữ liệu

```sh
node tools/import-hm.mjs 10    # quần áo nam/nữ từ H&M, tối đa 3 màu mỗi mẫu
node tools/fill-myntra.mjs     # lấp phụ kiện + đồng hồ từ Myntra
node tools/emit-catalog.mjs    # sinh src/data/products.js + supabase/schema.sql
node tools/audit.mjs           # soát code thừa, import thừa, lệch khoá i18n
```

Sau `emit-catalog` nhớ dán `supabase/schema.sql` vào Supabase SQL Editor.

