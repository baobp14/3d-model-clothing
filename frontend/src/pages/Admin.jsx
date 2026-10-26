import AdminNotifications from '../components/AdminNotifications'
import { useEffect, useState } from 'react'
import { Link, Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import Icon from '../components/Icon'
import { useAuth } from '../hooks/useAuth'
import { useLang } from '../i18n'

const sections = [
  { to: '/admin', end: true, icon: 'dashboard', label: 'admin.revenue' },
  { icon: 'box', label: 'admin.inventory', children: [{ to: '/admin/inventory/products', label: 'admin.products' }, { to: '/admin/inventory/alerts', label: 'admin.stockAlerts' }] },
  { icon: 'tag', label: 'admin.pricing', children: [
    { to: '/admin/pricing/products', label: 'admin.productPrices' },
    { to: '/admin/pricing/promotions', label: 'admin.promotions' },
  ] },
  { to: '/admin/orders', icon: 'receipt', label: 'admin.orders' },
  { to: '/admin/returns', icon: 'refresh', label: 'admin.returns' },
]

const linkClass = ({ isActive }) => `flex min-h-11 items-center gap-3 rounded-xl px-4 py-3 text-[14px] font-medium transition-colors ${isActive ? 'bg-[#eef0ff] text-[#303a9f]' : 'text-[#505b72] hover:bg-[#f5f6fa] hover:text-[#252d78]'}`

function AdminNavigation({ close }) {
  const { t } = useLang()
  const { pathname } = useLocation()
  const activeGroups = () => Object.fromEntries(sections.filter(section => section.children).map(section => [section.label, section.children.some(item => pathname.startsWith(item.to))]))
  const [expanded, setExpanded] = useState(activeGroups)
  useEffect(() => { setExpanded(activeGroups()) }, [pathname])
  return <nav aria-label={t('admin.navigation')} className="space-y-1.5 px-4 py-5">
    {sections.map(section => section.children
      ? <details key={section.label} open={expanded[section.label]} onToggle={e => { const open = e.currentTarget.open; setExpanded(current => current[section.label] === open ? current : { ...current, [section.label]: open }) }} className="group">
          <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3 rounded-xl px-4 py-3 text-[14px] font-medium text-[#505b72] hover:bg-[#f5f6fa] hover:text-[#252d78]">
            <Icon name={section.icon} size={20} /><span className="flex-1">{t(section.label)}</span>
            <Icon name="chevronDown" size={15} className="transition-transform group-open:rotate-180" />
          </summary>
          <div className="ml-6 mt-1 space-y-1 border-l border-[#dfe3eb] pl-3">
            {section.children.map(item => <NavLink key={item.to} to={item.to} onClick={close} className={linkClass}>{t(item.label)}</NavLink>)}
          </div>
        </details>
      : <NavLink key={section.to} to={section.to} end={section.end} onClick={close} className={linkClass}>
          <Icon name={section.icon} size={20} />{t(section.label)}
        </NavLink>)}
  </nav>
}

export default function Admin() {
  const { t } = useLang()
  const { user, isAdmin, loading, signOut } = useAuth()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const [logoutError, setLogoutError] = useState('')

  if (loading) return <main className="grid min-h-screen place-items-center bg-[#f7f8fb]"><p className="text-sm text-slate">{t('auth.processing')}</p></main>
  if (!isAdmin) return <Navigate to="/login" replace />

  async function logout() {
    try { await signOut(); navigate('/login', { replace: true }) }
    catch { setLogoutError(t('auth.logoutFailed')) }
  }

  return <div className="min-h-screen bg-[#f7f8fb] text-[#111827] lg:grid lg:grid-cols-[300px_1fr]">
    {menuOpen && <button className="fixed inset-0 z-40 bg-black/45 lg:hidden" aria-label={t('nav.close')} onClick={() => setMenuOpen(false)} />}
    <aside className={`fixed inset-y-0 left-0 z-50 flex w-[300px] flex-col border-r border-[#e2e5ec] bg-white text-[#1f2937] shadow-xl transition-transform lg:sticky lg:top-0 lg:h-screen lg:shadow-none ${menuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
      <div className="flex h-[76px] items-center justify-between border-b border-[#e2e5ec] bg-white px-6">
        <Link to="/admin" onClick={() => setMenuOpen(false)}>
          <span className="block font-display text-[25px] leading-none tracking-[.18em]">N&amp;B</span>
          <span className="mt-1 block text-[9px] font-medium tracking-[.12em] text-[#70798e] uppercase">{t('admin.panel')}</span>
        </Link>
        <button className="rounded-lg p-2 text-[#657089] hover:bg-[#f2f3f8] hover:text-[#252d78] lg:hidden" onClick={() => setMenuOpen(false)} aria-label={t('nav.close')}><Icon name="close" /></button>
      </div>
      <AdminNavigation close={() => setMenuOpen(false)} />
      <div className="mt-auto p-4">
        <Link to="/" className="flex items-center justify-center gap-3 rounded-xl bg-[#303a9f] px-4 py-3.5 text-[14px] font-semibold text-white hover:bg-[#252d78]"><Icon name="home" size={19} />{t('admin.storefront')}</Link>
        <button onClick={logout} className="mt-2 flex w-full items-center gap-3 rounded-xl px-4 py-3.5 text-left text-[14px] font-medium text-[#505b72] hover:bg-[#f5f6fa] hover:text-[#252d78]"><Icon name="logout" size={20} />{t('auth.signOut')}</button>
      </div>
    </aside>

    <div className="min-w-0">
      <header className="sticky top-0 z-30 flex h-[76px] items-center justify-between border-b border-[#e2e5ec] bg-white px-5 lg:px-8">
        <button onClick={() => setMenuOpen(true)} className="rounded-lg p-2 text-[#29316f] hover:bg-[#f2f3f8] lg:hidden" aria-label={t('a11y.menu')}><Icon name="menu" /></button>
        <p className="hidden text-sm font-semibold text-[#29316f] sm:block">{t('admin.panel')}</p>
        <div className="ml-auto flex items-center gap-1 text-[#182033]">
          <AdminNotifications />
          <button onClick={logout} className="rounded-lg p-2.5 hover:bg-[#f2f3f8]" title={t('auth.signOut')} aria-label={t('auth.signOut')}><Icon name="logout" size={20} /></button>
          <span className="mx-2 hidden h-7 w-px bg-[#e2e5ec] sm:block" />
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#eef0ff] text-xs font-bold text-[#313b9d]">{user?.email?.[0]?.toUpperCase() || 'A'}</div>
        </div>
      </header>
      {logoutError && <p role="alert" className="p-5 text-sm text-red-700">{logoutError}</p>}
      <Outlet />
    </div>
  </div>
}

