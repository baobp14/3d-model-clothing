import { Link } from 'react-router-dom'
import Hero from '../components/Hero'
import ProductGrid from '../components/ProductGrid'
import { useCatalog } from '../hooks/useCatalog'
import { useLang } from '../i18n'

const WOMAN = '/img/home/24144889-4574-4e08-9cbb-f2b91276276f.jpg'
const MAN = '/img/home/93716292-f67d-436f-9944-76792d2d518a.jpg'
const CAMPAIGN = '/img/home/61d0c12e-9132-428f-8150-aa5521e142f6.jpg'
const LOOKBOOK = '/img/home/e30d6819-39c8-4361-b5c7-8f5e75aecd2d.jpg'

/** Thanh cam kết giá trị boutique N&B */
function ValuePillars() {
  const { lang } = useLang()
  const vi = lang === 'vi'
  const pillars = [
    {
      icon: (
        <svg className="size-6 text-ink" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
        </svg>
      ),
      title: vi ? 'Phòng Thử Đồ 3D Độc Quyền' : 'Virtual 3D Fitting Room',
      desc: vi ? 'Ướm vừa vặn trên người mẫu 360° theo đúng số đo thực tế.' : 'Preview garments on 360° avatars matching your exact body measurements.',
    },
    {
      icon: (
        <svg className="size-6 text-ink" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
        </svg>
      ),
      title: vi ? 'Đồng Bộ Tồn Kho Real-Time' : 'Real-Time Boutique Stock',
      desc: vi ? 'Quản lý kho 2 lớp, cập nhật tức thời giữa quầy và web.' : 'Dual-state live inventory, preventing overselling across store & web.',
    },
    {
      icon: (
        <svg className="size-6 text-ink" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
        </svg>
      ),
      title: vi ? 'Chất Liệu Tuyển Chọn' : 'Premium Fabric Craft',
      desc: vi ? 'Cotton chải kỹ, Oxford dệt mật độ cao từ AS Colour.' : 'High-density combed cotton & Oxford weave for all-day comfort.',
    },
    {
      icon: (
        <svg className="size-6 text-ink" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
        </svg>
      ),
      title: vi ? 'Đổi Trả 7 Ngày Linh Hoạt' : '7-Day Effortless Returns',
      desc: vi ? 'Đổi size miễn phí tại cửa hàng hoặc thu hồi tận nơi.' : 'Complimentary size exchange at our boutique or door-to-door.',
    },
  ]

  return (
    <section className="border-y border-line bg-cream/40 py-8" aria-label={vi ? 'Cam kết chất lượng' : 'Store benefits'}>
      <div className="shell grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
        {pillars.map((p, i) => (
          <div key={i} className="flex items-start gap-4">
            <div className="grid size-12 shrink-0 place-items-center rounded-xl bg-white shadow-xs">
              {p.icon}
            </div>
            <div>
              <h3 className="text-body font-semibold text-ink">{p.title}</h3>
              <p className="mt-1 text-caption text-ink-muted leading-relaxed">{p.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

/** Banner Spotlight 3D Virtual Try-On */
function VirtualTryOnSpotlight() {
  const { lang } = useLang()
  const vi = lang === 'vi'

  return (
    <section className="shell py-(--section-y)" aria-labelledby="home-tryon-heading">
      <div className="relative isolate overflow-hidden rounded-3xl bg-ink px-6 py-12 text-on-ink sm:px-12 sm:py-16 lg:px-16 lg:py-20">
        <div aria-hidden="true" className="absolute -right-24 -top-24 size-96 rounded-full bg-blue-900/30 blur-3xl pointer-events-none" />
        <div aria-hidden="true" className="absolute -bottom-24 -left-24 size-96 rounded-full bg-indigo-900/20 blur-3xl pointer-events-none" />

        <div className="grid items-center gap-10 lg:grid-cols-12 lg:gap-14">
          <div className="lg:col-span-7">
            <div className="inline-flex items-center gap-2 rounded-full border border-on-ink/15 bg-on-ink/5 px-3 py-1 text-micro tracking-wider uppercase text-on-ink/90">
              <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
              {vi ? 'Công nghệ thử đồ 3D tương tác' : 'Interactive 3D Virtual Try-On'}
            </div>
            <h2 id="home-tryon-heading" className="mt-5 font-display text-title sm:text-display leading-tight">
              {vi ? 'Thử đồ trước khi mua — Chuẩn phom theo vóc dáng của bạn.' : 'Try before you buy — Personalized 3D fit for your body shape.'}
            </h2>
            <p className="mt-5 max-w-xl text-body text-on-ink/80 leading-relaxed">
              {vi
                ? 'Không còn nỗi lo mua nhầm size. Nhập chiều cao, cân nặng và số đo cơ thể để ngắm nhìn áo sơ mi, áo thun và quần suông chuyển động 360 độ trên mannequin ảo trước khi bấm đặt hàng.'
                : 'No more sizing guesswork. Input your height, weight, and measurements to preview shirts, tees, and trousers moving in 360 degrees on your personal 3D avatar.'}
            </p>

            <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 max-w-lg">
              <div className="rounded-xl border border-on-ink/10 bg-on-ink/5 p-3.5 backdrop-blur-xs">
                <span className="text-body font-bold text-on-ink">360°</span>
                <p className="mt-0.5 text-micro text-on-ink-muted">{vi ? 'Xoay góc nhìn tự do' : 'Full 360° rotation'}</p>
              </div>
              <div className="rounded-xl border border-on-ink/10 bg-on-ink/5 p-3.5 backdrop-blur-xs">
                <span className="text-body font-bold text-on-ink">100%</span>
                <p className="mt-0.5 text-micro text-on-ink-muted">{vi ? 'Mô phỏng chất vải thực' : 'True-to-life texture'}</p>
              </div>
              <div className="col-span-2 sm:col-span-1 rounded-xl border border-on-ink/10 bg-on-ink/5 p-3.5 backdrop-blur-xs">
                <span className="text-body font-bold text-emerald-400">0đ</span>
                <p className="mt-0.5 text-micro text-on-ink-muted">{vi ? 'Miễn phí trải nghiệm' : 'Instant free access'}</p>
              </div>
            </div>

            <div className="mt-10 flex flex-wrap items-center gap-4">
              <Link to="/tryon" className="button button--light text-body font-medium shadow-md">
                {vi ? 'Vào phòng thử đồ 3D ngay' : 'Launch 3D fitting room'}
              </Link>
              <Link to="/account/measurements" className="button button--ghost-light text-body font-medium">
                {vi ? 'Cài đặt số đo của bạn' : 'Set your measurements'}
              </Link>
            </div>
          </div>

          <div className="relative aspect-4/3 overflow-hidden rounded-2xl bg-paper/10 lg:col-span-5 lg:aspect-square border border-on-ink/10 shadow-2xl">
            <img
              src={LOOKBOOK}
              alt={vi ? 'Mô phỏng thử đồ thời trang' : 'Fashion tryon simulation'}
              className="h-full w-full object-cover object-center"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-linear-to-t from-ink/90 via-ink/20 to-transparent" />
            <div className="absolute bottom-4 left-4 right-4 rounded-xl border border-white/20 bg-black/50 p-4 backdrop-blur-md">
              <p className="text-caption font-semibold text-white">{vi ? 'Set đồ đề xuất tuần này' : 'Featured Look'}</p>
              <p className="text-micro text-white/80">{vi ? 'Áo sơ mi Oxford + Quần suông Relaxed' : 'Oxford Shirt + Relaxed Trousers'}</p>
              <Link to="/tryon?top=ascolour_5401_oxford_shirt_light_blue" className="mt-2 inline-block text-micro font-semibold text-emerald-300 underline underline-offset-2">
                {vi ? 'Thử ngay mẫu áo này →' : 'Try this shirt now →'}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/** Sản phẩm nổi bật Best Sellers */
function FeaturedProducts() {
  const { lang, t } = useLang()
  const vi = lang === 'vi'
  const { products, loading } = useCatalog()

  // Chọn 4-8 sản phẩm đại diện đa dạng danh mục
  const featured = (products || []).slice(0, 8)

  return (
    <section className="shell py-(--section-y)" aria-labelledby="home-featured-heading">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-6">
        <div>
          <p className="eyebrow text-ink-muted">{vi ? 'Tuyển chọn mùa này' : 'Curated collection'}</p>
          <h2 id="home-featured-heading" className="mt-2 font-display text-title">
            {vi ? 'Thiết Kế Nổi Bật Được Yêu Thích' : 'Boutique Best Sellers'}
          </h2>
        </div>
        <Link to="/products" className="button button--ghost text-body">
          {t('nav.viewAll')} →
        </Link>
      </div>

      <div className="mt-8">
        <ProductGrid products={featured} loading={loading} skeletonCount={4} />
      </div>
    </section>
  )
}

/** Biên tập "Dành cho nữ": ảnh chân dung + lời dẫn và lối vào danh mục */
function WomenEditorial() {
  const { t } = useLang()
  return (
    <section className="shell grid items-center gap-8 py-(--section-y) md:grid-cols-[5fr_6fr] lg:gap-16" aria-labelledby="home-women">
      <Link to="/women/ready-to-wear" tabIndex={-1} aria-hidden="true" className="group block aspect-4/5 overflow-hidden bg-cream md:aspect-auto md:h-[28rem] lg:h-[32rem]">
        <img src={WOMAN} alt="" loading="lazy" decoding="async" width="1024" height="1536" className="h-full w-full object-cover object-top transition-transform duration-[900ms] ease-soft motion-safe:group-hover:scale-[1.02]" />
      </Link>
      <div className="max-w-md">
        <p className="eyebrow text-ink-muted">{t('home.forHer')}</p>
        <h2 id="home-women" className="mt-4 font-display text-title">{t('nav.women')}</h2>
        <p className="mt-6 text-body text-ink-muted">{t('plp.intro.women')}</p>
        <Link to="/women/ready-to-wear" className="button button--primary mt-10">{t('nav.viewAll')}</Link>
      </div>
    </section>
  )
}

/** Biên tập "Dành cho nam": ảnh mẫu nam lịch lãm */
function MenEditorial() {
  const { lang, t } = useLang()
  const vi = lang === 'vi'
  return (
    <section className="shell grid items-center gap-8 py-(--section-y) md:grid-cols-[6fr_5fr] lg:gap-16 border-t border-line" aria-labelledby="home-men">
      <div className="max-w-md order-2 md:order-1">
        <p className="eyebrow text-ink-muted">{t('home.forHim')}</p>
        <h2 id="home-men" className="mt-4 font-display text-title">{t('nav.men')}</h2>
        <p className="mt-6 text-body text-ink-muted">
          {vi
            ? 'Những phom dáng cơ bản hoàn hảo: từ áo sơ mi Oxford đứng form, áo thun chải kỹ đến quần suông ống thẳng. Thiết kế tôn vinh phong thái đĩnh đạc, hiện đại.'
            : 'Enduring essentials: structured Oxford shirts, combed cotton tees, and clean-cut relaxed trousers tailored for modern gentleman ease.'}
        </p>
        <Link to="/men/ready-to-wear" className="button button--primary mt-10">{t('nav.viewAll')}</Link>
      </div>
      <Link to="/men/ready-to-wear" tabIndex={-1} aria-hidden="true" className="group block aspect-4/5 overflow-hidden bg-cream md:aspect-auto md:h-[28rem] lg:h-[32rem] order-1 md:order-2">
        <img src={MAN} alt="" loading="lazy" decoding="async" width="1024" height="1536" className="h-full w-full object-cover object-top transition-transform duration-[900ms] ease-soft motion-safe:group-hover:scale-[1.02]" />
      </Link>
    </section>
  )
}

/** Đánh giá từ khách hàng thực tế (Customer Testimonials) */
function CustomerTestimonials() {
  const { lang } = useLang()
  const vi = lang === 'vi'

  const reviews = [
    {
      author: 'Hoàng Minh',
      location: 'Hà Nội',
      rating: 5,
      content: vi
        ? 'Lần đầu tiên thấy một trang thời trang có tính năng thử đồ 3D mượt như thế này. Mình nhập số đo 1m73 - 68kg hệ thống gợi ý size M mặc vừa in không cần sửa.'
        : 'First time experiencing a 3D fitting room this smooth. Inputted my height and weight, got recommended size M, and the shirt fits flawlessly.',
      item: 'Áo sơ mi Oxford Nam',
    },
    {
      author: 'Phương Linh',
      location: 'TP. Hồ Chí Minh',
      rating: 5,
      content: vi
        ? 'Chất vải thun cotton của AS Colour dày dặn, giặt máy không bị bai xù. Đặt online buổi sáng mà trưa đã nhận được hàng đóng hộp rất chỉnh chu.'
        : 'The AS Colour cotton quality is substantial and soft. Ordered in the morning and received the package by noon in a beautiful boutique gift box.',
      item: 'Áo thun Classic Túi Ngực',
    },
    {
      author: 'Tuấn Kiệt',
      location: 'Đà Nẵng',
      rating: 5,
      content: vi
        ? 'Tính năng phối trọn bộ Outfit trên người mẫu 3D rất trực quan. Giúp mình chọn được ngay chiếc áo khoác phối hợp với quần suông mà không phải đoán mò.'
        : 'The outfit mix-and-match on the 3D model is brilliant. Saved me tons of guessing when pairing a shirt with track pants.',
      item: 'Set đồ phối Minimalist',
    },
  ]

  return (
    <section className="bg-cream/40 py-(--section-y) border-t border-line" aria-labelledby="home-reviews-heading">
      <div className="shell">
        <div className="text-center max-w-xl mx-auto">
          <p className="eyebrow text-ink-muted">{vi ? 'Đánh giá chân thực' : 'Customer Voices'}</p>
          <h2 id="home-reviews-heading" className="mt-2 font-display text-title">
            {vi ? 'Khách Hàng Nói Gì Về N&B Boutique' : 'Loved by Our Community'}
          </h2>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3 lg:gap-8">
          {reviews.map((r, i) => (
            <div key={i} className="flex flex-col justify-between rounded-2xl border border-line bg-white p-6 shadow-xs">
              <div>
                <div className="flex items-center gap-1 text-amber-500">
                  {Array.from({ length: r.rating }).map((_, starIndex) => (
                    <span key={starIndex}>★</span>
                  ))}
                </div>
                <p className="mt-4 text-body text-ink leading-relaxed">“{r.content}”</p>
              </div>
              <div className="mt-6 border-t border-line/60 pt-4">
                <p className="text-body-sm font-semibold text-ink">{r.author}</p>
                <p className="text-micro text-ink-muted">{r.location} · {r.item}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/** Câu chuyện xưởng may: ảnh bộ sưu tập + lời dẫn */
function Atelier() {
  const { t } = useLang()
  return (
    <section className="relative isolate overflow-hidden bg-ink text-on-ink" aria-labelledby="home-atelier">
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
  )
}

export default function Home() {
  return (
    <main>
      <title>N&amp;B — Thời trang may sẵn tinh giản &amp; Phòng thử đồ 3D</title>
      <Hero />
      <ValuePillars />
      <VirtualTryOnSpotlight />
      <FeaturedProducts />
      <WomenEditorial />
      <MenEditorial />
      <CustomerTestimonials />
      <Atelier />
    </main>
  )
}
