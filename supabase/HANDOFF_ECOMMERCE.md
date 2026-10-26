# N&B — Database & bàn giao phần E-commerce

Tài liệu này dành cho người làm phần TMĐT của N&B, và cho Claude Code của người đó đọc để làm tiếp. Đi kèm file [`nb_full_schema.sql`](nb_full_schema.sql).

## 1. Bối cảnh

- **Project Supabase:** `N&B` (tổ chức davidmnhat), region ap-southeast-1.
- **Đang có sẵn 3 bảng:** `categories`, `colors`, `products`, với 170 sản phẩm. Web hiện tại đang đọc 3 bảng này.
- **`nb_full_schema.sql`:** thêm 19 bảng cho người dùng, biến thể và tồn kho, giỏ hàng, khuyến mãi, đơn hàng, thanh toán, hậu mãi, AI và mặc thử 3D. File **không xoá và không đổi tên cột cũ nào**, nên web hiện tại vẫn chạy bình thường.
- **Phần mặc thử 3D:** một người khác làm, ở repo khác. Phần này chỉ đọc các bảng `product_size_charts`, `product_prints`, `body_profiles` và cột `products.tryon_kind`.

## 2. Cách áp dụng

1. Vào Supabase → **SQL Editor** → **New query**.
2. Dán toàn bộ `nb_full_schema.sql` → **Run**.
3. Chạy lại lần nữa cũng không sao: file chạy trong 1 transaction và dùng `if not exists`. Nếu lỗi giữa chừng thì không có gì bị ghi.
4. Tạo tài khoản admin: đăng ký một tài khoản trên web, rồi chạy lệnh sau trong SQL Editor:
   ```sql
   update profiles set role = 'admin' where email = 'email-cua-ban@gmail.com';
   ```

Đã chạy thử trên PostgreSQL 18 với dữ liệu giả lập đúng cấu trúc 3 bảng cũ. Kết quả:
- Chạy 2 lần không lỗi.
- Biến thể được sinh đúng từ `colors × sizes`.
- Khách không đọc được đơn của người khác và không tự nâng mình lên admin được.
- Client không tự tạo đơn được.

## 3. Sơ đồ bảng

```
auth.users (Supabase Auth)
 ├─ profiles            1-1  hồ sơ + role (customer/admin), tự tạo khi đăng ký
 ├─ addresses           1-n  sổ địa chỉ
 ├─ body_profiles       1-1  số đo cơ thể (avatar 3D)
 ├─ carts ── cart_items ──► product_variants
 ├─ wishlists ──► products
 ├─ orders
 │   ├─ order_items ──► product_variants, products   (chốt tên/size/màu/giá)
 │   ├─ order_status_history                          (trigger tự ghi)
 │   ├─ payments                                      (COD / VNPay)
 │   └─ return_requests
 ├─ reviews ──► order_items (unique), products
 ├─ product_views                                     (log cho gợi ý AI)
 └─ chat_messages                                     (lịch sử chatbot)

categories ◄── products (CŨ, thêm cột slug/description/status/tryon_kind)
colors     ◄── product_variants.color, product_images.color, product_prints.color
products
 ├─ product_variants      1 SKU = sản phẩm × size × màu, có stock/reserved
 ├─ product_images        ảnh, có thể gắn theo màu
 ├─ product_size_charts   số đo từng size (chấm độ vừa khi mặc thử)
 └─ product_prints        ảnh in theo màu (dán lên mesh 3D)
promotions ◄── orders.promotion_id
```

## 4. Quy ước quan trọng

