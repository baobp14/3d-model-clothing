import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { shopApi } from '../lib/api'
import { useLang } from '../i18n'
import { useAuth } from '../hooks/useAuth'
import ExportButton from '../components/ExportButton'

const words = {
  vi: { pending: 'Chờ xác nhận', confirmed: 'Đã xác nhận', shipped: 'Đang giao', delivered: 'Đã giao', canceled: 'Đã hủy' },
  en: { pending: 'Awaiting confirmation', confirmed: 'Confirmed', shipped: 'Shipping', delivered: 'Delivered', canceled: 'Canceled' },
}
const transitions = { pending: ['confirmed', 'canceled'], confirmed: ['shipped', 'canceled'], shipped: ['delivered'] }
const filterKeys = ['q', 'status', 'paid', 'start', 'end', 'scope']

export default function Orders({ admin = false }) {
  const { lang } = useLang()
  const { user } = useAuth()
  const vi = lang === 'vi'
  const [params, setParams] = useSearchParams()
  const location = useLocation()
  const returnTo = location.pathname + location.search
  const query = params.toString()
  const [filters, setFilters] = useState(() => Object.fromEntries(filterKeys.map(key => [key, params.get(key) || ''])))
  const [result, setResult] = useState({ orders: [], total: 0, pages: 1, page: 1 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [revision, setRevision] = useState(0)
  const lock = useRef(false)
  const endpoint = admin ? '/admin/orders' : '/orders'
  const money = value => new Intl.NumberFormat(vi ? 'vi-VN' : 'en-US', { style: 'currency', currency: 'VND' }).format(value)
  const failure = vi ? 'Chưa tải hoặc cập nhật được đơn. Tải lại để kiểm tra trạng thái mới nhất.' : 'Could not load or update orders. Reload to check the latest status.'

  useEffect(() => { setFilters(Object.fromEntries(filterKeys.map(key => [key, params.get(key) || '']))) }, [query])
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true); setError('')
    shopApi.request(endpoint + (query ? `?${query}` : ''), { auth: true, signal: controller.signal }).then(data => {
      if (controller.signal.aborted) return
      const page = data.page || 1
      const pages = data.pages || 1
      if (page > pages) { const next = new URLSearchParams(query); next.set('page', String(pages)); setParams(next, { replace: true }); return }
      setResult({ ...data, page, pages, total: data.total ?? data.orders.length })
    }).catch(e => {
      if (!controller.signal.aborted) setError(e.code === 'NB_INVALID_DATE_RANGE' ? (vi ? 'Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.' : 'Start date must not be after end date.') : failure)
    }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [endpoint, query, user?.id, failure, revision])

  function apply(e) {
    e.preventDefault()
    const next = new URLSearchParams()
    for (const key of filterKeys) if (filters[key].trim()) next.set(key, filters[key].trim())
    if (filters.start && filters.end && filters.start > filters.end) { setError(vi ? 'Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.' : 'Start date must not be after end date.'); return }
    setParams(next)
    if (next.toString() === query) setRevision(x => x + 1)
  }
  function page(value) { const next = new URLSearchParams(params); next.set('page', String(value)); setParams(next) }
  const exportParams = new URLSearchParams(params)
  exportParams.delete('page'); exportParams.delete('limit')
  async function markTest(order) {
    if (lock.current || loading || !admin) return
    if (!window.confirm(vi ? 'Đổi loại đơn thật/test? Thao tác chỉ đổi thống kê, không thay đổi tiền hoặc tồn kho.' : 'Change real/test classification? This changes statistics only, not payments or stock.')) return
    lock.current = true; setBusy(true); setError('')
    try {
      await shopApi.request(`/admin/orders/${order.id}/test`, { method: 'PATCH', auth: true, body: { is_test: !order.is_test, expected_is_test: !!order.is_test } })
      setRevision(x => x + 1)
    } catch { setError(vi ? 'Chưa đổi được loại đơn. Tải lại để kiểm tra trước khi thử tiếp.' : 'Could not change classification. Reload before retrying.') }
    finally { lock.current = false; setBusy(false) }
  }
  async function update(order, status, payment = false) {
    if (lock.current || loading) return
    if (status === 'canceled' && !window.confirm(vi ? 'Bạn muốn hủy đơn hàng này?' : 'Cancel this order?')) return
    if (payment && !window.confirm(vi ? 'Xác nhận bạn đã thực nhận đủ tiền của đơn này? Thao tác này chỉ ghi nhận, không tự thu tiền.' : 'Confirm you have actually received the full order amount? This records receipt; it does not collect money.')) return
    lock.current = true; setBusy(true); setError('')
    try {
      const updated = await shopApi.request(`${endpoint}/${order.id}${payment ? '/payment' : ''}`, {
        method: 'PATCH', auth: true, body: payment ? { received: true } : { status, expected_status: order.status },
      })
      setResult(current => ({ ...current, orders: current.orders.map(row => row.id === updated.id ? { ...row, ...updated } : row) }))
      setRevision(x => x + 1)
    } catch (e) { setError(e.code === 'NB_PAID_ORDER_CANCEL' ? (vi ? 'Đơn đã thu tiền không thể hủy trực tiếp. Cần xử lý hoàn tiền trước.' : 'An order with received payment cannot be canceled directly. A refund must be handled first.') : failure) }
    finally { lock.current = false; setBusy(false) }
  }
  const field = (key, label, type = 'text') => <label className="block text-sm">{label}<input type={type} value={filters[key]} maxLength={key === 'q' ? 120 : undefined} onChange={e => setFilters(current => ({ ...current, [key]: e.target.value }))} className="shop-input mt-2 w-full" /></label>
  return <main className={admin ? 'p-5 lg:p-8' : 'shop-shell'}>
    <div className="flex flex-wrap items-center justify-between gap-4"><h1 className="display-title text-3xl">{admin ? (vi ? 'Quản lý đơn hàng' : 'Manage orders') : (vi ? 'Đơn hàng của tôi' : 'My orders')}</h1><button className="button" disabled={loading || busy} onClick={() => setRevision(x => x + 1)}>{vi ? 'Tải lại' : 'Reload'}</button></div>
    {!admin && <Link to="/products" className="mt-5 inline-block underline">{vi ? 'Tiếp tục mua sắm' : 'Continue shopping'}</Link>}
    {admin && <div className="mt-5"><ExportButton endpoint={`/admin/orders/export?${exportParams}`} disabled={loading || busy || !!error} /></div>}
    <form onSubmit={apply} className="mt-7 border border-feather bg-white p-5"><fieldset disabled={busy || loading} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {field('q', vi ? 'Mã đơn, người nhận, số điện thoại hoặc email' : 'Order ID, recipient, phone or email')}
      <label className="text-sm">{vi ? 'Trạng thái đơn' : 'Order status'}<select value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value }))} className="shop-input mt-2 w-full"><option value="">{vi ? 'Tất cả' : 'All'}</option>{Object.entries(words[lang]).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      <label className="text-sm">{vi ? 'Thu tiền' : 'Payment receipt'}<select value={filters.paid} onChange={e => setFilters(f => ({ ...f, paid: e.target.value }))} className="shop-input mt-2 w-full"><option value="">{vi ? 'Tất cả' : 'All'}</option><option value="received">{vi ? 'Đã thu tiền' : 'Payment received'}</option><option value="unpaid">{vi ? 'Chưa ghi nhận thu tiền' : 'Receipt not recorded'}</option></select></label>
      {field('start', vi ? 'Đặt từ ngày' : 'Ordered from', 'date')}{field('end', vi ? 'Đặt đến ngày' : 'Ordered through', 'date')}
      {admin && <label className="text-sm">{vi ? 'Loại dữ liệu đơn' : 'Order data'}<select value={filters.scope} onChange={e => setFilters(f => ({ ...f, scope: e.target.value }))} className="shop-input mt-2 w-full"><option value="">{vi ? 'Tất cả' : 'All'}</option><option value="real">{vi ? 'Đơn thật' : 'Real orders'}</option><option value="test">{vi ? 'Đơn test' : 'Test orders'}</option></select></label>}
      <div className="flex items-end gap-3"><button className="button">{vi ? 'Tìm / lọc' : 'Search / filter'}</button><button type="button" className="button" onClick={() => { setFilters(Object.fromEntries(filterKeys.map(key => [key, '']))); setParams({}) }}>{vi ? 'Xóa lọc' : 'Clear filters'}</button></div>
    </fieldset></form>
    {error && <p role="alert" className="my-5 text-red-700">{error}</p>}
    {loading && <p role="status" className="mt-8">{vi ? 'Đang tải đơn hàng…' : 'Loading orders…'}</p>}
    {!loading && !error && <p className="mt-5 text-sm">{result.total} {vi ? 'đơn hàng' : 'orders'} · {vi ? 'Trang' : 'Page'} {result.page}/{result.pages}</p>}
    {!loading && !result.orders.length && !error && <p className="mt-5">{vi ? 'Không có đơn phù hợp.' : 'No matching orders.'}</p>}
    <div className="mt-8 space-y-6">{!loading && result.orders.map(order => <article key={order.id} className="border border-feather bg-white p-5 sm:p-7">
      <div className="flex flex-wrap justify-between gap-3"><h2 className="break-all text-sm font-semibold">{vi ? 'Mã đơn' : 'Order'}: {order.id}</h2><p className="font-semibold">{words[lang][order.status] || order.status}</p></div>
      <p className="mt-2 text-xs text-slate">{new Date(order.created_at).toLocaleString(vi ? 'vi-VN' : 'en-US', { timeZone: 'Asia/Ho_Chi_Minh' })} · {order.payment === 'cod' ? (vi ? 'Trả tiền khi nhận hàng' : 'Cash on delivery') : (vi ? 'QR thử nghiệm' : 'Demo QR')}</p>
      <p className="mt-3 text-sm font-semibold">{order.payment_status === 'received' ? (vi ? 'Đã thu tiền' : 'Payment received') : (vi ? 'Chưa ghi nhận thu tiền' : 'Receipt not recorded')}{order.received_at && ` · ${new Date(order.received_at).toLocaleString(vi ? 'vi-VN' : 'en-US', { timeZone: 'Asia/Ho_Chi_Minh' })}`}</p>
      {order.is_test && <p className="mt-2 text-sm text-amber-700">{vi ? 'Đơn test — không tính vào thống kê mặc định' : 'Test order — excluded from default statistics'}</p>}
      <ul className="my-5 space-y-3">{order.items.map((item, index) => <li key={index} className="flex flex-wrap justify-between gap-2"><Link className="underline" to={`/product/${item.product_id}`} state={{ returnTo }}>{item[`name_${lang}`] || item.name}{(item[`color_${lang}`] || item.color) && ` · ${item[`color_${lang}`] || item.color}`} {item.size} × {item.quantity}</Link><span>{money(item.price * item.quantity)}</span></li>)}</ul>
      {order.discount > 0 && <p className="mb-3 text-sm">{vi ? 'Giảm giá' : 'Discount'} ({order.promotion_code}): −{money(order.discount)}</p>}
      <p className="font-semibold">{vi ? 'Tổng tiền' : 'Total'}: {money(order.total)}</p><p className="mt-4 text-sm">{order.delivery.name} · {order.delivery.phone}</p><p className="mt-2 text-sm">{order.delivery.address}, {order.delivery.city}</p>
      {order.delivery.notes && <p className="mt-2 whitespace-pre-wrap text-sm">{order.delivery.notes}</p>}
      <div className="mt-5 flex flex-wrap gap-3">{(admin ? transitions[order.status] || [] : order.status === 'pending' ? ['canceled'] : []).filter(status => status !== 'canceled' || order.payment_status !== 'received').map(status => <button key={status} disabled={busy} className="button" onClick={() => update(order, status)}>{status === 'canceled' ? (vi ? 'Hủy đơn' : 'Cancel order') : `${vi ? 'Chuyển sang' : 'Mark as'}: ${words[lang][status]}`}</button>)}
        {admin && order.status !== 'canceled' && order.payment_status !== 'received' && <button disabled={busy} className="button" onClick={() => update(order, null, true)}>{vi ? 'Ghi nhận đã thu tiền' : 'Record payment received'}</button>}
        {admin && <button disabled={busy || loading} className="button" onClick={() => markTest(order)}>{order.is_test ? (vi ? 'Chuyển thành đơn thật' : 'Mark as real order') : (vi ? 'Đánh dấu đơn test' : 'Mark as test order')}</button>}
      </div>
    </article>)}</div>
    {!error && <nav aria-label={vi ? 'Phân trang đơn hàng' : 'Order pagination'} className="mt-8 flex items-center justify-center gap-5"><button disabled={loading || busy || result.page <= 1} className="button" onClick={() => page(result.page - 1)}>{vi ? 'Trang trước' : 'Previous page'}</button><span>{result.page}/{result.pages}</span><button disabled={loading || busy || result.page >= result.pages} className="button" onClick={() => page(result.page + 1)}>{vi ? 'Trang sau' : 'Next page'}</button></nav>}
  </main>
}
