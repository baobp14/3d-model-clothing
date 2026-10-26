# Backend Python — N&B

FastAPI + SQLAlchemy. Supabase tiếp tục cung cấp Auth; nghiệp vụ địa chỉ, kho/sản phẩm
và đặt đơn chạy trong Python, không gọi lại các Supabase RPC.

## Chạy local trên Windows

Từ thư mục `D:\code\tn\backend`:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
Copy-Item .env.example .env
.\.venv\Scripts\python.exe -m app.init_db
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

SQLite được tạo từ catalog frontend, mỗi sản phẩm mới có tồn kho mẫu 500. Lệnh init
chỉ thêm bản ghi chưa tồn tại, không ghi đè sản phẩm đã chỉnh sửa. Đây là database
local độc lập với Supabase. Ảnh vẫn được phục vụ từ `frontend/public/`.

Sau khi cài dependencies, có thể chạy cả Python và Vite bằng một lệnh:

```powershell
.\.venv\Scripts\python.exe run_dev.py
```

Lệnh này tự bổ sung catalog còn thiếu trên SQLite, chờ API sẵn sàng rồi chạy
frontend. Mở http://127.0.0.1:5173; Ctrl+C sẽ dừng cả hai dịch vụ. Nếu cổng
8000/5173 đã có chương trình khác, lệnh báo lỗi, không tự dừng chương trình đó.
Vite vẫn có hot reload. Khi sửa code Python, dừng rồi chạy lại lệnh chung;
backend không bật reloader trong chế độ này để tránh tín hiệu reload Windows
làm dừng cả supervisor.

Điền `SUPABASE_URL` và `SUPABASE_ANON_KEY` trong `backend/.env` bằng cùng project/key
công khai trong `frontend/.env.local`. Có thể đọc catalog/tìm kiếm khi chưa cấu hình
Auth; các API riêng tư sẽ trả 503. Không có tài khoản/token admin giả hoặc chế độ bỏ
qua đăng nhập. Vai trò admin phải nằm trong `app_metadata.role` do server quản lý.

Từ `frontend`, chạy `npm run dev`. Vite chuyển `/api` tới `127.0.0.1:8000`.
Swagger: http://127.0.0.1:8000/docs. Health: http://127.0.0.1:8000/api/health.

## PostgreSQL / Supabase thật

1. Dùng database hiện có, áp dụng SQL theo thứ tự:
   `frontend/supabase/schema.sql`, `customer-addresses.sql`, `inventory.sql`,
   `inventory-details.sql`. Nếu đã áp dụng thì không cần chạy lại `schema.sql`
   (script catalog này có upsert dữ liệu sản phẩm).
2. Lấy chuỗi kết nối PostgreSQL **direct** hoặc **session pooler** trong Supabase
   Dashboard → Connect. Đặt `DATABASE_URL=postgresql+psycopg://USER:PASSWORD@HOST:5432/postgres?sslmode=require`
   trong `backend/.env`.
   URL-encode mật khẩu có ký tự đặc biệt. Không dùng URL REST hay publishable key
   làm chuỗi kết nối database.
3. Backend cần database role tin cậy có quyền SELECT/INSERT/UPDATE các bảng này,
   USAGE/SELECT sequence sản phẩm và được phép vượt RLS cho các bảng nghiệp vụ.
   Có thể dùng tài khoản database owner để phát triển. RLS cho dữ liệu đọc của
   client Supabase được giữ nguyên. Chỉ Python được giữ credential database này.
4. Không chạy `app.init_db` với PostgreSQL: lệnh chủ động từ chối. Server cũng
   không tự tạo/sửa/seed schema khi khởi động.
5. Kiểm tra health, đăng nhập khách/admin thật, thử lưu địa chỉ, thêm/sửa sản phẩm,
   đặt COD, gửi lại cùng request ID và thử gọi API quản trị bằng token khách.

Các bảng giữ tên/cột hiện có: `products`, `categories`, `colors`,
`customer_address_books`, `shop_orders`. Python dùng ARRAY/JSONB/UUID trên
PostgreSQL, JSON/UUID tương ứng trên SQLite. PostgreSQL khóa bản ghi bằng
`FOR UPDATE`, khóa người mua bằng advisory transaction lock; SQLite dùng
`BEGIN IMMEDIATE` để tuần tự hóa thao tác local. Commit hoàn tất trước khi API
trả thành công. Lỗi sẽ rollback toàn bộ tồn kho và đơn.

## API

