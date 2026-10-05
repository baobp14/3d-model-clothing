# Email tài khoản thật và domain

Code đã dùng Supabase Auth thật. SMTP gửi thư ở phía Supabase, không chạy trong
frontend. Chưa có domain/SMTP nên chưa xác minh thư đến hộp thư khách hàng.

## Khi chưa có domain

1. Chạy `npm run dev`, ghi nhận đúng cổng Vite.
2. Supabase → Authentication → URL Configuration: Site URL là
   `http://localhost:5173`; Redirect URLs thêm
   `http://localhost:5173/login` và `http://localhost:5173/reset-password`.
3. Giữ Confirm email bật. Có thể thử email thuộc thành viên tổ chức Supabase
   với SMTP mặc định; nó không phục vụ gửi cho khách hàng bất kỳ.
4. Muốn thử khách hàng khác, cấu hình SMTP của nhà cung cấp cho phép địa chỉ
   gửi đã xác minh. Khả năng dùng khi chưa có domain tùy nhà cung cấp.

## Khi có domain và chuẩn bị mở cho khách hàng

1. Đăng ký dịch vụ gửi email giao dịch hỗ trợ SMTP, xác minh domain gửi thư
   bằng các bản ghi DNS nhà cung cấp yêu cầu (SPF/DKIM và cấu hình DMARC).
2. Supabase → Authentication → Email/SMTP settings: bật custom SMTP, nhập
   sender email/name, host, port, username và password theo nhà cung cấp.
   Nhập secret trực tiếp trên dashboard; không đưa vào Git hoặc `VITE_*`.
3. Supabase URL Configuration: Site URL là `https://domain-cua-ban`; thêm
   chính xác `https://domain-cua-ban/login` và
   `https://domain-cua-ban/reset-password` vào Redirect URLs.
   Frontend lấy `window.location.origin`, tự dùng domain hiện tại.
4. Giữ template Confirm signup/Reset Password dùng `{{ .ConfirmationURL }}`.
   Nếu thay template, phải giữ link xác thực có token; không dùng URL reset trần.
5. Deploy HTTPS, cấu hình hosting trả `index.html` cho đường dẫn SPA như
   `/login` và `/reset-password` khi mở trực tiếp từ email.
6. Khai báo `VITE_SUPABASE_URL` và `VITE_SUPABASE_ANON_KEY` trên hosting.
   Đây là public key; dữ liệu khách hàng cần được bảo vệ bằng RLS ở database.
7. Thiết lập hạn mức gửi email và chống bot trong Supabase trước khi mở đăng
   ký công khai; nếu bật CAPTCHA thì phải nối captchaToken trong frontend.

## Kiểm tra trước khi mở cho khách hàng

- Đăng ký email thật, nhận thư xác nhận, mở link và đăng nhập.
- Yêu cầu reset từ drawer và trang quên mật khẩu; nhận thư ở hộp thư thật.
- Mở link ở trình duyệt khác: đổi mật khẩu thành công. Có thể reload trang
  reset trong cùng tab trước khi lưu; đóng tab sẽ không giữ dấu recovery.
- Đăng xuất: mật khẩu cũ thất bại, mật khẩu mới đăng nhập được.
- Link hết hạn/đã dùng không cho tạo phiên recovery mới. Sau khi link được
  đổi thành phiên hợp lệ, phiên đó tồn tại tới khi đổi xong/đăng xuất.
- Mở `/reset-password` trực tiếp không có recovery: hiển thị yêu cầu link mới.
- Thử lỗi mạng/rate limit, gửi lặp; không báo thành công khi API báo lỗi.
- Yêu cầu đăng xuất toàn bộ phiên sau đổi mật khẩu. Access token đã phát hành
  vẫn có thể còn hiệu lực tới khi hết hạn theo cấu hình Supabase.

Admin demo đã bị bỏ. Admin thật phải được cấp `app_metadata.role = admin`
bằng công cụ server tin cậy/dashboard; role ở frontend chỉ điều khiển giao
diện. Mọi thao tác ghi dữ liệu quản trị vẫn cần RLS phía database.
Checkout hiện vẫn là mô phỏng, chưa phải hệ thống đơn hàng/thanh toán thật.

Kiểm tra code: `node --test src/lib/passwordReset.test.js` và `npm run build`.

Tài liệu: [Password auth](https://supabase.com/docs/guides/auth/passwords),
[Custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp),
[Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls).
