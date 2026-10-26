import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { shopApi } from '../lib/api'
import { useLang } from '../i18n'

// Accounts come from Supabase Auth; order count and spend come from the shop DB.
// Admins can lock a customer, which blocks sign-in and ordering until unlocked.
export default function Users() {
  const { lang } = useLang()
  const vi = lang === 'vi'
  const [query, setQuery] = useState('')
  const [applied, setApplied] = useState('')
  const [page, setPage] = useState(1)
  const [result, setResult] = useState({ users: [], total: 0, page: 1, pages: 1 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const lock = useRef(false)
  const locale = vi ? 'vi-VN' : 'en-US'
  const money = value => new Intl.NumberFormat(locale, { style: 'currency', currency: 'VND' }).format(value)
  const date = value => value ? new Date(value).toLocaleDateString(locale, { timeZone: 'Asia/Ho_Chi_Minh' }) : '—'
  const failure = vi ? 'Chưa tải được danh sách người dùng.' : 'Could not load users.'

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true); setError('')
    shopApi.request(`/admin/users?page=${page}&q=${encodeURIComponent(applied)}`, { auth: true, signal: controller.signal })
      .then(data => { if (!controller.signal.aborted) setResult(data) })
      .catch(e => {
        if (controller.signal.aborted) return
        setError(e.code === 'NB_USER_ADMIN_NOT_CONFIGURED'
          ? (vi ? 'Backend chưa có SUPABASE_SECRET_KEY nên chưa quản lý được người dùng.' : 'The backend has no SUPABASE_SECRET_KEY, so users cannot be managed.')
          : failure)
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [applied, page, failure, vi])

  async function toggle(user) {
    if (lock.current) return
    const question = user.locked
      ? (vi ? `Mở khóa tài khoản ${user.email}?` : `Unlock ${user.email}?`)
      : (vi ? `Khóa tài khoản ${user.email}? Người này sẽ không đăng nhập và đặt hàng được cho tới khi mở khóa.` : `Lock ${user.email}? They cannot sign in or order until unlocked.`)
    if (!window.confirm(question)) return
    lock.current = true; setError('')
    try {
      const updated = await shopApi.request(`/admin/users/${user.id}`, { method: 'PATCH', auth: true, body: { locked: !user.locked } })
      setResult(current => ({ ...current, users: current.users.map(row => row.id === updated.id ? updated : row) }))
    } catch {
      setError(vi ? 'Chưa đổi được trạng thái tài khoản. Vui lòng thử lại.' : 'Could not change the account. Please retry.')
    } finally { lock.current = false }
  }

  const columns = vi
    ? ['Người dùng', 'Số điện thoại', 'Vai trò', 'Ngày đăng ký', 'Đăng nhập cuối', 'Đơn', 'Đã mua', 'Trạng thái', '']
    : ['User', 'Phone', 'Role', 'Joined', 'Last sign-in', 'Orders', 'Spent', 'Status', '']
  const status = user => user.locked ? ['danger', vi ? 'Đã khóa' : 'Locked']
    : !user.confirmed ? ['warning', vi ? 'Chưa xác nhận email' : 'Email unconfirmed']
    : ['success', vi ? 'Hoạt động' : 'Active']

  return <main className="p-5 lg:p-8">
    <title>{(vi ? 'Người dùng' : 'Users') + ' – N&B'}</title>
    <h1 className="font-display text-title">{vi ? 'Quản lý người dùng' : 'User management'}</h1>
    <form className="mt-6 flex flex-wrap gap-3" onSubmit={e => { e.preventDefault(); setPage(1); setApplied(query.trim()) }}>
      <label className="sr-only" htmlFor="user-search">{vi ? 'Tìm người dùng' : 'Search users'}</label>
      <input id="user-search" value={query} maxLength={120} onChange={e => setQuery(e.target.value)} placeholder={vi ? 'Tên, email hoặc số điện thoại' : 'Name, email or phone'} className="shop-input w-full max-w-md" />
      <button className="button button--primary">{vi ? 'Tìm' : 'Search'}</button>
    </form>
    {error && <p role="alert" className="my-5 text-danger">{error}</p>}
    {!error && <p className="mt-5 text-sm text-ink-muted">{loading ? (vi ? 'Đang tải…' : 'Loading…') : `${result.total} ${vi ? 'tài khoản' : 'accounts'}`}</p>}
    <div className="card mt-4 overflow-x-auto">
      <table className="w-full min-w-[56rem] text-left text-sm">
        <thead className="border-b border-line bg-cream text-xs text-ink-muted">
          <tr>{columns.map((label, index) => <th key={index} scope="col" className="px-4 py-3 font-semibold">{label}</th>)}</tr>
        </thead>
        <tbody>{result.users.map(user => {
          const [tone, label] = status(user)
          return <tr key={user.id} className="border-b border-line last:border-0">
            <td className="px-4 py-3"><p className="font-semibold">{user.name || '—'}</p><p className="text-ink-muted">{user.email}</p></td>
            <td className="px-4 py-3 tabular-nums">{user.phone || '—'}</td>
            <td className="px-4 py-3"><span className={`badge ${user.role === 'admin' ? 'badge--info' : ''}`}>{user.role === 'admin' ? 'Admin' : (vi ? 'Khách' : 'Customer')}</span></td>
            <td className="px-4 py-3 tabular-nums">{date(user.created_at)}</td>
            <td className="px-4 py-3 tabular-nums">{date(user.last_sign_in_at)}</td>
            <td className="px-4 py-3 tabular-nums">{user.orders > 0 ? <Link className="underline" to={`/admin/orders?q=${encodeURIComponent(user.email)}`}>{user.orders}</Link> : 0}</td>
            <td className="px-4 py-3 tabular-nums">{money(user.spent)}</td>
            <td className="px-4 py-3"><span className={`badge badge--${tone}`}>{label}</span></td>
            <td className="px-4 py-3 text-right">{user.role !== 'admin' && <button type="button" className={`button button--sm ${user.locked ? '' : 'button--danger'}`} onClick={() => toggle(user)}>{user.locked ? (vi ? 'Mở khóa' : 'Unlock') : (vi ? 'Khóa' : 'Lock')}</button>}</td>
          </tr>
        })}</tbody>
      </table>
    </div>
    {result.pages > 1 && <nav aria-label={vi ? 'Phân trang' : 'Pagination'} className="mt-6 flex items-center justify-center gap-5">
      <button className="button" disabled={loading || page <= 1} onClick={() => setPage(p => p - 1)}>{vi ? 'Trang trước' : 'Previous page'}</button>
      <span>{result.page}/{result.pages}</span>
      <button className="button" disabled={loading || page >= result.pages} onClick={() => setPage(p => p + 1)}>{vi ? 'Trang sau' : 'Next page'}</button>
    </nav>}
  </main>
}