| Method | Path | Quyền / công dụng |
|---|---|---|
| GET | `/api/health` | Kiểm tra database và cấu hình Auth |
| GET | `/api/catalog?department=men&q=ao+thun` | Catalog và metadata, hỗ trợ tìm kiếm |
| GET | `/api/products?q=shirt&limit=24&offset=0` | Tìm kiếm/phân trang |
| GET | `/api/products/{id}` | Chi tiết sản phẩm và màu |
| GET | `/api/addresses` | Sổ địa chỉ của khách đang đăng nhập |
| POST | `/api/addresses` | Lưu/xóa/đổi mặc định, kiểm tra revision |
| POST | `/api/admin/products` | Admin thêm sản phẩm |
| PATCH | `/api/admin/products/{id}` | Admin sửa, kiểm tra dữ liệu expected |
| POST | `/api/orders` | Khách đặt đơn, tính giá từ DB, trừ kho atomically |

API riêng tư dùng `Authorization: Bearer <Supabase access_token>`. Python gọi
Supabase Auth `/auth/v1/user` mỗi yêu cầu để xác minh người dùng và quyền từ
`app_metadata`, không tin `user_metadata.role` hoặc user ID gửi từ client.

Đặt đơn cần UUID `request_id`. Gửi lại cùng ID và cùng giỏ/địa chỉ/phương thức
trả đơn cũ, không trừ kho lần nữa. Dùng lại ID với nội dung khác trả
`409 NB_ORDER_CONFLICT`. Frontend giữ ID khi retry cùng nội dung và đổi ID khi
giỏ/địa chỉ/phương thức thay đổi. Giá/total từ client bị từ chối.

Tìm kiếm hỗ trợ Việt/Anh, không phân biệt hoa thường/dấu, tên/loại/màu/mã sản phẩm
và danh mục. Tất cả từ khóa phải khớp. Hiện lọc catalog trong Python, phù hợp
dataset nhỏ; chưa có full-text index hay xếp hạng theo độ liên quan.

QR vẫn là lựa chọn demo hiện có, API chỉ tạo đơn, không xác nhận thanh toán.
Đã có lịch sử đơn của khách, hủy đơn chờ xác nhận và hoàn kho một lần; admin
xác nhận → đang giao → đã giao hoặc hủy trước khi giao. Tổng quan dùng dữ liệu
đơn thật, thống kê giá trị đơn đã giao (chưa xác nhận đã thu tiền).
Yêu thích lưu theo tài khoản. Admin thêm/sửa/tắt mã giảm 1–80%; mỗi đơn dùng một mã,
giảm trên tổng sản phẩm và giữ nguyên thông tin giảm giá trong lịch sử đơn.
Chỉnh sửa sản phẩm hỗ trợ tên/mô tả Việt–Anh, màu, kích cỡ, nhiều ảnh.
Admin có bảng kho màu–kích cỡ trong chi tiết sản phẩm. Lần thiết lập đầu phải
phân bổ đúng tổng kho hiện tại, không tự đoán số lượng từng biến thể. Sản phẩm chưa
thiết lập tiếp tục dùng kho chung. Đơn kho chung đang chờ/đã xác nhận phải được giao
hoặc hủy trước khi chuyển; đơn mới dùng kho biến thể sẽ trừ/hoàn đúng lựa chọn.
Khi đã dùng biến thể, sửa số lượng trong bảng biến thể, tổng kho tự cộng lại.
Muốn bỏ màu/size, đưa số lượng lựa chọn đó về 0 và xử lý đơn chờ/đã xác nhận liên quan.
Thanh toán QR và 3D vẫn là demo/đang phát triển.

Danh sách đơn phân trang phía database (mặc định 20, tối đa 100 đơn/trang), lọc
trạng thái, đã/chưa thu tiền, khoảng ngày đặt theo múi giờ Việt Nam; tìm mã đơn,
người nhận, điện thoại/email. Đơn mới lưu tên/màu Việt–Anh tại lúc đặt; đơn cũ thiếu
tiếng Anh dùng thông tin danh mục hiện có làm dự phòng.

Admin ghi nhận **đã thực nhận đủ tiền** riêng với trạng thái giao hàng. Thao tác
không thu tiền trực tuyến và thử lại không ghi trùng. Đơn đã ghi nhận thu tiền
không được hủy trực tiếp; hoàn tiền chưa có trong hệ thống. Biểu đồ ngày/tháng
tổng hợp bằng SQL: giá trị đơn theo ngày đặt (trừ hủy), tiền thực nhận theo ngày
ghi nhận; chọn tối đa 367 ngày. Thẻ tổng quan nối sang bộ lọc đơn tương ứng.

