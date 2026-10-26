import { Link } from 'react-router-dom'
import Hero from '../components/Hero'
import { useLang } from '../i18n'

const WOMAN = '/img/home/24144889-4574-4e08-9cbb-f2b91276276f.jpg'
const CAMPAIGN = '/img/home/61d0c12e-9132-428f-8150-aa5521e142f6.jpg'

/** Biên tập "Dành cho nữ": ảnh chân dung + lời dẫn và lối vào danh mục. */
function WomenEditorial() {
  const { t } = useLang()
  // Ảnh gốc dọc 2:3 — cắt thấp lại (giữ phần mặt/khăn) để khối không chiếm cả màn hình
  return <section className="shell grid items-center gap-8 py-(--section-y) md:grid-cols-[5fr_6fr] lg:gap-16" aria-labelledby="home-women">
    <Link to="/women/ready-to-wear" tabIndex={-1} aria-hidden="true" className="group block aspect-[4/5] overflow-hidden bg-cream md:aspect-auto md:h-[28rem] lg:h-[32rem]">
      <img src={WOMAN} alt="" loading="lazy" decoding="async" width="1024" height="1536" className="h-full w-full object-cover object-top transition-transform duration-[900ms] ease-soft motion-safe:group-hover:scale-[1.02]" />
    </Link>
    <div className="max-w-md">
      <p className="eyebrow text-ink-muted">{t('home.forHer')}</p>
      <h2 id="home-women" className="mt-4 font-display text-title">{t('nav.women')}</h2>
      <p className="mt-6 text-body text-ink-muted">{t('plp.intro.women')}</p>
      <Link to="/women/ready-to-wear" className="button button--primary mt-10">{t('nav.viewAll')}</Link>
    </div>
  </section>
}

/** Câu chuyện xưởng may: ảnh bộ sưu tập + lời dẫn. */
function Atelier() {
  const { t } = useLang()
  // Ảnh tràn toàn khối làm nền; lớp phủ đậm dần về phía chữ (phải ở desktop, dưới ở mobile) để chữ đạt tương phản
  return <section className="relative isolate overflow-hidden bg-ink text-on-ink" aria-labelledby="home-atelier">
    <img src={CAMPAIGN} alt={t('campaign.alt')} loading="lazy" decoding="async" width="1536" height="1024" className="absolute inset-0 -z-10 h-full w-full object-cover object-[35%_50%]" />
    <div aria-hidden="true" className="absolute inset-0 -z-10 bg-linear-to-t from-ink/95 via-ink/75 via-55% to-ink/10 lg:bg-linear-to-l lg:from-ink/90 lg:via-ink/70 lg:via-40% lg:to-transparent lg:to-75%" />
    <div className="mx-auto flex min-h-[40rem] max-w-page items-end px-(--gutter) py-(--section-y) lg:min-h-[44rem] lg:items-center lg:justify-end">
      <div className="max-w-md lg:w-5/12 lg:max-w-lg">
        <p className="eyebrow text-on-ink">{t('ed.savoir')}</p>
        <h2 id="home-atelier" className="mt-4 font-display text-title">{t('ed.title')}</h2>
        <p className="mt-6 text-body text-on-ink/85">{t('ed.stepsDesc')}</p>
        <blockquote className="mt-8 border-l border-on-ink-muted/40 pl-5 font-display text-lead">{t('ed.quote')}</blockquote>
        <div className="mt-10"><Link to="/products" className="button button--light">{t('nav.all')}</Link></div>
      </div>
    </div>
  </section>
}

export default function Home() {
  return <main>
    <title>N&amp;B — Thời trang may sẵn tinh giản</title>
    <Hero />
    <WomenEditorial />
    <Atelier />
  </main>
}
