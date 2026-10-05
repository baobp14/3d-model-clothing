import { Link } from 'react-router-dom'
import { useLang } from '../i18n'

export default function Hero() {
  const { t } = useLang()
  return <section className="relative h-[85svh] max-h-[680px] min-h-[360px] overflow-hidden bg-obsidian text-white" aria-labelledby="hero-title">
    <video className="absolute inset-0 h-full w-full object-cover opacity-90" src="/img/intro.mp4" autoPlay loop muted playsInline preload="auto" aria-label={t('hero.video')} />
    <div className="absolute inset-0 bg-gradient-to-b from-obsidian/25 via-obsidian/15 to-obsidian/60" />
    <div className="absolute inset-x-0 bottom-0 flex flex-col items-center px-5 pb-8 text-center sm:pb-10 md:pb-12">
      {/* Dưới sm cho phép xuống dòng: ép một hàng ở máy hẹp thì chữ tràn ngang */}
      <h1 id="hero-title" className="font-display max-w-[92vw] text-balance text-[clamp(1.05rem,4.4vw,2.1rem)] leading-[1.25] tracking-[.06em] uppercase sm:text-[clamp(1.1rem,3.2vw,2.1rem)] sm:leading-[1.15] sm:tracking-[.08em]">{t('hero.title')}</h1>
      <div className="my-5 h-px w-12 bg-champagne sm:my-6" />
      <div className="flex w-full max-w-md flex-col gap-3 sm:w-auto sm:max-w-none sm:flex-row sm:justify-center">
        <Link to="/products" className="button button--sm button--light whitespace-nowrap">{t('hero.cta1')}</Link>
      </div>
    </div>
  </section>
}
