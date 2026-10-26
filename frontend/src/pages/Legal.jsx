import { Link } from 'react-router-dom'
import { useLang } from '../i18n'

// TODO(owner): replace the bracketed placeholders with the business's registered details before launch.
const BUSINESS = {
  name: '[Tên hộ kinh doanh / công ty]',
  taxCode: '[Mã số thuế]',
  address: '[Địa chỉ đăng ký kinh doanh]',
  email: '[Email liên hệ]',
  phone: '[Số điện thoại]',
}
const UPDATED = '25/10/2026'

function Page({ title, children }) {
  const { lang } = useLang()
  const vi = lang === 'vi'
  return <main className="shop-shell max-w-3xl">
    <title>{title + ' – N&B'}</title>
    <nav className="mb-6 text-caption text-ink-muted" aria-label="Breadcrumb"><Link to="/" className="inline-flex min-h-6 items-center hover:text-ink">{vi ? 'Trang chủ' : 'Home'}</Link> / <span aria-current="page" className="text-ink">{title}</span></nav>
    <h1 className="font-display text-title">{title}</h1>
    <p className="mt-3 text-caption text-ink-muted">{vi ? 'Cập nhật' : 'Updated'}: {UPDATED}</p>
    <div className="legal-copy mt-10 max-w-reading space-y-5 text-body leading-relaxed [&_h2]:mt-10 [&_h2]:font-display [&_h2]:text-title-sm [&_li]:ml-5 [&_li]:list-disc">{children}</div>
  </main>
}

function Contact() {
  const { lang } = useLang()
  const vi = lang === 'vi'
  return <ul>
    <li>{vi ? 'Đơn vị bán hàng' : 'Seller'}: {BUSINESS.name} — {vi ? 'MST' : 'Tax code'} {BUSINESS.taxCode}</li>
    <li>{vi ? 'Địa chỉ' : 'Address'}: {BUSINESS.address}</li>
    <li>Email: {BUSINESS.email} · {vi ? 'Điện thoại' : 'Phone'}: {BUSINESS.phone}</li>
  </ul>
}

export function Terms() {
  const { lang } = useLang()
  if (lang !== 'vi') return <Page title="Terms of use">
    <p>These terms apply when you use the N&B website to browse and buy products.</p>
    <h2>Account</h2><p>You need a verified email account to place orders. Keep your password private; you are responsible for orders placed from your account.</p>
    <h2>Orders and prices</h2><p>Prices are in VND and include applicable taxes. Delivery is currently free. The price and discount are fixed when the order is placed; if a price changes before you confirm, we ask you to review the new total. An order is a request to buy: we may cancel it if items are out of stock or details are invalid, and we tell you if that happens.</p>
    <h2>Payment</h2><ul><li>Cash on delivery (COD): pay the courier when you receive the parcel.</li><li>QR bank transfer: the order is reserved and confirmed only once the full amount arrives. Keep the amount unchanged when transferring.</li></ul>
    <h2>Cancellation and refunds</h2><p>You can cancel an order yourself while it is awaiting confirmation and unpaid. For paid orders, contact us: if we cancel a paid order, we refund the full amount to your original account.</p>
    <h2>Promotion codes</h2><p>One code per order. A code may have an expiry date, a minimum order value and a limited number of uses.</p>
    <h2>Contact</h2><Contact />
    <p>See also our <Link className="underline" to="/privacy">Privacy policy</Link>.</p>
  </Page>
  return <Page title="Điều khoản sử dụng">
    <p>Điều khoản này áp dụng khi bạn sử dụng website N&B để xem và mua sản phẩm.</p>
    <h2>Tài khoản</h2><p>Bạn cần tài khoản đã xác nhận email để đặt hàng. Hãy giữ bí mật mật khẩu; bạn chịu trách nhiệm với các đơn đặt từ tài khoản của mình.</p>
    <h2>Đơn hàng và giá</h2><p>Giá niêm yết bằng VND, đã gồm thuế theo quy định. Hiện miễn phí giao hàng. Giá và giảm giá được chốt tại thời điểm đặt; nếu giá thay đổi trước khi bạn xác nhận, hệ thống sẽ yêu cầu bạn kiểm tra lại tổng tiền. Đơn hàng là đề nghị mua: chúng tôi có thể hủy nếu hết hàng hoặc thông tin không hợp lệ và sẽ thông báo cho bạn.</p>
    <h2>Thanh toán</h2><ul><li>Thanh toán khi nhận hàng (COD): trả tiền cho người giao hàng khi nhận.</li><li>Chuyển khoản bằng mã QR: đơn được giữ hàng và chỉ xác nhận khi nhận đủ tiền. Vui lòng giữ nguyên số tiền khi chuyển khoản.</li></ul>
    <h2>Hủy đơn và hoàn tiền</h2><p>Bạn tự hủy được đơn khi đơn còn chờ xác nhận và chưa thanh toán. Với đơn đã thanh toán, vui lòng liên hệ cửa hàng; nếu cửa hàng hủy đơn đã thanh toán, chúng tôi hoàn lại toàn bộ số tiền vào tài khoản bạn đã dùng để chuyển.</p>
    <h2>Mã giảm giá</h2><p>Mỗi đơn dùng một mã. Mã có thể có hạn dùng, giá trị đơn tối thiểu và giới hạn số lượt.</p>
    <h2>Liên hệ</h2><Contact />
    <p>Xem thêm <Link className="underline" to="/privacy">Chính sách bảo mật</Link>.</p>
  </Page>
}

