import { Link, NavLink } from 'react-router-dom'
import Drawer, { DrawerHeader } from './ui/Drawer'
import { useLang } from '../i18n'
import { useAuth } from '../hooks/useAuth'
import { categories } from '../data/products'

// Danh mục lấy từ catalog đang bán (data/products.js được sinh từ cùng database với API).
const departments = [['women', '/women/ready-to-wear', 'nav.women'], ['men', '/men/ready-to-wear', 'nav.men']]

export default function MenuDrawer({ open, onClose }) {
  const { lang, setLang, t } = useLang()
  const { user, isAdmin } = useAuth()
  const item = 'flex min-h-11 items-center text-body hover:text-accent'
  const langButton = code => `min-h-11 px-2 text-caption tracking-[.12em] uppercase ${lang === code ? 'font-medium underline underline-offset-4' : 'text-ink-muted hover:text-ink'}`
  return <Drawer id="menu-drawer" open={open} onClose={onClose} side="left" labelledBy="menu-drawer-title" width="sm:w-90">
      <DrawerHeader id="menu-drawer-title" title={t("nav.menu")} onClose={onClose} closeLabel={t("nav.close")} titleClassName="text-lead" />
      <nav aria-label={t('a11y.nav')} className="flex-1 overflow-y-auto px-(--gutter) py-4 sm:px-8">
        <ul>
          {departments.map(([department, href, key]) => <li key={department} className="border-b border-line">
            <details className="group">
              <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between font-display text-lead [&::-webkit-details-marker]:hidden">
                {t(key)}
                <span aria-hidden="true" className="text-base font-light transition-transform duration-(--duration-base) group-open:rotate-45">+</span>
              </summary>
              <ul className="pb-5 pl-1">
                <li><NavLink to={href} end onClick={onClose} className={item}>{t('nav.viewAll')}</NavLink></li>
                {categories.filter(c => c.department === department).map(c =>
                  <li key={c.id}><Link to={`${href}?categories=${c.id}`} onClick={onClose} className={item}>{c[lang]}</Link></li>)}
              </ul>
            </details>
          </li>)}
          <li className="border-b border-line"><Link to="/products?sort=new" onClick={onClose} className="flex min-h-12 items-center font-display text-lead">{t('nav.newIn')}</Link></li>
          <li className="border-b border-line"><NavLink to="/products" end onClick={onClose} className="flex min-h-12 items-center font-display text-lead">{t('nav.all')}</NavLink></li>
        </ul>
      </nav>
      <div className="border-t border-line px-(--gutter) py-5 sm:px-8">
        <ul className="flex flex-wrap gap-x-6">
          {isAdmin
            ? <li><Link to="/admin" onClick={onClose} className={item}>{t('admin.open')}</Link></li>
            : <>
              <li><Link to="/account/orders" onClick={onClose} className={item}>{t('nav.orders')}</Link></li>
              <li><Link to="/account/wishlist" onClick={onClose} className={item}>{t('nav.wishlist')}</Link></li>
              {user && <li><Link to="/account/addresses" onClick={onClose} className={item}>{t('nav.addresses')}</Link></li>}
            </>}
        </ul>
        <div className="mt-4 flex items-center gap-1" role="group" aria-label={t('a11y.lang')}>
          <span className="mr-3 text-caption text-ink-muted">{t('nav.language')}</span>
          <button onClick={() => setLang('vi')} className={langButton('vi')} aria-pressed={lang === 'vi'}>VN</button>
          <span aria-hidden="true" className="text-ink-muted">/</span>
          <button onClick={() => setLang('en')} className={langButton('en')} aria-pressed={lang === 'en'}>EN</button>
        </div>
      </div>
  </Drawer>
}
