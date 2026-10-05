# Cài đặt kho và đơn hàng

Trong Supabase SQL Editor của project hiện tại, chạy `inventory.sql` sau khi đã có catalog (`schema.sql`) và địa chỉ (`customer-addresses.sql`). Migration thêm tồn kho 500 cho mỗi sản phẩm hiện có. Chạy lại migration không đặt lại tồn kho đã bán.

Không chạy lại `schema.sql` để cập nhật kho: file seed đó xóa và nạp lại catalog.

Admin dùng `app_metadata.role = admin` như cấu hình đăng nhập hiện tại. Database kiểm tra quyền này khi thêm sản phẩm; khách không được sửa trực tiếp tồn kho.

Trang `/admin/inventory/products` liệt kê toàn bộ sản phẩm, có tìm kiếm, lọc loại/tồn kho và popup thêm sản phẩm. Ảnh JPG/PNG/WebP tối đa 2 MB được lưu cùng bản ghi sản phẩm. Sản phẩm thêm mới xuất hiện trong danh mục tương ứng và trang chi tiết.

Đặt hàng gọi `place_shop_order`: lưu đơn vào `shop_orders`, lấy giá và địa chỉ từ database, gộp số lượng của cùng sản phẩm, khóa hàng rồi trừ kho trong cùng transaction. Lỗi bất kỳ sẽ hủy toàn bộ; mã yêu cầu giúp retry không trừ hai lần. Tồn kho tính chung cho sản phẩm, không tách theo màu/kích cỡ. Chỉ đặt đơn thành công mới trừ kho, thêm vào giỏ chưa trừ.

COD và QR lưu phương thức lựa chọn; QR chưa tích hợp thu tiền trực tuyến. Trang quản lý đơn hàng vẫn chưa triển khai.

Kiểm tra: `npm test`, `npm run build`.

Để bật chi tiết và chỉnh sửa sản phẩm, chạy thêm `inventory-details.sql` sau `inventory.sql`. Trang `/admin/inventory/products/:id` hiển thị thông tin đầy đủ và popup sửa tên tiếng Việt, giá, tồn kho, mô tả. Tên tiếng Anh giữ nguyên. Database chặn lưu nếu dữ liệu đã thay đổi từ lúc mở trang, bao gồm tồn kho giảm do đặt hàng; tải lại trang trước khi sửa tiếp.
