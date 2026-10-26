import { normalizeSpacingEvent } from '../lib/inputSpacing'
import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import AccountDrawer from './AccountDrawer'
import MenuDrawer from './MenuDrawer'
import Icon from './Icon'
import { useAuth } from '../hooks/useAuth'
import { useLang } from '../i18n'
import { useCart } from '../hooks/useCart'
import useSearchHistory from '../hooks/useSearchHistory'

// Từ khóa phổ biến: chỉ những từ dẫn tới sản phẩm có thật trong catalog.
const keywords = ['search.k1', 'search.k2', 'search.k3', 'search.k4']

export default function Header() {
  const navigate = useNavigate()
  const { count } = useCart()
  const [open, setOpen] = useState(false)
  const [hover, setHover] = useState(false)
  const [scrolled, setScrolled] = useState(() => window.scrollY > 20)
  const [search, setSearch] = useState(false)
  const [account, setAccount] = useState(false)
  const [query, setQuery] = useState('')
  const input = useRef(null)
  const searchButton = useRef(null)
  const header = useRef(null)
  const history = useSearchHistory()
  const { t } = useLang()
  const { user, isAdmin } = useAuth()
  const home = useLocation().pathname === '/'
  // Trang chủ: header trong suốt trên ảnh hero, chuyển nền trắng khi cuộn/hover/mở tìm kiếm.
  const solid = !home || hover || search || scrolled || open
  const tone = solid ? 'border-line bg-paper text-ink' : 'border-transparent bg-transparent text-on-ink'

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (!search) return
    input.current?.focus()
    const onKey = e => { if (e.key === 'Escape') { setSearch(false); searchButton.current?.focus() } }
    // Bấm ra ngoài header (vùng chứa ô tìm kiếm) thì đóng.
    const onDown = e => { if (!header.current?.contains(e.target)) setSearch(false) }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onDown)
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onDown) }
  }, [search])

  const submit = q => {
    const clean = q.trim().replace(/\s+/g, ' ').slice(0, 120)
    if (!clean) return
    setQuery(clean); history.add(clean); setSearch(false)
    navigate(`/search?${new URLSearchParams({ q: clean })}`)
  }

  const textButton = 'inline-flex h-11 items-center gap-2 px-2 text-caption'
  return <>
    <header ref={header} data-overlay={!solid} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      className={`sticky top-0 z-(--z-header) h-(--header-h) border-b transition-colors duration-(--duration-base) ease-soft ${home ? '-mb-(--header-h)' : ''} ${tone}`}>
      <div className="mx-auto grid h-full max-w-page grid-cols-[1fr_auto_1fr] items-center px-(--gutter) max-md:px-2">
        <div className="flex items-center">
          <button onClick={() => setOpen(true)} aria-label={t('a11y.menu')} aria-expanded={open} aria-controls="menu-drawer" className={textButton}>
            <Icon name="menu" size={20} /><span className="hidden md:inline">{t('nav.menu')}</span>
          </button>
          <button ref={searchButton} onClick={() => setSearch(!search)} aria-label={search ? t('search.close') : t('a11y.search')} aria-expanded={search} aria-controls="site-search-panel" className={textButton}>
            <Icon name={search ? 'close' : 'search'} size={20} /><span className="hidden md:inline">{t('a11y.search')}</span>
          </button>
        </div>
        <Link to="/" className="inline-flex min-h-11 items-center px-2 font-display text-[1.375rem] leading-none tracking-[.18em] md:text-[1.625rem]" aria-label={t('a11y.home')}>N&amp;B</Link>
        <div className="flex items-center justify-end">
          <button onClick={() => setAccount(true)} className="relative grid size-11 place-items-center" aria-label={t('a11y.account')} aria-expanded={account}>
            <Icon name="user" size={20} />
            {user && <span aria-hidden="true" className={`absolute right-2.5 top-2.5 size-1.5 rounded-full ${isAdmin ? 'bg-danger' : 'bg-accent'}`} />}
          </button>
          <Link to="/account/wishlist" className="grid size-11 place-items-center" aria-label={t('a11y.wishlist')}><Icon name="heart" size={20} /></Link>
          <Link to="/cart" className="relative grid size-11 place-items-center" aria-label={count === 1 ? t('a11y.cart1') : t('a11y.cart').replace('{count}', count)}>
            <Icon name="bag" size={20} />
            {count > 0 && <span aria-hidden="true" className={`absolute right-0.5 top-1 grid h-4 min-w-4 place-items-center rounded-full px-1 text-[0.625rem] font-medium leading-none tabular-nums ${solid ? 'bg-ink text-on-ink' : 'bg-paper text-ink'}`}>{count}</span>}
          </Link>
        </div>
      </div>

      <div id="site-search-panel" inert={!search} aria-hidden={!search}
        className={`absolute inset-x-0 top-full overflow-hidden border-line bg-paper text-ink transition-[max-height,opacity] duration-(--duration-slow) ease-soft ${search ? 'max-h-[28rem] border-b opacity-100' : 'max-h-0 opacity-0'}`}>
        <div className="mx-auto max-w-2xl px-(--gutter) py-8">
          <form role="search" onSubmit={e => { e.preventDefault(); submit(query) }}>
            <label htmlFor="site-search" className="sr-only">{t('a11y.search')}</label>
            <div className="flex items-center gap-3 border-b border-ink pb-2">
              <Icon name="search" size={20} />
              <input ref={input} id="site-search" type="search" maxLength={120} value={query} onChange={e => { normalizeSpacingEvent(e); setQuery(e.target.value) }}
                placeholder={t('search.placeholder')} enterKeyHint="search" className="min-h-11 w-full bg-transparent text-lead placeholder:text-ink-muted" />
            </div>
          </form>
          {history.items.length > 0 && <div className="mt-6">
            <div className="flex items-center justify-between">
              <p className="eyebrow text-ink-muted">{t('search.recent')}</p>
              <button onClick={history.clear} className="min-h-11 px-1 text-caption text-ink-muted text-link">{t('search.clear')}</button>
            </div>
            <ul className="mt-2 flex flex-wrap gap-2">
              {history.items.map(({ q }) => <li key={q} className="flex items-center border border-line-strong">
                <button onClick={() => submit(q)} className="min-h-10 pl-3 pr-1 text-body-sm">{q}</button>
                <button onClick={() => history.remove(q)} aria-label={`${t('search.remove')} ${q}`} className="grid size-10 place-items-center text-ink-muted hover:text-ink"><Icon name="close" size={14} /></button>
              </li>)}
            </ul>
          </div>}
          <div className="mt-6">
            <p className="eyebrow text-ink-muted">{t('search.popular')}</p>
            <ul className="mt-2 flex flex-wrap gap-x-6">
              {keywords.map(k => <li key={k}><button onClick={() => submit(t(k))} className="min-h-11 text-body-sm text-link">{t(k)}</button></li>)}
            </ul>
          </div>
        </div>
      </div>
    </header>

    <MenuDrawer open={open} onClose={() => setOpen(false)} />
    <AccountDrawer open={account} onClose={() => setAccount(false)} />
  </>
}