Frontend lưu mã yêu cầu thêm sản phẩm trước khi gửi; mất phản hồi/tải lại vẫn
kiểm tra cùng mã, chặn thêm sản phẩm khác khi chưa xác nhận yêu cầu cũ. Backend
ghi sản phẩm và mã yêu cầu trong cùng transaction; cùng mã không tạo sản phẩm
thứ hai, đổi nội dung cùng mã trả conflict. Client cũ chưa gửi request_id vẫn
được hỗ trợ, nhưng không có bảo đảm thử lại này.

Khi cập nhật backend, chạy migration bổ sung trước khi khởi động:

```powershell
.\.venv\Scripts\python.exe -m app.migrate_shop
```

Lệnh tạo bảng bổ sung (yêu thích, mã giảm giá, thông tin giảm giá của đơn,
yêu cầu thêm sản phẩm, kho biến thể, ghi nhận thu tiền) và index phân trang,
không ghi đè dữ liệu hiện có. PostgreSQL bật RLS cho các bảng này; chỉ Python API
với quyền database thích hợp truy cập, frontend không ghi trực tiếp qua Supabase.
Migration cũng thu hồi quyền client chạy các RPC ghi kho/đặt đơn cũ
(`add_inventory_product`, `update_inventory_product`, `place_shop_order`), vì
chúng không cập nhật bảng kho biến thể. Frontend hiện tại đã dùng Python API;
client cũ cần chuyển sang API trước khi dùng phiên bản này. RPC địa chỉ vẫn được giữ.
Nếu chạy lại các SQL legacy, chạy `app.migrate_shop` sau cùng để giữ giới hạn này.

## Thanh toán QR (TConnect)

QR chỉ hiện ở trang thanh toán khi đủ các biến `TCONNECT_*` trong `.env` (xem `.env.example`);
thiếu biến thì chỉ có COD và API từ chối đơn QR. Luồng:

1. Khách đặt đơn QR → đơn `pending`, tồn kho được giữ.
2. `POST /api/orders/{id}/qr` tạo QR động đúng số tiền (gọi lại trả mã cũ, không tạo mã mới).
3. Trang thanh toán gọi `POST /api/orders/{id}/payment-check` mỗi 4 giây; API hỏi TConnect
   và tự ghi nhận thanh toán khi tổng giao dịch `SUCCESS` ≥ tổng đơn.
4. Admin chỉ xác nhận/giao được đơn QR sau khi đã nhận tiền.
5. Hủy đơn QR: API hỏi TConnect trước, nếu tiền đã về thì ghi nhận thanh toán và chặn khách tự hủy.

IPN (`POST /api/payments/tconnect/ipn`) là tùy chọn: phải đăng ký URL public HTTPS với TConnect.
API không tin nội dung IPN mà dùng nó để hỏi lại trạng thái thật. Sandbox dùng bộ thông tin test
công khai trong tài liệu TConnect; production cần thông tin riêng do TConnect cấp.

Admin hủy được đơn đã thanh toán: tồn kho được hoàn, đơn hiện "Cần hoàn tiền"; sau khi chuyển trả
tiền cho khách, bấm "Xác nhận đã hoàn tiền". Mọi thay đổi trạng thái/thanh toán/hoàn tiền được ghi vào
lịch sử đơn (`GET /api/admin/orders/{id}/events`).

## Bảo vệ API

- Rate limit theo IP/tài khoản cho tra mã giảm giá, đặt đơn, QR, địa chỉ, wishlist, IPN (trả `429`).
  Bộ đếm nằm trong bộ nhớ một tiến trình; chạy nhiều instance thì đặt rate limit ở reverse proxy.
- Mỗi khách giữ tối đa `MAX_OPEN_ORDERS` đơn chờ xác nhận (mặc định 5).
- Kết quả xác thực Supabase được cache `AUTH_CACHE_SECONDS` giây (mặc định 60).
- `/docs` và `/openapi.json` chỉ bật khi `ENABLE_API_DOCS=true`. Đừng bật trên production.
- Sau khi cập nhật code, chạy `python -m app.migrate_shop` trên PostgreSQL để tạo bảng mới
  (lịch sử đơn, hoàn tiền, QR, điều kiện mã giảm giá) và thu hồi RPC địa chỉ cũ.

## Kiểm thử

```powershell
.\.venv\Scripts\python.exe -m pytest -q
```

