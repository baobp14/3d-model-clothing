import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { shopApi } from '../lib/api'
import { useLang } from '../i18n'
import Pagination from './Pagination'

export default function StockHistory({ product, colors }) {
  const { lang } = useLang(), vi = lang === 'vi'
  const [page, setPage] = useState(1), [revision, setRevision] = useState(0)
  const [data, setData] = useState({ movements: [], total: 0, pages: 1 }), [busy, setBusy] = useState(false), [error, setError] = useState('')
  const key = `${product.id}:${product.stock}:${product.stockRevision}:${product.colors.join(',')}:${product.sizes.join(',')}`
  useEffect(() => { setPage(1) }, [key])
  useEffect(() => {
    const controller = new AbortController()
    async function load() {
      setBusy(true); setError('')
      try {
        const result = await shopApi.request(`/admin/products/${product.id}/history?page=${page}&limit=20`, { auth: true, signal: controller.signal })
        if (!controller.signal.aborted) setData({ movements: result?.movements || [], total: result?.total || 0, pages: result?.pages || 1 })
      } catch { if (!controller.signal.aborted) setError(vi ? 'Không tải được lịch sử kho.' : 'Could not load stock history.') }
      finally { if (!controller.signal.aborted) setBusy(false) }
    }
    load(); return () => controller.abort()
  }, [key, page, revision, vi])
  const labels = vi ? { create: 'Tạo sản phẩm', configure: 'Phân bổ kho', adjust: 'Điều chỉnh kho', order: 'Đặt đơn', cancel: 'Hủy đơn' } : { create: 'Product created', configure: 'Stock allocation', adjust: 'Stock adjustment', order: 'Order placed', cancel: 'Order canceled' }
  return <section className="mt-7 rounded-2xl border border-feather bg-white p-5 sm:p-7"><div className="flex flex-wrap justify-between gap-3"><h2 className="font-semibold">{vi ? 'Lịch sử thay đổi kho' : 'Stock movement history'}</h2><button className="button" disabled={busy} onClick={() => setRevision(x => x + 1)}>{vi ? 'Tải lại' : 'Reload history'}</button></div>
    <p className="mt-3 text-xs text-slate">{vi ? 'Ghi nhận từ khi bật lịch sử kho; không khôi phục các thay đổi cũ.' : 'Records start when stock history was enabled; earlier movements are not reconstructed.'}</p>
    {busy && <p role="status" className="mt-4">{vi ? 'Đang tải…' : 'Loading…'}</p>}{error && <p role="alert" className="mt-4 text-red-700">{error}</p>}
    {!busy && !error && !data.movements.length && <p className="mt-4 text-sm">{vi ? 'Chưa có thay đổi được ghi nhận.' : 'No recorded movements yet.'}</p>}
    {!busy && <ul className="mt-4 space-y-4">{data.movements.map(row => <li key={row.id} className="rounded-lg border border-feather p-4 text-sm"><div className="flex flex-wrap justify-between gap-2"><strong>{labels[row.kind] || row.kind}: {row.before_stock} → {row.after_stock}</strong><span>{new Date(row.created_at).toLocaleString(vi ? 'vi-VN' : 'en-GB', { timeZone: 'Asia/Ho_Chi_Minh' })}</span></div><p className="mt-2 break-all text-xs text-slate">{vi ? 'ID người thao tác' : 'Actor ID'}: {row.actor_id}</p><p className="mt-2">{vi ? 'Lý do' : 'Reason'}: {row.reason || labels[row.kind]}</p>{row.changes.map((change, i) => <p className="mt-1" key={i}>{colors.find(c => c.id === change.color)?.[lang] || change.color || (vi ? 'Mặc định' : 'Default')} / {change.size || '—'}: {change.before ?? '—'} → {change.after ?? '—'}</p>)}{row.order_id && <Link className="mt-2 inline-block break-all underline" to={`/admin/orders?q=${row.order_id}`}>{vi ? 'Xem đơn' : 'View order'}: {row.order_id}</Link>}</li>)}</ul>}
    <Pagination page={page} pages={data.pages} total={data.total} busy={busy} onPage={setPage} />
  </section>
}
