import DevelopmentButton from './DevelopmentButton'
import { normalizeSpacingEvent } from '../lib/inputSpacing'
import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import AccountDrawer from './AccountDrawer'
import Icon from './Icon'
import { useAuth } from '../hooks/useAuth'
import { useLang } from '../i18n'
import { useCart } from '../hooks/useCart'
import useSearchHistory from '../hooks/useSearchHistory'

const menu = [['nav.women', '/women/ready-to-wear'], ['nav.men', '/men/ready-to-wear'], ['nav.bags', '/bags'], ['nav.watches', '/watches']]
const keywords = ['search.k1', 'search.k2', 'search.k3', 'search.k4', 'search.k5']

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
  const header = useRef(null)
  const history = useSearchHistory()
  const { lang, setLang, t } = useLang()
  const { user, isAdmin } = useAuth()
  const overlay = useLocation().pathname === '/'
  const shell = !overlay
    ? 'sticky top-0 border-b border-feather bg-white text-obsidian'
    : `fixed inset-x-0 top-0 ${hover || search || scrolled ? 'border-b border-feather bg-white text-obsidian' : 'bg-transparent text-white'}`
  const langBtn = code => `px-2 py-1 text-[11px] tracking-[.16em] uppercase transition-colors ${lang === code ? 'font-medium underline underline-offset-4' : 'opacity-50 hover:opacity-100'}`

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (!open) return
    const onKey = e => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [open])

  useEffect(() => {
    if (!search) return
    input.current?.focus()
    const onKey = e => { if (e.key === 'Escape') setSearch(false) }
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

  return <>
    <header ref={header} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} className={`z-50 transition-colors duration-500 ease-soft ${shell}`}>
      <div className="header-bar flex w-full h-16 items-center justify-between px-4 sm:h-20 sm:px-5 md:px-8">
        <div className="flex flex-1 items-center gap-4 sm:gap-5">
          <button onClick={() => setOpen(true)} aria-label={t('a11y.menu')} aria-expanded={open}><Icon name="menu" /></button>
          <button onClick={() => setSearch(!search)} aria-label={search ? t('search.close') : t('a11y.search')} aria-expanded={search}><Icon name={search ? 'close' : 'search'} size={18} /></button>
        </div>
        <Link to="/" className="flex flex-col items-center" aria-label={t('a11y.home')}><span className="font-display text-xl tracking-[.28em] uppercase md:text-2xl">N&amp;B</span></Link>
        <div className="flex flex-1 items-center justify-end gap-4 md:gap-6">
          <button onClick={() => setAccount(true)} className="relative" aria-label={t('a11y.account')} aria-expanded={account}><Icon name="user" size={18} />{user && <span className={`absolute -right-1 -top-1 h-1.5 w-1.5 rounded-full ${isAdmin ? 'bg-red-600' : 'bg-champagne'}`} />}</button>
          <Link to="/account/wishlist" aria-label={t('a11y.wishlist')}><Icon name="heart" size={18} /></Link>
          <Link to="/cart" className="flex items-center gap-2" aria-label={t('a11y.cart').replace('{count}', count)}><Icon name="bag" size={18} /><span className="text-[10px]">({count})</span></Link>
        </div>
      </div>
      <div className={`overflow-hidden border-feather bg-white text-obsidian transition-all duration-500 ease-soft ${search ? 'max-h-96 border-t opacity-100' : 'max-h-0 opacity-0'}`}>
        <div className="mx-auto max-w-2xl px-4 py-6 sm:px-5 sm:py-7">
          <form onSubmit={e => { e.preventDefault(); submit(query) }}>
            <label htmlFor="site-search" className="sr-only">{t('a11y.search')}</label>
            <input ref={input} id="site-search" type="search" maxLength={120} value={query} onChange={e => { normalizeSpacingEvent(e); setQuery(e.target.value) }} tabIndex={search ? 0 : -1} placeholder={t('search.placeholder')} className="w-full rounded-full border border-obsidian/25 px-6 py-3 text-sm placeholder:text-stone focus:border-champagne focus:outline-none" />
          </form>
          {history.items.length > 0 && <div className="mt-5 flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
            <span className="text-[10px] tracking-[.2em] text-taupe uppercase">{t('search.recent')}</span>
            {history.items.map(({ q }) => <span key={q} className="flex items-center gap-1 rounded-full border border-feather py-1 pr-2 pl-3 text-xs text-charcoal">
              <button onClick={() => submit(q)} tabIndex={search ? 0 : -1} className="hover:underline underline-offset-4">{q}</button>
              <button onClick={() => history.remove(q)} tabIndex={search ? 0 : -1} aria-label={`${t('search.remove')} ${q}`} className="opacity-50 hover:opacity-100"><Icon name="close" size={10} /></button>
            </span>)}
            <button onClick={history.clear} tabIndex={search ? 0 : -1} className="text-[10px] tracking-[.16em] text-stone uppercase hover:text-obsidian">{t('search.clear')}</button>
          </div>}
          <div className="mt-5 flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
            <span className="text-[10px] tracking-[.2em] text-taupe uppercase">{t('search.popular')}</span>
            {keywords.map(k => k === 'search.k5' ? <DevelopmentButton key={k} tabIndex={search ? 0 : -1} className="text-xs text-charcoal hover:underline underline-offset-4">{t(k)}</DevelopmentButton> : <button key={k} onClick={() => submit(t(k))} tabIndex={search ? 0 : -1} className="text-xs text-charcoal hover:underline underline-offset-4">{t(k)}</button>)}
          </div>
        </div>
      </div>
    </header>

    <div onClick={() => setOpen(false)} className={`fixed inset-0 z-55 bg-obsidian/40 transition-opacity duration-500 ease-soft ${open ? 'opacity-100' : 'pointer-events-none opacity-0'}`} aria-hidden="true" />
    <aside className={`fixed inset-y-0 left-0 z-60 flex w-full flex-col bg-white text-obsidian shadow-2xl transition-transform duration-550 ease-soft will-change-transform sm:w-105 ${open ? 'translate-x-0' : '-translate-x-full'}`} aria-hidden={!open}>
      <button onClick={() => setOpen(false)} className="flex items-center gap-3 px-6 pt-6 pb-8 text-sm sm:px-8 sm:pt-8 sm:pb-10" aria-label={t('nav.close')}><Icon name="close" size={20} />{t('nav.close')}</button>
      <nav className="flex flex-1 flex-col gap-5 overflow-y-auto px-6 sm:gap-6 sm:px-8" aria-label={t('a11y.nav')}>
        {menu.map(([key, href]) => <Link key={key} to={href} onClick={() => setOpen(false)} tabIndex={open ? 0 : -1} className="text-lg hover:underline underline-offset-8">{t(key)}</Link>)}
      </nav>
      <div className="flex items-center gap-1 border-t border-feather px-6 py-5 sm:px-8 sm:py-6" role="group" aria-label={t('a11y.lang')}>
        <span className="mr-3 text-[11px] tracking-[.16em] text-stone uppercase">{t('nav.language')}</span>
        <button onClick={() => setLang('vi')} className={langBtn('vi')} tabIndex={open ? 0 : -1} aria-pressed={lang === 'vi'}>VN</button>
        <span className="opacity-40">/</span>
        <button onClick={() => setLang('en')} className={langBtn('en')} tabIndex={open ? 0 : -1} aria-pressed={lang === 'en'}>EN</button>
      </div>
    </aside>

    <AccountDrawer open={account} onClose={() => setAccount(false)} />
  </>
}