export function Privacy() {
  const { lang } = useLang()
  if (lang !== 'vi') return <Page title="Privacy policy">
    <p>This policy explains how {BUSINESS.name} ("we") processes your personal data, in line with Vietnam's Decree 13/2023/ND-CP on personal data protection.</p>
    <h2>Data we collect</h2><ul><li>Account: name, title, email, phone number, password (stored by our authentication provider, never readable by us).</li><li>Delivery: recipient name, phone, email, address and notes (up to 5 saved addresses).</li><li>Orders: products, amounts, payment method, payment status and bank transaction reference for QR payments.</li><li>Wishlist and bag contents. Your bag is stored in your own browser.</li></ul>
    <h2>Why we use it</h2><ul><li>To create your account and keep it secure.</li><li>To process, deliver and support your orders, including payment confirmation and refunds.</li><li>To meet accounting and tax obligations.</li></ul><p>We do not sell your data or use it for advertising.</p>
    <h2>Who receives it</h2><ul><li>Supabase (account sign-in and authentication).</li><li>TConnect and its partner bank (only the order reference and amount, for QR payments).</li><li>Delivery partners (recipient name, phone and address, only to deliver).</li></ul>
    <h2>How long we keep it</h2><p>Account and address data are kept while your account exists. Order records are kept for the period required by accounting law, then deleted or anonymized.</p>
    <h2>Your rights</h2><p>You may access, correct or delete your data, withdraw consent, or object to processing. Manage addresses in your account; for other requests contact us below. We reply within 72 hours.</p>
    <h2>Security</h2><p>Data travels over HTTPS; access is limited to your account and to authorized staff, and administrative actions are logged.</p>
    <h2>Contact</h2><Contact />
  </Page>
  return <Page title="Chính sách bảo mật">
    <p>Chính sách này giải thích cách {BUSINESS.name} ("chúng tôi") xử lý dữ liệu cá nhân của bạn, theo Nghị định 13/2023/NĐ-CP về bảo vệ dữ liệu cá nhân.</p>
    <h2>Dữ liệu thu thập</h2><ul><li>Tài khoản: họ tên, danh xưng, email, số điện thoại, mật khẩu (do nhà cung cấp xác thực lưu, chúng tôi không đọc được).</li><li>Giao hàng: tên người nhận, số điện thoại, email, địa chỉ và ghi chú (tối đa 5 địa chỉ).</li><li>Đơn hàng: sản phẩm, số tiền, phương thức và trạng thái thanh toán, mã giao dịch ngân hàng với thanh toán QR.</li><li>Danh sách yêu thích và giỏ hàng. Giỏ hàng được lưu ngay trên trình duyệt của bạn.</li></ul>
    <h2>Mục đích sử dụng</h2><ul><li>Tạo và bảo vệ tài khoản của bạn.</li><li>Xử lý, giao và hỗ trợ đơn hàng, gồm xác nhận thanh toán và hoàn tiền.</li><li>Thực hiện nghĩa vụ kế toán, thuế.</li></ul><p>Chúng tôi không bán dữ liệu và không dùng dữ liệu của bạn cho quảng cáo.</p>
    <h2>Bên nhận dữ liệu</h2><ul><li>Supabase (đăng nhập, xác thực tài khoản).</li><li>TConnect và ngân hàng đối tác (chỉ mã tham chiếu đơn và số tiền, với thanh toán QR).</li><li>Đơn vị giao hàng (tên, số điện thoại, địa chỉ người nhận, chỉ để giao hàng).</li></ul>
    <h2>Thời gian lưu trữ</h2><p>Dữ liệu tài khoản và địa chỉ được lưu khi tài khoản còn tồn tại. Hồ sơ đơn hàng được lưu theo thời hạn pháp luật kế toán yêu cầu, sau đó xóa hoặc ẩn danh.</p>
    <h2>Quyền của bạn</h2><p>Bạn có quyền xem, sửa, xóa dữ liệu, rút lại đồng ý hoặc phản đối việc xử lý. Địa chỉ có thể quản lý trong tài khoản; các yêu cầu khác vui lòng liên hệ theo thông tin bên dưới. Chúng tôi phản hồi trong 72 giờ.</p>
    <h2>Bảo mật</h2><p>Dữ liệu được truyền qua HTTPS; chỉ chủ tài khoản và nhân viên được phân quyền truy cập, các thao tác quản trị đều được ghi lại.</p>
    <h2>Liên hệ</h2><Contact />
  </Page>
}
