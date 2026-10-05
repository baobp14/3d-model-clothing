import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useCart } from '../hooks/useCart'
import { useAuth } from '../hooks/useAuth'
import { useLang } from '../i18n'
import { formatPrice } from '../data/products'
import { supabase } from '../lib/supabase'
import { shopApi } from '../lib/api'
import { loadAddressBook } from '../lib/addressBook'
import { EmptyCart, OrderSummary } from './Cart'
import AddressBook from '../components/AddressBook'
import Popup from '../components/Popup'
import { withCheckoutLock } from '../lib/checkoutLock'
import { readCart } from '../lib/cartStorage'
import { readOrderRequest } from '../lib/checkoutRequest'
import { cartHasUnavailableItems } from '../lib/cartInventory'
import { colorName } from '../lib/colorName'

export default function Checkout() {
  const { items, clear, ready, refresh, pending, beginOrder, releaseOrder } = useCart()
  const { user } = useAuth()
  const { lang } = useLang()
  const vi = lang === 'vi'
  const [order, setOrder] = useState(null)
  const [error, setError] = useState('')
  const [delivery, setDelivery] = useState(null)
  const [addressReady, setAddressReady] = useState(false)
  const [addressVersion, setAddressVersion] = useState(0)
  const [payment, setPayment] = useState('')
  const [popup, setPopup] = useState(false)
  const [busy, setBusy] = useState(false)
  const [promotionCode, setPromotionCode] = useState('')
  const [promotion, setPromotion] = useState(null)
  const [promotionBusy, setPromotionBusy] = useState(false)
  const subtotal = items.reduce((sum, item) => sum + item.product.price * item.quantity, 0)
  const discount = pending?.payload.expected_discount ?? (promotion ? Math.floor(subtotal * promotion.percent / 100) : 0)
  async function applyPromotion() {
    const code = promotionCode.trim().toUpperCase()
    if (!code || promotionBusy || pending || busy) return
    setPromotionBusy(true); setError('')
    try { setPromotion(await shopApi.request(`/promotions/${encodeURIComponent(code)}`)) }
    catch { setPromotion(null); setError(vi ? 'Mã không khả dụng hoặc chưa kiểm tra được. Vui lòng thử lại.' : 'Code unavailable or could not be verified. Please retry.') }
    finally { setPromotionBusy(false) }
  }
  const submitted = useRef(false)
  const labels = { cod: vi ? 'Thanh toán khi nhận hàng (COD)' : 'Cash on delivery (COD)', qr: vi ? 'Thanh toán bằng mã QR' : 'Pay by QR code' }

  async function submit(e) {
    e.preventDefault()
    try {
      await withCheckoutLock(user.id, () => submitLocked(e))
    } catch { setError(vi ? 'Đơn hoặc giỏ đang được xử lý ở tab khác. Vui lòng tải lại và kiểm tra đơn hàng trước khi thử tiếp.' : 'Another tab is processing your order or bag. Reload and check your orders before retrying.') }
  }
  async function submitLocked(e) {
    e.preventDefault()
    if (submitted.current || promotionBusy || !items.length || (!pending && !addressReady)) return
    if (!pending && !delivery) { setError(vi ? 'Vui lòng thêm hoặc chọn địa chỉ nhận hàng.' : 'Please add or select a delivery address.'); return }
    if (!pending && !payment) { setError(vi ? 'Vui lòng chọn phương thức thanh toán.' : 'Please select a payment method.'); setPopup(true); return }
    submitted.current = true
    setBusy(true); setError('')
    try {
      const { data, error: sessionError } = await supabase.auth.getUser()
      if (sessionError || data.user?.id !== user.id || data.user?.is_anonymous) throw new Error('auth')
      let payload = readOrderRequest(localStorage, user.id)?.payload || pending?.payload
      if (!payload) {
        const stored = readCart(localStorage, user.id)
        if (JSON.stringify(stored.map(i => [i.key, i.quantity])) !== JSON.stringify(items.map(i => [i.key, i.quantity]))) {
          setError(vi ? 'Giỏ hàng đã thay đổi ở tab khác. Vui lòng tải lại trước khi đặt hàng.' : 'Your bag changed in another tab. Please reload before ordering.')
          return
        }
        const book = await loadAddressBook(shopApi, user.id)
        const saved = book.addresses.find(address => address.id === delivery.id)
        if (!saved) {
          setDelivery(null)
          setAddressReady(false); setAddressVersion(version => version + 1)
          setError(vi ? 'Địa chỉ đã bị xóa ở phiên khác. Danh sách đang được tải lại; vui lòng chọn địa chỉ.' : 'This address was deleted in another session. The list is refreshing; please select an address.')
          return
        }
        if (['name', 'email', 'phone', 'city', 'address', 'notes'].some(key => saved[key] !== delivery[key])) {
          setDelivery(saved)
          setAddressReady(false); setAddressVersion(version => version + 1)
          setError(vi ? 'Thông tin địa chỉ đã thay đổi. Danh sách đang được tải lại; vui lòng kiểm tra địa chỉ rồi đặt hàng lại.' : 'The address details changed. The list is refreshing; please review the address and place your order again.')
          return
        }
        const updated = await refresh()
        if (updated.some((i, index) => i.product.price !== items[index].product.price)) {
          setError(vi ? 'Giá sản phẩm đã thay đổi. Vui lòng kiểm tra tổng tiền mới rồi đặt hàng lại.' : 'Product prices changed. Please review the updated total before placing your order.')
          return
        }
        if (cartHasUnavailableItems(updated)) {
          setError(vi ? 'Số lượng hoặc lựa chọn sản phẩm không còn khả dụng. Vui lòng cập nhật giỏ hàng.' : 'Some quantities or options are no longer available. Please update your bag.')
          return
        }
        payload = {
          items: items.map(i => ({ product_id: i.product.id, expected_price: i.product.price, quantity: i.quantity, color: i.color || '', size: i.size || '' })),
          address_id: saved.id, payment,
          ...(promotion ? { promotion_code: promotion.code, expected_discount: discount } : {}),
        }
      }
      const request = beginOrder(payload)
      const placed = await shopApi.request('/orders', {
        method: 'POST', auth: true, body: { ...payload, request_id: request.id },
      })
      setOrder({ ...placed, name: placed.delivery.name, total: Number(placed.total) })
      clear()
      window.scrollTo(0, 0)
    } catch (failure) {
      // Expired auth or a gateway error cannot tell us whether an earlier attempt committed.
      if (['NB_PROMOTION_INVALID', 'NB_PRICE_CHANGED', 'NB_INSUFFICIENT_STOCK', 'NB_INVALID_ORDER', 'NB_INVALID_INPUT', 'NB_ADDRESS_NOT_FOUND', 'NB_PRODUCT_NOT_FOUND'].includes(failure.code)) releaseOrder()
      setError(failure.message === 'NB_CART_CHANGED'
        ? (vi ? 'Giỏ hàng đã thay đổi ở tab khác. Vui lòng tải lại trước khi đặt hàng.' : 'Your bag changed in another tab. Please reload before ordering.')
        : failure.message === 'auth' || failure.message === 'NB_AUTH_REQUIRED'
        ? (vi ? 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.' : 'Your session has expired. Please sign in again.')
        : failure.code === 'NB_ADDRESS_NOT_FOUND'
        ? (vi ? 'Địa chỉ nhận hàng không còn tồn tại. Vui lòng tải lại và chọn địa chỉ khác trước khi đặt hàng.' : 'The delivery address no longer exists. Reload and select another address before placing your order.')
        : failure.code === 'NB_PRODUCT_NOT_FOUND'
        ? (vi ? 'Một sản phẩm không còn được bán. Vui lòng cập nhật giỏ hàng và bỏ sản phẩm đó trước khi đặt lại.' : 'A product is no longer available. Update your bag and remove it before ordering again.')
        : ['NB_INVALID_ORDER', 'NB_INVALID_INPUT'].includes(failure.code)
        ? (vi ? 'Thông tin đặt hàng không còn hợp lệ. Kiểm tra sản phẩm, màu/size, số lượng và địa chỉ rồi đặt lại.' : 'Order details are invalid. Review products, colors/sizes, quantities and delivery address before retrying.')
        : failure.code === 'NB_PROMOTION_INVALID' ? (vi ? 'Mã giảm giá đã ngừng áp dụng. Bỏ mã hoặc dùng mã khác rồi đặt lại.' : 'Promotion is no longer active. Remove or replace the code before retrying.') : failure.code === 'NB_PRICE_CHANGED' ? (vi ? 'Giá đã thay đổi. Tải lại giỏ hàng, kiểm tra tổng tiền rồi đặt lại.' : 'Prices changed. Reload your bag and review the total before retrying.') : failure.message?.includes('NB_INSUFFICIENT_STOCK') ? (vi ? 'Không đủ tồn kho. Vui lòng giảm số lượng trong giỏ và thử lại.' : 'Insufficient stock. Reduce the quantity in your bag and retry.') : (vi ? 'Chưa thể xác nhận đơn hàng. Vui lòng kiểm tra kết nối rồi thử lại; yêu cầu cũ sẽ được kiểm tra để tránh đặt trùng.' : 'Could not confirm your order. Check your connection and retry; the previous request will be checked to avoid duplicates.'))
    } finally { submitted.current = false; setBusy(false) }
  }

  if (!ready) return <main className="shop-shell" role="status">{vi ? 'Đang tải giỏ hàng…' : 'Loading your bag…'}</main>
  if (order) return <main className="shop-shell max-w-2xl text-center"><p className="eyebrow text-slate">{vi ? 'Hoàn tất' : 'Complete'}</p><h1 className="display-title mt-4 text-3xl">{order.status === 'canceled' ? (vi ? 'Đơn hàng đã bị hủy' : 'Order canceled') : (vi ? 'Đã đặt hàng thành công' : 'Order placed')}</h1><p className="mt-6 text-sm leading-7">{vi ? `Cảm ơn ${order.name}. Mã đơn của bạn là` : `Thank you, ${order.name}. Your order reference is`} <strong>{order.id}</strong>.</p><p className="mt-4">{formatPrice(order.total)}</p><p className="mt-4 text-sm">{labels[order.payment]}</p><p className="mt-3 text-sm">{order.delivery.address}, {order.delivery.city}</p><p className="mt-6 text-sm leading-7 text-slate">{order.status === 'canceled' ? (vi ? 'Đơn này đã bị hủy và tồn kho đã được hoàn lại. Xem chi tiết trong lịch sử đơn hàng.' : 'This order was canceled and stock restored. Check your order history for details.') : (vi ? 'Đơn hàng đã được lưu và tồn kho đã được cập nhật. Chưa phát sinh thanh toán trực tuyến.' : 'Your order is saved and inventory is updated. No online payment has been collected.')}</p><Link to="/account/orders" className="button mt-8">{vi ? 'Xem đơn hàng' : 'View orders'}</Link><Link to="/" className="button mt-8">{vi ? 'Về trang chủ' : 'Back home'}</Link></main>

  return <main className="shop-shell">
    <Link to="/cart" className="text-xs text-slate underline underline-offset-4">{vi ? '← Quay lại giỏ hàng' : '← Back to bag'}</Link><h1 className="display-title mt-5 text-3xl">{vi ? 'Thanh toán' : 'Checkout'}</h1>
    {pending && <p role="status" className="mt-6 text-sm text-amber-700">{vi ? 'Có yêu cầu đặt hàng chưa được xác nhận. Bấm kiểm tra lại để xác nhận đơn cũ; không tạo đơn mới.' : 'An order request is awaiting confirmation. Check it again to confirm the previous request without creating a new order.'}</p>}
    {!items.length ? <EmptyCart /> : <>
      <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_380px]">
        <div className="min-w-0 max-w-2xl">
          <AddressBook popupOnly key={addressVersion} selectedId={pending?.payload.address_id || delivery?.id} onSelect={setDelivery} onReady={setAddressReady} disabled={busy || !!pending} />
          <form id="checkout-form" onSubmit={submit}>
            <section className="mt-8 border-t border-feather pt-6"><h2 className="font-display text-xl uppercase">{vi ? 'Phương thức thanh toán' : 'Payment method'}</h2>{(pending?.payload.payment || payment) && <p className="mt-4 border border-feather p-4 text-sm">{labels[pending?.payload.payment || payment]}</p>}<button type="button" disabled={busy || !!pending} onClick={() => setPopup(true)} className="button mt-5">{payment ? (vi ? 'Thay đổi phương thức' : 'Change payment method') : (vi ? 'Chọn phương thức thanh toán' : 'Choose payment method')}</button></section>
            <p className="mt-6 text-xs leading-6 text-slate">{vi ? 'Đặt hàng sẽ trừ tồn kho. COD thanh toán khi nhận hàng; QR chưa tích hợp thanh toán trực tuyến. Miễn phí giao hàng.' : 'Placing an order reduces inventory. COD is paid on delivery; online QR payment is not integrated. Free delivery.'}</p><p role="alert" className="mt-4 text-sm text-red-700">{error}</p>
          </form>
        </div>
        <OrderSummary discount={discount} discountCode={pending?.payload.promotion_code || promotion?.code || ''}><section className="mt-6 space-y-3"><label className="block text-sm" htmlFor="promotion-code">{vi ? 'Mã giảm giá' : 'Promotion code'}</label><input id="promotion-code" maxLength={30} disabled={busy || promotionBusy || !!pending} value={promotionCode} onChange={e => { setPromotionCode(e.target.value); setPromotion(null) }} className="shop-input w-full" /><button type="button" className="button" disabled={busy || promotionBusy || !!pending || !promotionCode.trim()} onClick={applyPromotion}>{promotionBusy ? (vi ? 'Đang kiểm tra…' : 'Checking…') : (vi ? 'Áp dụng' : 'Apply')}</button>{promotion && <button type="button" disabled={busy || !!pending} className="ml-3 underline text-sm" onClick={() => { setPromotion(null); setPromotionCode('') }}>{vi ? 'Bỏ mã' : 'Remove code'}</button>}</section><div className="mt-6 space-y-3">{items.map(i => <p key={i.key} className="text-xs leading-6 text-slate">{i.product[lang]} · {colorName(i.product, i.color, lang)}{i.size && ` / ${i.size}`} × {i.quantity}</p>)}</div><button type="submit" form="checkout-form" disabled={busy || promotionBusy || (!pending && (!addressReady || !delivery))} className="button mt-8 w-full bg-obsidian text-white disabled:cursor-not-allowed disabled:opacity-40">{busy ? (vi ? 'Đang kiểm tra…' : 'Checking…') : pending ? (vi ? 'Kiểm tra lại đơn' : 'Check previous order') : (vi ? 'Đặt hàng' : 'Place order')}</button>{!delivery && !pending && <p className="mt-3 text-xs leading-6 text-slate">{vi ? 'Thêm địa chỉ nhận hàng để tiếp tục.' : 'Add a delivery address to continue.'}</p>}</OrderSummary>
      </div>
      {popup && <Popup title={vi ? 'Chọn phương thức thanh toán' : 'Choose payment method'} close={() => setPopup(false)}><form onSubmit={e => { e.preventDefault(); setPayment(new FormData(e.currentTarget).get('payment')); setError(''); setPopup(false) }}><div className="space-y-3">{Object.entries(labels).map(([value, label]) => <label key={value} className="flex cursor-pointer items-center gap-3 border border-feather p-5 text-sm has-[:checked]:border-obsidian has-[:checked]:bg-alabaster"><input type="radio" name="payment" value={value} defaultChecked={payment ? payment === value : value === 'cod'} required className="accent-obsidian" />{label}</label>)}</div><p className="mt-4 text-xs leading-6 text-slate">{vi ? 'QR hiện là lựa chọn demo, chưa tích hợp mã thanh toán thật.' : 'QR is a demo option; live payment codes are not integrated yet.'}</p><button type="submit" className="button mt-6 w-full bg-obsidian text-white">{vi ? 'Xác nhận' : 'Confirm'}</button></form></Popup>}
    </>}
  </main>
}