| Điều | Quy ước |
|---|---|
| Kiểu id | `categories.id`, `colors.id` là `text`. `products.id` là `bigint` và **không tự tăng**, nên khi insert phải tự đặt id. `product_variants.id` là `bigint` tự tăng. Bảng còn lại dùng `uuid`. |
| Người dùng | Mọi cột `user_id` trỏ vào `auth.users(id)`. Thông tin hiển thị lấy từ `profiles`. |
| Tiền | `bigint`, đơn vị **VND**, không có số lẻ. |
| Trạng thái | Dùng `text` + `check`, không dùng enum, để sửa trên Supabase web cho dễ. |
| Mảng cũ trong `products` | `colors[]`, `sizes[]`, `images[]` vẫn giữ để web cũ không lỗi. **Code mới nên đọc `product_variants` và `product_images`.** Khi web đã chuyển hết thì có thể bỏ các mảng này. |
| Tồn kho | Nằm ở `product_variants.stock` và `reserved`. Khi chạy SQL, mỗi biến thể được tạo sẵn `stock = 20` để demo. |
| Sản phẩm không size | Ví dụ đồng hồ: có biến thể size `'F'` (free size). |
| Màu lạ | Nếu `products.colors` có màu không nằm trong bảng `colors` thì màu đó bị bỏ qua, không tạo biến thể. |

### Máy trạng thái đơn hàng (`orders.status`)

```
pending ──► paid ──► shipping ──► completed
   │          │          │            │
   └──► cancelled ◄──────┘            │
          paid / shipping / completed ──► refunding ──► refunded
COD:  pending ──► shipping ──► completed   (thu tiền khi giao)
```

Mỗi lần đổi `status`, trigger tự ghi một dòng vào `order_status_history`, kèm người đổi (`auth.uid()`).

## 5. Phân quyền (RLS)

| Nhóm bảng | Khách | Admin |
|---|---|---|
| `product_variants`, `product_images`, `product_size_charts`, `product_prints`, `promotions` | Đọc | Toàn quyền |
| `addresses`, `body_profiles`, `carts`, `cart_items`, `wishlists` | Toàn quyền **trên dòng của mình** | Toàn quyền |
| `profiles` | Đọc/sửa của mình, **không được đổi `role`** | Toàn quyền |
| `orders`, `order_items`, `order_status_history`, `payments` | **Chỉ đọc** đơn của mình | Đọc, sửa đơn |
| `reviews` | Ai cũng đọc. Chỉ viết được cho món **đã mua trong đơn `completed`** | Xoá |
| `return_requests` | Tạo và đọc yêu cầu cho đơn của mình | Duyệt |
| `product_views`, `chat_messages` | Ghi của mình | Đọc |
| `categories`, `colors`, `products` (cũ) | **Không đổi**, giữ như hiện tại | |

**Tạo đơn, trừ kho, xác nhận thanh toán phải làm ở server** (API route hoặc Server Action dùng `SUPABASE_SERVICE_ROLE_KEY`, key này bỏ qua RLS). Client không có quyền insert vào `orders`. Làm vậy để khách không tự sửa giá hoặc tự đánh dấu đơn đã thanh toán. **Không bao giờ để service_role key lộ ra phía client.**

## 6. Việc cần làm (phần E-commerce)

Làm theo thứ tự. Mỗi mục là một phần có thể demo được.

1. **Catalog đọc từ bảng mới**
   - Trang sản phẩm lấy size/màu từ `product_variants` và hiện số còn hàng.
   - Ảnh lấy từ `product_images`. Chọn màu thì lọc ảnh theo `color`.
   - URL dùng `products.slug`.
2. **Auth và hồ sơ**
   - Đăng ký/đăng nhập bằng Supabase Auth, truyền `full_name` vào `options.data` để trigger tự tạo profile.
   - Trang hồ sơ và sổ địa chỉ (`addresses`, chỉ một địa chỉ `is_default`).
3. **Giỏ hàng**
   - Mỗi user có một `carts`, tạo khi thêm món đầu tiên. `cart_items` trỏ vào `variant_id`.
   - Không cho số lượng vượt `stock - reserved`.
