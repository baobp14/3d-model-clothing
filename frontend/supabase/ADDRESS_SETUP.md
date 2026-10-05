# Địa chỉ khách hàng

## Kích hoạt trên Supabase

1. Mở project Supabase đang dùng trong `frontend/.env.local`.
2. Vào **SQL Editor**, tạo một query mới.
3. Dán toàn bộ nội dung `customer-addresses.sql` và chạy **Run**.
4. Mở lại ứng dụng, đăng nhập và vào `/account/addresses` hoặc `/checkout`.

Migration này chỉ bổ sung bảng địa chỉ, RLS và RPC quản lý địa chỉ. Có thể chạy lại
an toàn. **Không chạy lại `schema.sql` để kích hoạt địa chỉ**: file catalog đó có lệnh
xóa và nạp lại dữ liệu sản phẩm.

Nếu chưa chạy migration, giao diện báo chức năng địa chỉ chưa khả dụng, không báo
lưu thành công và không cho hoàn tất đơn khi chưa có địa chỉ đã lưu.

## Hành vi

- Khách phải đăng nhập tài khoản đã đăng ký để thêm sản phẩm vào giỏ, xem giỏ và
  checkout. Đăng nhập xong trở lại trang vừa mở; lựa chọn màu, cỡ, số lượng từ trang
  sản phẩm được giữ lại khi chuyển sang trang login.
- Giỏ hàng được lưu riêng theo tài khoản trong trình duyệt. Giỏ cũ của khách chưa
  đăng nhập không tự chuyển vào tài khoản. Giỏ hàng chưa đồng bộ giữa thiết bị.
- Địa chỉ được lưu trên Supabase, theo ID tài khoản, tối đa **5 địa chỉ tổng cộng**.
- Khi có địa chỉ, luôn có đúng một địa chỉ mặc định. Địa chỉ đầu tiên tự làm mặc định.
- Chọn địa chỉ nhận hàng cho một đơn không tự đổi địa chỉ mặc định.
- Tích checkbox trên một địa chỉ khác hoặc lưu địa chỉ mới với lựa chọn làm mặc định
  mở popup xác nhận. Hủy popup không thay đổi mặc định trong database.
- Sửa địa chỉ mặc định giữ nguyên vai trò mặc định. Không thể bỏ tích làm tài khoản
  có địa chỉ nhưng không có mặc định.
- Xóa địa chỉ mặc định có popup nêu địa chỉ sẽ thay thế; xóa địa chỉ cuối cùng để sổ
  địa chỉ trống và yêu cầu thêm địa chỉ trước khi đặt hàng.
- Một dòng khóa theo tài khoản và số `revision` bảo vệ giới hạn, mặc định và tránh
  ghi đè khi hai phiên cùng sửa. Dữ liệu bị thay đổi ở phiên khác phải tải lại và
  được khách kiểm tra, xác nhận lại.
- RLS chỉ cho đọc địa chỉ của chính mình; ghi qua RPC kiểm tra `auth.uid()` và giới
  hạn, không nhận ID chủ tài khoản từ frontend.

Tham khảo cơ chế [RLS của Supabase](https://supabase.com/docs/guides/database/postgres/row-level-security).

## Kiểm tra

```sh
npm test
npm run build
```

SQL được kiểm tra bằng PostgreSQL chạy trong PGlite, gồm quyền truy cập, rollback,
giới hạn 5 địa chỉ, chuyển/xóa mặc định, và hai yêu cầu dùng cùng một revision.
Sau khi chạy migration trên project thật, kiểm tra thêm với hai tài khoản thật:

1. Chưa đăng nhập: bấm thêm vào giỏ và mở trực tiếp `/checkout`; phải chuyển sang login.
2. Đăng nhập A: thêm địa chỉ đầu tiên, xác nhận nó tự làm mặc định.
3. Thêm đủ 5 địa chỉ; không thể thêm địa chỉ thứ 6 nhưng vẫn sửa được địa chỉ cũ.
4. Tích địa chỉ khác làm mặc định: hủy giữ mặc định cũ, xác nhận chuyển sang địa chỉ mới.
5. Tải lại trang hoặc mở thiết bị khác: địa chỉ vẫn còn và mặc định được chọn lúc vào checkout.
6. Đăng xuất A, đăng nhập B: không thấy giỏ hoặc địa chỉ của A.
7. Hai tab cùng sửa: thao tác dùng dữ liệu cũ bị từ chối, danh sách được tải lại.

Luồng tạo đơn/COD/QR hiện vẫn là demo như trước; phần này chưa lưu đơn thật hoặc
tích hợp cổng thanh toán. Việc lưu địa chỉ tài khoản là thao tác thật trên Supabase.
