import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useCart } from '../hooks/useCart'
import { useAuth } from '../hooks/useAuth'
import { useLang } from '../i18n'
import { formatPrice } from '../lib/format'
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
import QrPayment from '../components/QrPayment'
import { loadPaymentMethods } from '../lib/paymentMethods'

// Server refusals that are final for this payload: the saved request can be dropped.
const FINAL_ERRORS = ['NB_PROMOTION_INVALID', 'NB_PROMOTION_EXPIRED', 'NB_PROMOTION_EXHAUSTED', 'NB_PROMOTION_MIN_SUBTOTAL', 'NB_PRICE_CHANGED', 'NB_INSUFFICIENT_STOCK',
  'NB_INVALID_ORDER', 'NB_INVALID_INPUT', 'NB_ADDRESS_NOT_FOUND', 'NB_PRODUCT_NOT_FOUND', 'NB_TOO_MANY_OPEN_ORDERS', 'NB_PAYMENT_METHOD_UNAVAILABLE']

function promotionError(code, vi) {
  return {
    NB_PROMOTION_EXPIRED: vi ? 'Mã giảm giá đã hết hạn.' : 'This promotion has expired.',
    NB_PROMOTION_EXHAUSTED: vi ? 'Mã giảm giá đã hết lượt sử dụng.' : 'This promotion has been fully used.',
    NB_PROMOTION_MIN_SUBTOTAL: vi ? 'Đơn chưa đạt giá trị tối thiểu để dùng mã này.' : 'Your bag does not reach the minimum for this code.',
    NB_RATE_LIMITED: vi ? 'Bạn thử quá nhiều lần. Vui lòng đợi một phút rồi thử lại.' : 'Too many attempts. Please wait a minute and retry.',
  }[code]
}

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
  const [methods, setMethods] = useState(['cod'])
  const subtotal = items.reduce((sum, item) => sum + item.product.price * item.quantity, 0)
  const discount = pending?.payload.expected_discount ?? (promotion ? Math.floor(subtotal * promotion.percent / 100) : 0)
  useEffect(() => {
    let alive = true
    loadPaymentMethods().then(result => { if (alive) setMethods(result) })
    return () => { alive = false }
  }, [])
  async function applyPromotion() {
    const code = promotionCode.trim().toUpperCase()
    if (!code || promotionBusy || pending || busy) return
    setPromotionBusy(true); setError('')
    try {
      const found = await shopApi.request(`/promotions/${encodeURIComponent(code)}`)
      if (subtotal < (found.min_subtotal || 0)) {
        setPromotion(null)
        setError(vi ? `Mã này áp dụng cho đơn từ ${formatPrice(found.min_subtotal)}.` : `This code applies to orders from ${formatPrice(found.min_subtotal)}.`)
        return
      }
      setPromotion(found)
    }
    catch (e) { setPromotion(null); setError(promotionError(e.code, vi) || (vi ? 'Mã không khả dụng hoặc chưa kiểm tra được. Vui lòng thử lại.' : 'Code unavailable or could not be verified. Please retry.')) }
    finally { setPromotionBusy(false) }
  }
  const submitted = useRef(false)
  const allLabels = { cod: vi ? 'Thanh toán khi nhận hàng (COD)' : 'Cash on delivery (COD)', qr: vi ? 'Chuyển khoản bằng mã QR' : 'Bank transfer by QR code' }
  const labels = Object.fromEntries(Object.entries(allLabels).filter(([key]) => methods.includes(key) || pending?.payload.payment === key))

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
      if (FINAL_ERRORS.includes(failure.code)) releaseOrder()
      setError(promotionError(failure.code, vi) || (failure.code === 'NB_TOO_MANY_OPEN_ORDERS'
        ? (vi ? 'Bạn đang có quá nhiều đơn chờ xác nhận. Hoàn tất hoặc hủy bớt đơn cũ trong "Đơn hàng của tôi" rồi đặt lại.' : 'You have too many orders awaiting confirmation. Complete or cancel some in "My orders" first.')
        : failure.code === 'NB_PAYMENT_METHOD_UNAVAILABLE'
        ? (vi ? 'Thanh toán QR tạm thời không khả dụng. Vui lòng chọn COD.' : 'QR payment is temporarily unavailable. Please choose COD.')
        : failure.message === 'NB_CART_CHANGED'
        ? (vi ? 'Giỏ hàng đã thay đổi ở tab khác. Vui lòng tải lại trước khi đặt hàng.' : 'Your bag changed in another tab. Please reload before ordering.')
        : failure.message === 'auth' || failure.message === 'NB_AUTH_REQUIRED'
        ? (vi ? 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.' : 'Your session has expired. Please sign in again.')
        : failure.code === 'NB_ADDRESS_NOT_FOUND'
        ? (vi ? 'Địa chỉ nhận hàng không còn tồn tại. Vui lòng tải lại và chọn địa chỉ khác trước khi đặt hàng.' : 'The delivery address no longer exists. Reload and select another address before placing your order.')
        : failure.code === 'NB_PRODUCT_NOT_FOUND'
        ? (vi ? 'Một sản phẩm không còn được bán. Vui lòng cập nhật giỏ hàng và bỏ sản phẩm đó trước khi đặt lại.' : 'A product is no longer available. Update your bag and remove it before ordering again.')
        : ['NB_INVALID_ORDER', 'NB_INVALID_INPUT'].includes(failure.code)
        ? (vi ? 'Thông tin đặt hàng không còn hợp lệ. Kiểm tra sản phẩm, màu/size, số lượng và địa chỉ rồi đặt lại.' : 'Order details are invalid. Review products, colors/sizes, quantities and delivery address before retrying.')
        : failure.code === 'NB_PROMOTION_INVALID' ? (vi ? 'Mã giảm giá đã ngừng áp dụng. Bỏ mã hoặc dùng mã khác rồi đặt lại.' : 'Promotion is no longer active. Remove or replace the code before retrying.') : failure.code === 'NB_PRICE_CHANGED' ? (vi ? 'Giá đã thay đổi. Tải lại giỏ hàng, kiểm tra tổng tiền rồi đặt lại.' : 'Prices changed. Reload your bag and review the total before retrying.') : failure.message?.includes('NB_INSUFFICIENT_STOCK') ? (vi ? 'Không đủ tồn kho. Vui lòng giảm số lượng trong giỏ và thử lại.' : 'Insufficient stock. Reduce the quantity in your bag and retry.') : (vi ? 'Chưa thể xác nhận đơn hàng. Vui lòng kiểm tra kết nối rồi thử lại; yêu cầu cũ sẽ được kiểm tra để tránh đặt trùng.' : 'Could not confirm your order. Check your connection and retry; the previous request will be checked to avoid duplicates.')))
    } finally { submitted.current = false; setBusy(false) }
  }

  if (!ready) return <main className="shop-shell" role="status">{vi ? 'Đang tải giỏ hàng…' : 'Loading your bag…'}</main>
  if (order) return <main className="shop-shell max-w-reading text-center">
    <title>{`${order.status === 'canceled' ? (vi ? 'Đơn hàng đã bị hủy' : 'Order canceled') : (vi ? 'Đã đặt hàng thành công' : 'Order placed')} – N&B`}</title>
    <p className="eyebrow text-ink-muted">{vi ? 'Hoàn tất' : 'Complete'}</p>
    <h1 className="mt-4 font-display text-title">{order.status === 'canceled' ? (vi ? 'Đơn hàng đã bị hủy' : 'Order canceled') : (vi ? 'Đã đặt hàng thành công' : 'Order placed')}</h1>
    <p className="mt-6 text-body">{vi ? `Cảm ơn ${order.name}. Mã đơn của bạn là` : `Thank you, ${order.name}. Your order reference is`} <strong className="font-medium">{order.id}</strong>.</p>
    <dl className="mx-auto mt-8 max-w-sm space-y-3 bg-cream p-6 text-left text-body-sm">
      <div className="flex justify-between gap-4"><dt className="text-ink-muted">{vi ? 'Tổng cộng' : 'Total'}</dt><dd className="font-medium tabular-nums">{formatPrice(order.total)}</dd></div>
      <div className="flex justify-between gap-4"><dt className="text-ink-muted">{vi ? 'Thanh toán' : 'Payment'}</dt><dd className="text-right">{allLabels[order.payment]}</dd></div>
      <div className="flex justify-between gap-4"><dt className="text-ink-muted">{vi ? 'Giao tới' : 'Deliver to'}</dt><dd className="text-right">{order.delivery.address}, {order.delivery.city}</dd></div>
    </dl>
    <p className="mt-6 text-body-sm text-ink-muted">{order.status === 'canceled' ? (vi ? 'Đơn này đã bị hủy và tồn kho đã được hoàn lại. Xem chi tiết trong lịch sử đơn hàng.' : 'This order was canceled and stock restored. Check your order history for details.') : order.payment === 'qr' ? (vi ? 'Đơn được giữ hàng và chỉ được xác nhận sau khi nhận đủ tiền chuyển khoản.' : 'Items are reserved; the order is confirmed once the transfer is received.') : (vi ? 'Đơn hàng đã được lưu và tồn kho đã được cập nhật. Bạn thanh toán khi nhận hàng.' : 'Your order is saved and inventory is updated. You pay on delivery.')}</p>
    {order.payment === 'qr' && order.status !== 'canceled' && order.payment_status !== 'received' && <QrPayment orderId={order.id} />}
    <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
      <Link to="/account/orders" className="button button--primary">{vi ? 'Xem đơn hàng' : 'View orders'}</Link>
      <Link to="/" className="button">{vi ? 'Về trang chủ' : 'Back home'}</Link>
    </div>
  </main>

  return <main className="shop-shell max-w-checkout">
    <title>{`${vi ? 'Thanh toán' : 'Checkout'} – N&B`}</title>
    <Link to="/cart" className="inline-flex min-h-11 items-center text-body-sm text-link">{vi ? '← Quay lại giỏ hàng' : '← Back to bag'}</Link>
    <h1 className="mt-4 font-display text-title">{vi ? 'Thanh toán' : 'Checkout'}</h1>
    {pending && <p role="status" className="mt-6 border border-warning/30 bg-warning-soft px-4 py-3 text-body-sm text-warning">{vi ? 'Có yêu cầu đặt hàng chưa được xác nhận. Bấm kiểm tra lại để xác nhận đơn cũ; không tạo đơn mới.' : 'An order request is awaiting confirmation. Check it again to confirm the previous request without creating a new order.'}</p>}
    {!items.length ? <EmptyCart /> : <>
      <div className="mt-10 grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-16">
        <div className="min-w-0">
          <section aria-labelledby="checkout-step-address">
            <h2 id="checkout-step-address" className="mb-4 flex items-baseline gap-3 font-display text-title-sm"><span className="font-sans text-body-sm text-ink-muted tabular-nums">01</span>{vi ? 'Địa chỉ nhận hàng' : 'Delivery address'}</h2>
            <AddressBook popupOnly key={addressVersion} selectedId={pending?.payload.address_id || delivery?.id} onSelect={setDelivery} onReady={setAddressReady} disabled={busy || !!pending} />
          </section>
          <form id="checkout-form" onSubmit={submit}>
            <section className="mt-10 border-t border-line pt-8" aria-labelledby="checkout-step-payment">
              <h2 id="checkout-step-payment" className="flex items-baseline gap-3 font-display text-title-sm"><span className="font-sans text-body-sm text-ink-muted tabular-nums">02</span>{vi ? 'Phương thức thanh toán' : 'Payment method'}</h2>
              {(pending?.payload.payment || payment) && <p className="mt-5 border border-ink bg-cream p-4 text-body-sm">{labels[pending?.payload.payment || payment]}</p>}
              <button type="button" disabled={busy || !!pending} onClick={() => setPopup(true)} className="button mt-5">{payment ? (vi ? 'Thay đổi phương thức' : 'Change payment method') : (vi ? 'Chọn phương thức thanh toán' : 'Choose payment method')}</button>
            </section>
            <p className="mt-8 text-caption text-ink-muted">{vi ? 'Đặt hàng sẽ trừ tồn kho. COD thanh toán khi nhận hàng; với QR, đơn được xác nhận sau khi nhận đủ tiền. Miễn phí giao hàng.' : 'Placing an order reduces inventory. COD is paid on delivery; QR orders are confirmed once payment arrives. Free delivery.'}</p>
            <p role="alert" className={`text-body-sm text-danger ${error ? 'mt-4 border border-danger/30 bg-danger-soft px-4 py-3' : ''}`}>{error}</p>
          </form>
        </div>
        <OrderSummary discount={discount} discountCode={pending?.payload.promotion_code || promotion?.code || ''}>
          <ul className="mt-6 space-y-2 border-t border-line-strong/40 pt-5">{items.map(i => (
            <li key={i.key} className="text-caption text-ink-muted flex flex-wrap items-center justify-between gap-2">
              <span>{i.product[lang]} · {colorName(i.product, i.color, lang)}{i.size && ` / ${i.size}`} × {i.quantity}</span>
              {i.tried3D && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 border border-emerald-200">
                  <span className="size-1 rounded-full bg-emerald-500" />
                  {vi ? 'Đã thử 3D' : '3D Verified'}
                </span>
              )}
            </li>
          ))}</ul>
          <section className="mt-6">
            <label className="block text-body-sm font-medium" htmlFor="promotion-code">{vi ? 'Mã giảm giá' : 'Promotion code'}</label>
            <div className="mt-2 flex gap-2">
              <input id="promotion-code" maxLength={30} autoCapitalize="characters" disabled={busy || promotionBusy || !!pending} value={promotionCode} onChange={e => { setPromotionCode(e.target.value); setPromotion(null) }} className="shop-input min-w-0 flex-1 uppercase" />
              <button type="button" className="button button--sm" disabled={busy || promotionBusy || !!pending || !promotionCode.trim()} onClick={applyPromotion}>{promotionBusy ? (vi ? 'Đang kiểm tra…' : 'Checking…') : (vi ? 'Áp dụng' : 'Apply')}</button>
            </div>
            {promotion && <button type="button" disabled={busy || !!pending} className="mt-2 min-h-10 text-body-sm text-link" onClick={() => { setPromotion(null); setPromotionCode('') }}>{vi ? 'Bỏ mã' : 'Remove code'}</button>}
          </section>
          <button type="submit" form="checkout-form" disabled={busy || promotionBusy || (!pending && (!addressReady || !delivery))} aria-busy={busy || undefined} className="button button--primary mt-8 w-full">{busy ? (vi ? 'Đang kiểm tra…' : 'Checking…') : pending ? (vi ? 'Kiểm tra lại đơn' : 'Check previous order') : (vi ? 'Đặt hàng' : 'Place order')}</button>
          {!delivery && !pending && <p className="mt-3 text-caption text-ink-muted">{vi ? 'Thêm địa chỉ nhận hàng để tiếp tục.' : 'Add a delivery address to continue.'}</p>}
        </OrderSummary>
      </div>
      {popup && <Popup title={vi ? 'Chọn phương thức thanh toán' : 'Choose payment method'} close={() => setPopup(false)}><form onSubmit={e => { e.preventDefault(); setPayment(new FormData(e.currentTarget).get('payment')); setError(''); setPopup(false) }}>
        <fieldset><legend className="sr-only">{vi ? 'Phương thức thanh toán' : 'Payment method'}</legend><div className="space-y-3">{Object.entries(labels).map(([value, label]) => <label key={value} className="flex min-h-14 cursor-pointer items-center gap-3 border border-line-strong p-4 text-body-sm has-[:checked]:border-ink has-[:checked]:bg-cream"><input type="radio" name="payment" value={value} defaultChecked={payment ? payment === value : value === 'cod'} required className="size-5 accent-ink" />{label}</label>)}</div></fieldset>
        {labels.qr && <p className="mt-4 text-caption text-ink-muted">{vi ? 'Với QR, mã chuyển khoản hiện ngay sau khi đặt hàng.' : 'With QR, the transfer code appears right after you place the order.'}</p>}
        <button type="submit" className="button button--primary mt-6 w-full">{vi ? 'Xác nhận' : 'Confirm'}</button>
      </form></Popup>}
    </>}
  </main>
}
