import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { shopApi } from '../lib/api'
import { useLang } from '../i18n'
import { returnWords } from '../components/OrderAftersales'

// Admin flow: pending → approved | rejected, approved → received.
// Stock comes back only when the received goods are marked sellable.
export default function Returns() {
  const { lang } = useLang()
  const vi = lang === 'vi'
  const [status, setStatus] = useState('pending')
  const [page, setPage] = useState(1)
  const [result, setResult] = useState({ returns: [], total: 0, page: 1, pages: 1 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const [notes, setNotes] = useState({})
  const [sellable, setSellable] = useState({})
  const lock = useRef(false)
  const money = value => new Intl.NumberFormat(vi ? 'vi-VN' : 'en-US', { style: 'currency', currency: 'VND' }).format(value)
  const failure = vi ? 'Chưa tải hoặc cập nhật được yêu cầu. Tải lại để xem trạng thái mới nhất.' : 'Could not load or update returns. Reload to see the latest status.'

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true); setError('')
    shopApi.request(`/admin/returns?page=${page}${status ? `&status=${status}` : ''}`, { auth: true, signal: controller.signal })
      .then(data => { if (!controller.signal.aborted) setResult(data) })
      .catch(() => { if (!controller.signal.aborted) setError(failure) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [status, page, revision, failure])

  async function decide(request, action) {
    if (lock.current) return
    const restock = action === 'receive' && !!sellable[request.id]
    if (action === 'receive' && !window.confirm(restock
      ? (vi ? 'Xác nhận đã nhận hàng trả và hàng còn bán được? Tồn kho sẽ được cộng lại.' : 'Confirm the goods arrived in sellable condition? Stock will be restored.')
      : (vi ? 'Xác nhận đã nhận hàng trả nhưng KHÔNG nhập lại kho (hàng lỗi/bẩn)?' : 'Confirm the goods arrived but will NOT be restocked (damaged)?'))) return
    lock.current = true; setError('')
    try {
      await shopApi.request(`/admin/returns/${request.id}`, { method: 'PATCH', auth: true, body: { action, expected_status: request.status, restock, note: notes[request.id] || '' } })
      setRevision(x => x + 1)
    } catch (e) {
      setError(e.code === 'NB_RETURN_STATUS_CONFLICT' ? (vi ? 'Yêu cầu vừa được người khác xử lý. Đã tải lại.' : 'Someone else just handled this request. Reloaded.') : failure)
      setRevision(x => x + 1)
    } finally { lock.current = false }
  }

  const filters = [['pending', returnWords[lang].pending], ['approved', returnWords[lang].approved], ['received', returnWords[lang].received], ['rejected', returnWords[lang].rejected], ['', vi ? 'Tất cả' : 'All']]
  return <main className="p-5 lg:p-8">
    <title>{(vi ? 'Đổi trả' : 'Returns') + ' – N&B'}</title>
    <div className="flex flex-wrap items-center justify-between gap-4"><h1 className="font-display text-title">{vi ? 'Yêu cầu đổi trả' : 'Return requests'}</h1>
      <button className="button" disabled={loading} onClick={() => setRevision(x => x + 1)}>{vi ? 'Tải lại' : 'Reload'}</button></div>
    <div role="group" aria-label={vi ? 'Lọc theo trạng thái' : 'Filter by status'} className="mt-6 flex flex-wrap gap-2">
      {filters.map(([key, label]) => <button key={key || 'all'} type="button" aria-pressed={status === key} className={`button ${status === key ? 'button--primary' : ''}`} onClick={() => { setStatus(key); setPage(1) }}>{label}</button>)}
    </div>
    {error && <p role="alert" className="my-5 text-danger">{error}</p>}
    {loading && <p role="status" className="mt-8">{vi ? 'Đang tải…' : 'Loading…'}</p>}
    {!loading && !result.returns.length && !error && <p className="mt-8">{vi ? 'Không có yêu cầu nào.' : 'No requests.'}</p>}
    <div className="mt-8 space-y-6">{!loading && result.returns.map(request => <article key={request.id} className="border border-line bg-white p-5 sm:p-7">
      <div className="flex flex-wrap justify-between gap-3">
        <h2 className="break-all text-sm font-semibold">{vi ? 'Đơn' : 'Order'}: <Link className="underline" to={`/admin/orders?q=${request.order.id}`}>{request.order.id}</Link></h2>
        <p className="font-semibold">{returnWords[lang][request.status]}{request.status === 'received' && (request.restocked ? (vi ? ' · đã nhập lại kho' : ' · restocked') : (vi ? ' · không nhập kho' : ' · not restocked'))}</p>
      </div>
      <p className="mt-2 text-xs text-ink-muted">{new Date(request.created_at).toLocaleString(vi ? 'vi-VN' : 'en-US', { timeZone: 'Asia/Ho_Chi_Minh' })} · {request.order.delivery.name} · {request.order.delivery.phone}</p>
      <p className="mt-4 whitespace-pre-wrap text-sm"><span className="font-semibold">{vi ? 'Lý do' : 'Reason'}:</span> {request.reason}</p>
      <ul className="my-4 space-y-1 text-sm">{request.order.items.map((item, index) => <li key={index}>{item[`name_${lang}`] || item.name}{(item[`color_${lang}`] || item.color) && ` · ${item[`color_${lang}`] || item.color}`} {item.size} × {item.quantity}</li>)}</ul>
      <p className="text-sm font-semibold">{vi ? 'Tổng đơn' : 'Order total'}: {money(request.order.total)} · {request.order.payment_status === 'received' ? (vi ? 'đã thu tiền (nhận hàng trả sẽ tạo yêu cầu hoàn tiền)' : 'paid (receiving opens a refund)') : (vi ? 'chưa thu tiền' : 'unpaid')}</p>
      {request.admin_note && <p className="mt-2 text-sm">{vi ? 'Ghi chú' : 'Note'}: {request.admin_note}</p>}
      {(request.status === 'pending' || request.status === 'approved') && <div className="mt-5 space-y-3 border-t border-line pt-4">
        <label className="block text-sm">{vi ? 'Ghi chú cho khách (không bắt buộc)' : 'Note to the customer (optional)'}
          <input value={notes[request.id] || ''} maxLength={500} onChange={e => setNotes(n => ({ ...n, [request.id]: e.target.value }))} className="shop-input mt-2 w-full" /></label>
        {request.status === 'approved' && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!sellable[request.id]} onChange={e => setSellable(s => ({ ...s, [request.id]: e.target.checked }))} />{vi ? 'Hàng còn bán được — nhập lại kho' : 'Goods are sellable — restock'}</label>}
        <div className="flex flex-wrap gap-3">
          {request.status === 'pending' && <><button className="button button--primary" onClick={() => decide(request, 'approve')}>{vi ? 'Duyệt' : 'Approve'}</button>
            <button className="button" onClick={() => decide(request, 'reject')}>{vi ? 'Từ chối' : 'Reject'}</button></>}
          {request.status === 'approved' && <button className="button button--primary" onClick={() => decide(request, 'receive')}>{vi ? 'Đã nhận hàng trả' : 'Mark received'}</button>}
        </div>
      </div>}
    </article>)}</div>
    {result.pages > 1 && <nav aria-label={vi ? 'Phân trang' : 'Pagination'} className="mt-8 flex items-center justify-center gap-5">
      <button className="button" disabled={loading || page <= 1} onClick={() => setPage(p => p - 1)}>{vi ? 'Trang trước' : 'Previous page'}</button>
      <span>{result.page}/{result.pages}</span>
      <button className="button" disabled={loading || page >= result.pages} onClick={() => setPage(p => p + 1)}>{vi ? 'Trang sau' : 'Next page'}</button>
    </nav>}
  </main>
}