4. **Đặt hàng** (server)
   - Trong một transaction: kiểm tồn kho và khoá dòng biến thể (`select ... for update`), tính giá từ DB (không tin giá client gửi), áp mã giảm giá, tạo `orders` + `order_items`, trừ `stock`, tăng `promotions.used_count`, rồi xoá giỏ.
   - Nên viết thành một hàm Postgres `place_order(...)` và gọi qua `supabase.rpc()`.
5. **Thanh toán VNPay** (sandbox)
   - Tạo URL thanh toán ở server. Callback IPN phải **kiểm chữ ký** rồi mới ghi `payments` (`signature_verified = true`, `raw_response`) và đổi đơn sang `paid`.
   - Đơn VNPay quá 15 phút chưa thanh toán thì chuyển `cancelled` và cộng lại kho.
6. **Lịch sử đơn**: danh sách và chi tiết đơn, timeline trạng thái lấy từ `order_status_history`.
7. **Admin**
   - CRUD sản phẩm, biến thể, tồn kho, mã giảm giá.
   - Đổi trạng thái đơn theo máy trạng thái ở mục 4, không cho nhảy trạng thái sai.
   - Duyệt `return_requests`.
8. **Hậu mãi**
   - Viết đánh giá sau khi đơn `completed`, hiện điểm trung bình trên trang sản phẩm.
   - Wishlist.
   - Gửi yêu cầu hủy/đổi trả.
9. **Dữ liệu cho AI**
   - Ghi `product_views` khi xem sản phẩm, thêm giỏ, mua và mặc thử (`event_type = 'tryon'`).
   - Lưu `chat_messages` cho chatbot.

## 7. Chỗ nối với phần mặc thử 3D

Phần 3D đọc dữ liệu, không ghi vào bảng nào của phần E-commerce, ngoại trừ `body_profiles`.

| Dữ liệu | Ai nhập | Dùng để |
|---|---|---|
| `products.tryon_kind` | Admin; SQL đã gán sẵn theo danh mục | Chọn mesh 3D: `tshirt`, `tank`, `croptop`, `shirt` (tay ngắn/polo), `longshirt` (sơ mi dài tay), `dress` (đầm), `pants`, `shorts`, `capri`, `skirt`. `null` = ẩn nút "Mặc thử" (đồng hồ, áo len, áo khoác). `sweater`/`jacket` vẫn hợp lệ trong ràng buộc nhưng phần 3D tạm ẩn, đừng gán. |
| `product_size_charts` | Admin nhập theo bảng size của hãng | Chấm Chật/Vừa/Rộng. Áo so `chest_cm`, quần/váy so `waist_cm`. |
| `product_prints` | Người làm 3D tạo ảnh .webp đã xoá nền | Dán hoa văn lên mesh theo màu đang chọn. |
| `body_profiles` | Khách nhập ở trang "Số đo của tôi" | Dựng avatar đúng dáng người. |

Trang chi tiết sản phẩm chỉ cần hiện nút **"Mặc thử 3D"** khi `tryon_kind` khác null, rồi chuyển sang trang mặc thử kèm `productId`, màu và size đang chọn.

## 8. Gợi ý prompt cho Claude Code

Dán đoạn sau vào Claude Code ở repo web N&B, sau khi đã chép `nb_full_schema.sql` và file này vào thư mục `supabase/` của repo:

> Đọc `supabase/HANDOFF_ECOMMERCE.md` và `supabase/nb_full_schema.sql`. Đây là schema Supabase của dự án, đã chạy trên database thật. Đừng đổi tên hay xoá bảng/cột. Nếu cần thêm thì viết file SQL mới trong `supabase/`, có `if not exists`, chạy lại được. Làm lần lượt các mục ở phần 6. Trước mỗi mục, đọc code hiện tại xem web đang gọi Supabase thế nào rồi làm theo đúng kiểu đó. Tạo đơn, trừ kho và thanh toán phải chạy ở server với service_role key. Bắt đầu từ mục 1.