Chạy `npm install` trong `frontend` trước để có PGlite cho test PostgreSQL.
Test backend bao gồm SQLite và PostgreSQL/WASM cùng các luồng mở rộng của cửa hàng.
Test dùng database SQLite tạm và mock **dịch vụ Auth**, nhưng chạy toàn bộ HTTP,
validation và nghiệp vụ Python thật. Bao gồm phân quyền, cách ly địa chỉ giữa
tài khoản, revision/default/giới hạn 5 địa chỉ, sửa kho bị stale, giá phía server,
rollback, hai người mua đồng thời và retry đồng thời. Không dùng dữ liệu Supabase
thật. Có thêm 3 test Python qua psycopg kết nối PostgreSQL/WASM (PGlite socket)
trên loopback, dùng nguyên các migration hiện có: kiểm tra UUID/JSONB/ARRAY,
sequence, địa chỉ/revision, giá phía server, retry, rollback và sửa kho bị stale.
PGlite dùng một connection, nên không thay thế kiểm thử concurrency trên
PostgreSQL native. Kiểm thử trên Supabase thật vẫn cần cấu hình kết nối/tài khoản.

Chỉ chạy test SQLite: `python -m pytest tests/test_api.py -q`.
Test PostgreSQL riêng: `python -m pytest tests/test_postgres.py -q`.

## Deploy

Cài dependencies rồi chạy `uvicorn app.main:app --host 0.0.0.0 --port 8000`;
dùng PostgreSQL cho môi trường thật, HTTPS phía reverse proxy, khai báo
`DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `CORS_ORIGINS` (origin frontend
chính xác, không có path). Frontend cùng origin có thể proxy `/api`; khác origin
thì đặt `VITE_API_URL=https://api.example.com/api` rồi build lại. Không đưa mật khẩu
database hay service-role key vào biến `VITE_*`.

