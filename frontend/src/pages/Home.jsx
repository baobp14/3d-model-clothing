import { Link } from 'react-router-dom'
import Hero from '../components/Hero'
import Editorial from '../components/Editorial'
import ProductShowcase from '../components/ProductShowcase'
import { useLang } from '../i18n'

export default function Home() {
  const { t } = useLang()
  return <>
    <Hero />
    <div className="ticker">
      <span>{t('ticker.1')}</span><span>{t('ticker.2')}</span>
    </div>
    <Editorial />
    <ProductShowcase />
    <section className="campaign-banner" aria-label={t('campaign.aria')}>
      <img src="/img/home/61d0c12e-9132-428f-8150-aa5521e142f6.jpg" alt={t('campaign.alt')} />
      <div className="campaign-banner__overlay" />
      <div className="campaign-banner__content">
        <p className="eyebrow text-white/70">{t('campaign.eyebrow')}</p>
        <h2 className="display-title mt-4 text-white">{t('campaign.title')}</h2>
        <Link to="/products" className="button button--light mt-8">{t('campaign.cta')}</Link>
      </div>
    </section>
  </>
}
