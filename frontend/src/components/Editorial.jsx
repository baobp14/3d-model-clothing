import Icon from './Icon'
import { useLang } from '../i18n'

export default function Editorial() {
  const { t } = useLang()
  return <section id="collection" className="section-shell bg-background">
    <div className="mb-8 sm:mb-10"><h2 className="display-title">{t('ed.title')}</h2></div>
    <div className="grid gap-4 sm:gap-6 lg:grid-cols-12"><article className="image-zoom relative h-[360px] bg-alabaster sm:h-[480px] lg:col-span-7 lg:h-[560px]"><img className="h-full w-full object-cover" src="/img/home/24144889-4574-4e08-9cbb-f2b91276276f.jpg" alt={t('ed.alt1')} /><div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-obsidian/70 p-7 pt-24 text-white md:p-10"><p className="eyebrow text-white/70">{t('ed.look')}</p><h3 className="font-display mt-2 text-2xl">{t('ed.trench')}</h3></div></article>
      <div className="flex flex-col gap-4 sm:gap-6 lg:col-span-5"><article className="image-zoom relative h-[260px] bg-alabaster sm:h-[340px] lg:h-[330px]"><img className="h-full w-full object-cover" src="/img/home/93716292-f67d-436f-9944-76792d2d518a.jpg" alt={t('ed.alt2')} /><div className="absolute inset-x-5 bottom-5 flex flex-wrap items-end justify-between gap-3 text-white"><div><p className="eyebrow text-white/80">{t('ed.objet')}</p><h3 className="font-display mt-1 text-xl">{t('ed.hardware')}</h3></div></div></article>
        <blockquote className="flex flex-1 flex-col justify-center border border-feather bg-alabaster p-6 sm:p-7 md:p-8"><Icon name="quote" size={28} /><p className="font-display mt-4 text-[18px] leading-relaxed italic text-charcoal sm:text-[20px]">{t('ed.quote')}</p><footer className="eyebrow mt-5 flex items-center gap-4 text-stone"><span className="h-px w-10 bg-champagne" />{t('ed.quoteBy')}</footer></blockquote></div>
    </div>
    <div className="mt-4 grid gap-4 sm:mt-6 sm:gap-6 lg:grid-cols-12"><article className="flex min-h-[280px] flex-col justify-between border border-feather p-6 sm:min-h-[320px] sm:p-7 lg:col-span-4 lg:p-8"><p className="eyebrow text-taupe">{t('ed.savoir')}</p><div><h3 className="font-display text-2xl leading-snug">{t('ed.steps')}</h3><p className="mt-4 text-sm leading-7 text-stone">{t('ed.stepsDesc')}</p></div></article><article className="image-zoom relative h-[260px] sm:h-[340px] lg:h-[320px] lg:col-span-8"><img className="h-full w-full object-cover" src="/img/home/e30d6819-39c8-4361-b5c7-8f5e75aecd2d.jpg" alt={t('ed.alt3')} /></article></div>
  </section>
}
