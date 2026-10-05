import { Link } from 'react-router-dom'
import DevelopmentButton from './DevelopmentButton'
import Icon from './Icon'
import { useLang } from '../i18n'

const columns = [
  ['f.services', 'f.repairs', 'f.personalisation', 'f.giftWrap', 'f.appointment'],
  ['f.clients', 'f.track', 'f.shipping', 'f.profile', 'f.contact'],
  ['f.maison', 'f.story', 'f.sustainability', 'f.careers', 'f.legalPrivacy'],
]
export default function Footer() {
  const { t } = useLang()
  return <footer className="bg-background">
    <div className="shell grid gap-8 border-t border-feather px-4 py-10 sm:grid-cols-2 sm:gap-10 sm:px-5 sm:py-12 md:px-8 lg:grid-cols-4">{columns.map(([title,...links]) => <div key={title}><p className="eyebrow mb-6 text-stone">{t(title)}</p><div className="flex flex-col gap-3">{links.map(x => x === 'f.track' ? <Link key={x} to="/account/orders" className="text-left text-[12px] hover:underline">{t(x)}</Link> : <DevelopmentButton feature={x === 'f.profile' ? '3d' : 'general'} key={x} className="text-left text-[12px] hover:underline">{t(x)}</DevelopmentButton>)}</div></div>)}<div><p className="eyebrow mb-6 text-stone">{t('f.flagships')}</p><div className="space-y-3 text-[12px]"><p>{t('f.location1')}</p><p>{t('f.location2')}</p><p>{t('f.location3')}</p></div><DevelopmentButton feature="general" aria-label="Instagram" className="mt-6 flex h-10 w-10 items-center justify-center border border-feather"><Icon name="instagram" size={16} /></DevelopmentButton></div></div>
    <div className="shell flex flex-col items-center justify-between gap-4 border-t border-feather px-4 py-6 text-center sm:px-5 md:flex-row md:px-8"><p className="font-display text-lg tracking-[.3em] uppercase">N&amp;B</p><p className="text-[10px] tracking-[.15em] text-stone uppercase">{t('f.copyright')}</p><div className="flex gap-6 text-[10px] tracking-[.15em] text-stone uppercase"><DevelopmentButton feature="general">{t('f.legal')}</DevelopmentButton><DevelopmentButton feature="general">{t('f.privacy')}</DevelopmentButton><DevelopmentButton feature="general">{t('f.cookies')}</DevelopmentButton></div></div>
  </footer>
}
