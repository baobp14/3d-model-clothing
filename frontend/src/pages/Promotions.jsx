import { useEffect, useRef, useState } from 'react'
import { useListParams } from '../hooks/useListParams'
import Pagination from '../components/Pagination'
import { shopApi } from '../lib/api'
import { useLang } from '../i18n'

export default function Promotions() {
  const { lang } = useLang()
  const vi = lang === 'vi'
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(null)
  const [revision, setRevision] = useState(0)
  const lock = useRef(false)
  const { page, setPage } = useListParams()
  const [paging, setPaging] = useState({ total: 0, pages: 1 })
  useEffect(() => {
    let active = true
    setLoading(true)
    shopApi.request(`/admin/promotions?page=${page}&limit=20`, { auth: true }).then(result => { if (active) { if (page > result.pages) { setPage(result.pages); return } setRows(result.promotions); setPaging(result); setError('') } })
      .catch(() => { if (active) setError(vi ? 'Không tải được mã giảm giá. Vui lòng tải lại.' : 'Could not load promotions. Please reload.') }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [revision, vi, page])
  async function save(e) {
    e.preventDefault()
    if (lock.current || loading) return
    const form = new FormData(e.currentTarget)
    lock.current = true; setBusy(true); setError('')
    try {
      await shopApi.request('/admin/promotions', { method: 'POST', auth: true, body: { code: editing?.code || form.get('code').trim().toUpperCase(), percent: Number(form.get('percent')), active: form.get('active') === 'on', expected: editing } })
      setRevision(x => x + 1)
      setEditing(null); e.target.reset()
    } catch { setError(vi ? 'Chưa lưu được. Mã có thể đã tồn tại hoặc thay đổi ở phiên khác; tải lại để kiểm tra trước khi thử tiếp.' : 'Could not save. The code may already exist or have changed in another session; reload before retrying.') }
    finally { lock.current = false; setBusy(false) }
  }
  return <main className="p-5 lg:p-8"><div className="flex justify-between gap-3"><h1 className="text-3xl font-semibold">{vi ? 'Mã giảm giá' : 'Promotions'}</h1><button disabled={busy || loading} className="button" onClick={() => { setEditing(null); setRevision(x => x + 1) }}>{vi ? 'Tải lại' : 'Reload'}</button></div>
    <p className="mt-4 text-sm text-slate">{vi ? 'Giảm theo phần trăm tổng tiền sản phẩm; mỗi đơn dùng một mã. Tắt mã không thay đổi đơn đã đặt.' : 'Percentage discount on product subtotal; one code per order. Disabling a code does not change existing orders.'}</p>
    {error && <p role="alert" className="mt-5 text-red-700">{error}</p>}{loading && <p role="status" className="mt-5">{vi ? 'Đang tải…' : 'Loading…'}</p>}
    <form key={editing?.code || 'new'} onSubmit={save} className="mt-8 max-w-xl space-y-4 rounded-xl border border-feather bg-white p-6"><h2 className="font-semibold">{editing ? (vi ? 'Sửa mã' : 'Edit code') : (vi ? 'Thêm mã' : 'Add code')}</h2><fieldset disabled={busy || loading} className="space-y-4">
      <label className="block">{vi ? 'Mã (A–Z, 0–9, _ hoặc -)' : 'Code (A–Z, 0–9, _ or -)'}<input name="code" required readOnly={Boolean(editing)} maxLength={30} pattern="[A-Za-z0-9_-]{1,30}" defaultValue={editing?.code || ''} className="shop-input mt-2 w-full" /></label>
      <label className="block">{vi ? 'Giảm (%)' : 'Discount (%)'}<input name="percent" type="number" required min="1" max="80" step="1" defaultValue={editing?.percent || 10} className="shop-input mt-2 w-full" /></label>
      <label className="flex items-center gap-3"><input type="checkbox" name="active" defaultChecked={editing?.active ?? true} />{vi ? 'Đang áp dụng' : 'Active'}</label><button className="button">{vi ? 'Lưu mã' : 'Save code'}</button>{editing && <button type="button" className="button ml-3" onClick={() => setEditing(null)}>{vi ? 'Hủy sửa' : 'Cancel edit'}</button>}
    </fieldset></form><ul className="mt-8 space-y-3">{rows.map(row => <li key={row.code} className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-feather bg-white p-5"><span><strong>{row.code}</strong> · {row.percent}% · {row.active ? (vi ? 'Đang áp dụng' : 'Active') : (vi ? 'Đã tắt' : 'Inactive')}</span><button disabled={busy || loading} className="button" onClick={() => setEditing(row)}>{vi ? 'Sửa' : 'Edit'}</button></li>)}</ul>
    {!error && <Pagination page={page} pages={paging.pages} total={paging.total} onPage={setPage} busy={loading || busy} />}
  </main>
}
