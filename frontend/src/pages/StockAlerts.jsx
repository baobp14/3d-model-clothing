import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { shopApi } from '../lib/api'
import { useLang } from '../i18n'
import { useListParams } from '../hooks/useListParams'
import Pagination from '../components/Pagination'

export default function StockAlerts() {
  const { lang } = useLang(), vi = lang === 'vi'
  const { page, setPage } = useListParams()
  const [data, setData] = useState({ alerts: [], pages: 1, total: 0 }), [busy, setBusy] = useState(true), [error, setError] = useState(''), [revision, setRevision] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    async function load() {
      setBusy(true); setError('')
      try { const result = await shopApi.request(`/admin/stock-alerts?page=${page}&limit=20`, { auth: true, signal: controller.signal }); if (!controller.signal.aborted) { if (page > result.pages) setPage(result.pages); else setData(result) } }
      catch { if (!controller.signal.aborted) setError(vi ? 'Không tải được cảnh báo kho.' : 'Could not load stock alerts.') }
      finally { if (!controller.signal.aborted) setBusy(false) }
    }
    load(); return () => controller.abort()
  }, [page, revision, vi])
  return <main className="p-5 lg:p-8"><div className="flex flex-wrap justify-between gap-3"><h1 className="text-3xl font-semibold">{vi ? 'Cảnh báo tồn kho' : 'Stock alerts'}</h1><button disabled={busy} className="button" onClick={() => setRevision(x => x + 1)}>{vi ? 'Tải lại' : 'Reload'}</button></div><p className="mt-4 text-sm text-slate">{vi ? 'Các màu/size còn ≤20 hoặc hết hàng. Sản phẩm chưa phân bổ được xét theo kho chung.' : 'Color/size options with ≤20 units or no stock. Unallocated products use shared inventory.'}</p>
    {busy && <p role="status" className="mt-6">{vi ? 'Đang tải…' : 'Loading…'}</p>}{error && <p role="alert" className="mt-6 text-red-700">{error}</p>}
    {!busy && !error && <><p className="mt-5 text-sm">{data.total} {vi ? 'cảnh báo' : 'alerts'}</p><ul className="mt-6 grid gap-4 md:grid-cols-2">{data.alerts.map(row => <li key={`${row.product_id}:${row.color}:${row.size}`}><Link to={row.href} state={{ returnTo: `/admin/inventory/alerts?page=${page}` }} className="block rounded-xl border border-feather bg-white p-5"><strong>{row[`name_${lang}`]}</strong><p className="mt-2 text-sm">{row.color_names[lang] || row.color || (vi ? 'Kho chung/mặc định' : 'Shared/default stock')} {row.size && ` / ${row.size}`}</p><p className={`mt-2 font-semibold ${row.stock === 0 ? 'text-red-700' : 'text-amber-700'}`}>{row.stock === 0 ? (vi ? 'Hết hàng' : 'Out of stock') : `${vi ? 'Còn' : 'Remaining'}: ${row.stock}`}</p></Link></li>)}</ul>{!data.alerts.length && <p className="mt-6">{vi ? 'Không có lựa chọn tồn thấp.' : 'No low-stock options.'}</p>}<Pagination page={page} pages={data.pages} total={data.total} busy={busy} onPage={setPage} /></>}
  </main>
}
