import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { shopApi } from '../lib/api'
import { useLang } from '../i18n'
import Icon from './Icon'
import Popup from './Popup'

export default function AdminNotifications() {
  const { lang, t } = useLang(), vi = lang === 'vi'
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('')
  const [data, setData] = useState({ notifications: [], unread: 0 }), generation = useRef(0)
  async function load() {
    const current = ++generation.current
    setBusy(true)
    try { const result = await shopApi.request('/admin/notifications', { auth: true }); if (current === generation.current) { setData({ notifications: [], unread: 0, ...result }); setError('') } }
    catch { if (current === generation.current) setError(vi ? 'Không tải được thông báo. Vui lòng thử lại.' : 'Could not load notifications. Please retry.') }
    finally { if (current === generation.current) setBusy(false) }
  }
  useEffect(() => {
    load()
    const refresh = () => { if (!document.hidden) load() }
    const timer = setInterval(refresh, 45000)
    window.addEventListener('focus', refresh)
    return () => { generation.current++; clearInterval(timer); window.removeEventListener('focus', refresh) }
  }, [vi])
  async function read(keys) {
    if (!keys.length) return
    const current = ++generation.current
    setBusy(true)
    try { const result = await shopApi.request('/admin/notifications/read', { method: 'POST', auth: true, body: { keys } }); if (current === generation.current) { setData(result); setError('') } }
    catch { if (current === generation.current) setError(vi ? 'Chưa đánh dấu đã đọc được. Vui lòng thử lại.' : 'Could not mark notifications as read. Please retry.') }
    finally { if (current === generation.current) setBusy(false) }
  }
  return <><button onClick={() => { setOpen(true); load() }} className="relative rounded-lg p-2.5 hover:bg-[#f2f3f8]" title={t('admin.notifications')} aria-label={t('admin.notifications')}><Icon name="bell" size={20} />{data.unread > 0 && <span className="absolute -right-1 -top-1 rounded-full bg-red-700 px-1.5 text-xs text-white">{data.unread}</span>}</button>
    {open && <Popup title={t('admin.notifications')} close={() => setOpen(false)} busy={busy}><div className="flex flex-wrap gap-3"><button className="button" disabled={busy} onClick={load}>{vi ? 'Tải lại' : 'Reload'}</button><button className="button" disabled={busy || !data.unread} onClick={() => read(data.notifications.filter(row => !row.read).map(row => row.key))}>{vi ? 'Đọc tất cả mục đang hiển thị' : 'Read all displayed items'}</button></div><p className="mt-4 text-xs text-slate">{vi ? 'Tối đa 20 đơn chờ và 20 cảnh báo kho. Đơn test không tạo thông báo đơn mới.' : 'Up to 20 pending orders and 20 stock alerts. Test orders do not generate new-order notifications.'}</p>{busy && <p role="status" className="mt-4">{vi ? 'Đang cập nhật…' : 'Updating…'}</p>}{error && <p role="alert" className="mt-4 text-red-700">{error}</p>}
      <ul className="mt-5 space-y-3">{data.notifications.map(row => <li key={row.key}><Link to={row.href} onClick={() => { setOpen(false); if (!row.read) read([row.key]) }} className={`block break-words rounded-lg border p-4 text-sm ${row.read ? 'border-feather' : 'border-indigo-300 bg-indigo-50'}`}>{row.kind === 'order' ? <><strong>{vi ? 'Đơn mới chờ xác nhận' : 'New order awaiting confirmation'}</strong><p className="mt-2 break-all">{row.id}</p></> : <><strong>{row[`name_${lang}`]}</strong><p className="mt-2">{row.color_names[lang] || row.color} {row.size} · {vi ? 'Tồn kho' : 'Stock'}: {row.stock}</p></>}</Link></li>)}</ul>{!busy && !error && !data.notifications.length && <p className="mt-5">{vi ? 'Chưa có thông báo cần xử lý.' : 'No actionable notifications.'}</p>}
      <div className="mt-6 flex flex-wrap gap-4 text-sm"><Link className="underline" to="/admin/orders?status=pending&scope=real" onClick={() => setOpen(false)}>{vi ? 'Xem toàn bộ đơn chờ' : 'View all pending orders'}</Link><Link className="underline" to="/admin/inventory/alerts" onClick={() => setOpen(false)}>{vi ? 'Xem toàn bộ cảnh báo kho' : 'View all stock alerts'}</Link></div>
    </Popup>}
  </>
}