Tham chiếu: [FastAPI security](https://fastapi.tiangolo.com/tutorial/security/),
[SQLAlchemy transactions](https://docs.sqlalchemy.org/en/20/orm/session_transaction.html),
[Supabase getUser](https://supabase.com/docs/reference/python/auth-getuser).

### Dữ liệu demo

Chạy `python -m app.seed_demo` trong môi trường backend để thêm 3 sản phẩm `[TEST]` với kho màu/size và 26 đơn mẫu thuộc tài khoản quản trị hiện có. Đơn trải trong 51 ngày, có đủ trạng thái giao hàng, 7 đơn đã ghi nhận tiền và cả biến thể hết hàng. Lọc tên khách bằng `[TEST]` để tìm đơn mẫu. Chọn khoảng 60 ngày để xem đầy đủ biểu đồ ngày/tháng. Chạy lại không tạo trùng và không đặt lại những bản ghi đã được thao tác. Script không tạo tài khoản, không sửa sản phẩm thật, không gửi thông báo hoặc giao dịch thanh toán.

### List pagination

Inventory and pricing use `/api/product-page?page=1&limit=20`; public catalog/search pages use the same endpoint with `limit=12`. Supported filters: `q`, `department`, comma-separated `categories`, `colors`, `sizes`, `stock` (`out`, `low`, `available`) and `sort` (`featured`, `new`, `priceAsc`, `priceDesc`, `id`, `stock`, `price`). Responses include `products`, `total`, `pages`, filter-wide `stock_units`, and small category/color/size metadata. SQL applies filtering and stable sorting before OFFSET/LIMIT; only products on the requested page load variant inventories.

Customer wishlist products use authenticated `/api/wishlist/products?page=1&limit=12`, scoped to the verified owner. The existing ID-only wishlist API remains for heart state. Admin promotion lists accept `page` and `limit` (default 20). Product list filters reset to page 1; an emptied final page returns to the last available page. Creation/update reloads server pagination instead of appending a row beyond the page limit. Public browsing retains a paged offline catalog when the API is unavailable; inventory, wishlist and promotions do not substitute offline business data.

### Existing flow fixes

`sort=new` orders by creation timestamp descending with ID descending as a stable tie-breaker. `stock=low_or_out` matches the overview count of products with stock at most 20, including sold-out products. List pages and filters are stored in URL parameters; product links preserve the originating list URL for the return link.

Home showcase loads 10 products with `/api/product-page`. Product detail responses include small category/color metadata. Cart refresh requests only distinct IDs through `/api/products/by-ids?ids=1,2`; each request accepts up to 100 IDs, and missing IDs remain unavailable in the cart. Empty carts send no catalog request. These changes do not alter order pricing, stock transactions, payment or refund functionality.

### Test order statistics

Run `python -m app.migrate_shop` before starting this version. `shop_demo_orders` explicitly marks demo order IDs; order names are not used to classify them. Re-run `python -m app.seed_demo` to mark existing deterministic demo orders without recreating them or changing stock. Overview/report APIs exclude marked orders by default; `include_test=true` includes them. Admin orders support `scope=all|real|test` and return `is_test`. Inventory totals continue to include every product, including demo products. Product detail and cart batch responses include current database `color_names`.

### Admin operations

Run `python -m app.migrate_shop` before this version. New tables `shop_stock_movements` and `shop_notification_reads` use RLS; only authenticated admin API routes expose history/read state. Stock history records create/allocation/adjustment/order/cancellation in the same transaction as stock. Retries or rollbacks do not create duplicate movements. Earlier changes are not reconstructed. Inventory adjustments accept a reason (up to 300 characters); the variant editor requires one. Actor IDs identify the admin/customer who performed the operation.

Admins can classify orders through `PATCH /api/admin/orders/{id}/test`; this changes statistics only and never stock/payments. `GET /api/admin/stock-alerts?page=1&limit=20` checks every configured color/size at <=20 units, or shared stock for unallocated products. Notification polling lists up to 20 real pending orders and 20 stock alerts; read state is stored per admin, and links open the matching order or product. The badge counts unread displayed items. Full lists are linked from the notification dialog.

Filtered CSV export endpoints are `/api/admin/orders/export` and `/api/admin/inventory/export`. They ignore list pagination, support up to 10,000 filtered items / 50,000 data rows, and reject larger exports without silently truncating. CSV includes UTF-8 BOM and formula-escaped text. PostgreSQL exports use a read-only repeatable-read snapshot.

Frontend `npm run test:e2e` runs isolated desktop/mobile flows in installed Microsoft Edge through Playwright. Its build/preview server uses port 5174 and dummy auth; all API/auth requests are intercepted, so tests never create real orders or use real account credentials. Screenshots are under `.qa/screenshots`. Node/UI tests: `npm test`; build: `npm run build`.

## Student clothing dataset

For a presentation using existing seeded orders, run `.\.venv\Scripts\python.exe -m app.prepare_demo`. This strips `[TEST]` from the 26 deterministic seed orders and their products and removes their test classification, making them visible in default reports. No orders are created; amounts, status, payment receipt and stock are preserved. A private snapshot of the affected seed records is stored in the ignored `.dataset-backups/presentation-*` directory. Re-running `seed_demo` preserves the existing classification.

From `backend`, run `.\.venv\Scripts\python.exe -m app.import_clothing` to inspect the plan, or add `--apply` to import `../dataset_quanao.zip`. Stop local development services before applying, then restart `run_dev.py`.

The ZIP's 90 color samples form 48 products. Only `m-tshirts`, `m-shirts`, `m-trousers` and `w-skirts` are replaced; other categories retain their current records. Old products are archived from active lists but remain readable for historical orders and cancellations. New orders cannot buy archived products; old accepted requests still retry idempotently. No orders are rewritten or deleted.

New styles reuse reference prices from existing products of the same category. Sizes are S/M/XL. Demo product stock alternates 1556/1342, allocated exactly across colors and sizes. Per-color original front/back/detail photos are served locally under `public/img/clothing`; AI images are excluded. Original source metadata stays in the ZIP. Shared style photos can depict a different color and are not mixed into selected-color galleries.

Before import, catalog/stock records and the static fallback file are backed up to ignored `backend/.dataset-backups/<timestamp>`. Orders and delivery details are not included. The import is atomic and repeatable: subsequent runs preserve sold quantities, admin edits and product IDs. The static frontend fallback is synchronized from the active database. A fresh SQLite initialization loads the same dataset quantities, variants and image mappings. Stock history uses the zero UUID to identify this initial dataset import.

### Chỉ dùng dataset_quanao.zip

Catalog hiện chỉ gồm 48 sản phẩm của `dataset_quanao.zip`; dữ liệu H&M/Myntra cũ đã bỏ (backup ở
`dataset_hm_myntra_backup.zip` tại thư mục gốc, đã được gitignore). Trên một DB còn sản phẩm cũ
(ví dụ Supabase), chạy sau `app.import_clothing --apply`:

```powershell
.\.venv\Scripts\python.exe -m app.prune_catalog          # xem kế hoạch
.\.venv\Scripts\python.exe -m app.prune_catalog --apply  # áp dụng
```

Sản phẩm ngoài dataset bị xóa nếu chưa nằm trong đơn nào; nếu đã có trong đơn thì chuyển sang ngừng bán
để lịch sử đơn vẫn đúng. Danh mục/màu không còn sản phẩm bị xóa, và `frontend/src/data/products.js`
được sinh lại. Menu Túi xách và Đồng hồ đang ẩn vì dataset không có hai loại này.

