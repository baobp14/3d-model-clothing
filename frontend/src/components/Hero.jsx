import { Link } from 'react-router-dom'
import { useLang } from '../i18n'
import Film from './Film'

const FILM = '/img/intro.mp4'

/** Hero tràn viền: phim giới thiệu (có nút dừng), tiêu đề serif viết thường, hai lối vào mua sắm. */
export default function Hero() {
  const { t } = useLang()
  return <section className="relative isolate overflow-hidden bg-ink text-on-ink" aria-labelledby="hero-title">
    <div className="relative aspect-portrait max-h-[calc(100svh-2.25rem)] w-full md:aspect-auto md:h-[min(88svh,52rem)] md:min-h-[32rem]">
      <Film src={FILM} label={t('hero.video')} controls={false} />
      {/* Lớp phủ đậm ở nửa dưới: video có cảnh vải sáng màu nên chữ trắng cần nền tối để đạt WCAG (đã đo ở nhiều khung hình) */}
      <div aria-hidden="true" className="absolute inset-0 bg-linear-to-t from-ink/85 via-ink/55 via-40% to-transparent to-75% max-md:from-ink/90 max-md:via-ink/70 max-md:via-50% max-md:to-90%" />
      {/* Dải tối phía trên để chữ trắng của header trong suốt luôn đủ tương phản trên vùng trời sáng */}
      <div aria-hidden="true" className="absolute inset-x-0 top-0 h-44 bg-linear-to-b from-ink/75 via-ink/40 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 px-(--gutter) pb-10 text-center md:pb-16">
        <p className="eyebrow">{t('home.heroEyebrow')}</p>
        <h1 id="hero-title" className="mx-auto mt-4 max-w-3xl font-display text-display lg:max-w-none lg:whitespace-nowrap">{t('hero.title')}</h1>
        <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
          <Link to="/women/ready-to-wear" className="button button--light">{t('nav.women')}</Link>
          <Link to="/men/ready-to-wear" className="button button--ghost-light">{t('nav.men')}</Link>
        </div>
      </div>
    </div>
  </section>
}
