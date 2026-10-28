import { Link } from 'react-router-dom'
import { useLang } from '../i18n'

// Chỉ liên kết tới trang có thật (audit H7). Mục chưa có trang thì không hiển thị.
const columns = [
  ['nav.shop', [['nav.women', '/women/ready-to-wear'], ['nav.men', '/men/ready-to-wear'], ['nav.newIn', '/products?sort=new'], ['nav.all', '/products'], ['nav.tryOn', '/try-on']]],
  ['f.help', [['f.track', '/account/orders'], ['nav.addresses', '/account/addresses'], ['nav.wishlist', '/account/wishlist'], ['nav.measurements', '/account/measurements']]],
  ['f.legalCol', [['f.terms', '/terms'], ['f.privacyPolicy', '/privacy']]],
]

function Links({ links, t }) {
  return <ul className="space-y-1">
    {links.map(([key, href]) => <li key={key}><Link to={href} className="inline-flex min-h-10 items-center text-body-sm hover:text-accent">{t(key)}</Link></li>)}
  </ul>
}

export default function Footer() {
  const { lang, setLang, t } = useLang()
  const langButton = code => `min-h-11 px-2 text-caption tracking-[.12em] uppercase ${lang === code ? 'font-medium underline underline-offset-4' : 'text-ink-muted hover:text-ink'}`
  return <footer className="mt-auto border-t border-line bg-paper">
    <div className="mx-auto grid max-w-page gap-x-8 px-(--gutter) py-12 md:grid-cols-2 md:gap-y-10 lg:grid-cols-4 lg:py-16">
      <div className="pb-8 md:pb-0">
        <p className="font-display text-[1.625rem] tracking-[.18em]">N&amp;B</p>
        <p className="mt-4 max-w-xs text-body-sm text-ink-muted">{t('f.about')}</p>
        <p className="mt-6 text-caption text-ink-muted">{t('f.flagships')}: {t('f.location1')} · {t('f.location3')} · {t('f.location2')}</p>
      </div>
      {columns.map(([title, links]) => <nav key={title} aria-label={t(title)}>
        {/* Mobile: thu gọn thành accordion; từ md trở lên hiện đủ */}
        <details className="group border-t border-line md:hidden">
          <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between eyebrow [&::-webkit-details-marker]:hidden">
            {t(title)}<span aria-hidden="true" className="text-lg font-light transition-transform group-open:rotate-45">+</span>
          </summary>
          <div className="pb-5"><Links links={links} t={t} /></div>
        </details>
        <div className="hidden md:block">
          <p className="eyebrow mb-4 text-ink-muted">{t(title)}</p>
          <Links links={links} t={t} />
        </div>
      </nav>)}
    </div>
    <div className="border-t border-line">
      <div className="mx-auto flex max-w-page flex-col items-center justify-between gap-2 px-(--gutter) py-5 md:flex-row">
        <p className="text-caption text-ink-muted">{t('f.copyright')}</p>
        <div className="flex items-center gap-1" role="group" aria-label={t('a11y.lang')}>
          <button onClick={() => setLang('vi')} className={langButton('vi')} aria-pressed={lang === 'vi'}>VN</button>
          <span aria-hidden="true" className="text-ink-muted">/</span>
          <button onClick={() => setLang('en')} className={langButton('en')} aria-pressed={lang === 'en'}>EN</button>
        </div>
      </div>
    </div>
  </footer>
}
