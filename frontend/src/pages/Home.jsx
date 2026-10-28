import { Link } from 'react-router-dom'
import Hero from '../components/Hero'
import ProductGrid from '../components/ProductGrid'
import { useCatalog } from '../hooks/useCatalog'
import { useLang } from '../i18n'

const WOMAN = '/img/home/24144889-4574-4e08-9cbb-f2b91276276f.jpg'
const MAN = '/img/home/93716292-f67d-436f-9944-76792d2d518a.jpg'
const CAMPAIGN = '/img/home/61d0c12e-9132-428f-8150-aa5521e142f6.jpg'
const LOOKBOOK = '/img/home/e30d6819-39c8-4361-b5c7-8f5e75aecd2d.jpg'

/** Thanh quyền lợi & mã giảm giá hấp dẫn dành cho khách mua hàng */
function CustomerPerks() {
  const { lang } = useLang()
  const vi = lang === 'vi'

  const perks = [
    {
      badge: vi ? 'GIẢM 15%' : '15% OFF',
      title: vi ? 'Mã Giảm Giá Tân Thủ: TET2026' : 'New Member Code: TET2026',
      desc: vi ? 'Giảm ngay 15% cho đơn hàng đầu tiên khi thanh toán.' : 'Save 15% on your first order at checkout.',
      highlight: true,
    },
    {
      badge: vi ? 'FREESHIP' : 'FREE SHIP',
      title: vi ? 'Miễn Phí Vận Chuyển Toàn Quốc' : 'Free Shipping Nationwide',
      desc: vi ? 'Áp dụng cho mọi đơn hàng giá trị từ 399.000đ.' : 'On all eligible orders over 399,000₫.',
      highlight: false,
    },
    {
      badge: vi ? 'THỬ ĐỒ 3D' : '3D TRY-ON',
      title: vi ? 'Thử Đồ Ảo Chuẩn Phom 360°' : 'Smart 3D Virtual Try-On',
      desc: vi ? 'Ướm vừa vặn theo số đo, không lo chọn nhầm size.' : 'Match your body measurements before buying.',
      highlight: false,
    },
    {
      badge: vi ? 'ĐỔI TRẢ 7 NGÀY' : '7 DAYS',
      title: vi ? 'Đổi Hàng Dễ Dàng Tận Nhà' : 'Hassle-Free Exchanges',
      desc: vi ? 'Hỗ trợ đổi size tận nơi hoặc tại cửa hàng N&B.' : 'Exchange sizes easily at our store or doorstep.',
      highlight: false,
    },
  ]

  return (
    <section className="border-y border-line bg-amber-50/50 py-5" aria-label={vi ? 'Ưu đãi khách hàng' : 'Customer promotions'}>
      <div className="shell grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
        {perks.map((p, i) => (
          <div key={i} className={`flex items-start gap-3.5 rounded-xl p-3 ${p.highlight ? 'bg-amber-100/60 border border-amber-300' : 'bg-white border border-line/70'} shadow-xs`}>
            <span className={`shrink-0 rounded-md px-2 py-1 text-micro font-bold tracking-wider ${p.highlight ? 'bg-red-600 text-white animate-pulse' : 'bg-ink text-on-ink'}`}>
              {p.badge}
            </span>
            <div>
              <h3 className="text-body-sm font-bold text-ink leading-snug">{p.title}</h3>
              <p className="mt-0.5 text-micro text-ink-muted leading-relaxed">{p.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

/** Banner khuyến mãi lớn Flash Sale / Mega Deal */
function MegaPromotionBanner() {
  const { lang } = useLang()
  const vi = lang === 'vi'

  return (
    <section className="shell py-8" aria-label={vi ? 'Khuyến mãi đặc biệt' : 'Special sale'}>
      <div className="relative isolate overflow-hidden rounded-3xl bg-linear-to-r from-red-950 via-slate-900 to-ink px-6 py-10 text-white sm:px-12 sm:py-14 border border-red-900/40 shadow-xl">
        <div aria-hidden="true" className="absolute -right-20 -top-20 size-80 rounded-full bg-red-600/20 blur-3xl" />
        <div className="grid items-center gap-8 md:grid-cols-12">
          <div className="md:col-span-8">
            <div className="inline-flex items-center gap-2 rounded-full bg-red-500/20 border border-red-400/40 px-3 py-1 text-micro font-bold uppercase tracking-wider text-red-300">
              🔥 {vi ? 'ƯU ĐÃI KHỦNG THÁNG NÀY — SỐ LƯỢNG CÓ HẠN' : 'EXCLUSIVE MONTHLY OFFER'}
            </div>
            <h2 className="mt-4 font-display text-title sm:text-display leading-tight text-white">
              {vi ? 'GIẢM ĐẾN 30% TẤT CẢ ÁO THUN & SƠ MI' : 'UP TO 30% OFF ALL SHIRTS & TEES'}
            </h2>
            <p className="mt-3 max-w-xl text-body text-white/85">
              {vi
                ? 'Nâng cấp phong cách hàng ngày với chất vải Cotton chải kỹ đanh mịn, chuẩn phom cao cấp. Nhập mã TET2026 giảm thêm 15% cho đơn từ 2 sản phẩm.'
                : 'Elevate your daily rotation with heavyweight combed cotton. Use code TET2026 for an extra 15% off.'}
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-4">
              <Link to="/products" className="button button--light text-body font-bold text-red-950 shadow-lg hover:scale-105 transition-transform">
                {vi ? 'Săn Deal Ngay Bây Giờ →' : 'Shop The Sale →'}
              </Link>
              <Link to="/try-on" className="button button--ghost-light text-body font-medium">
                {vi ? 'Thử 3D Trước Khi Mua' : 'Try On 3D First'}
              </Link>
            </div>
          </div>
          <div className="md:col-span-4 flex justify-center md:justify-end">
            <div className="rounded-2xl border border-white/20 bg-white/10 p-5 text-center backdrop-blur-md max-w-xs w-full shadow-inner">
              <p className="text-micro uppercase tracking-widest text-white/70">{vi ? 'Mã Khuyến Mãi' : 'Promo Code'}</p>
              <p className="mt-1 font-mono text-2xl font-black text-amber-300 tracking-wider">TET2026</p>
              <div className="mt-3 border-t border-white/20 pt-3">
                <span className="inline-block rounded-md bg-emerald-500 px-2 py-0.5 text-micro font-bold text-white">
                  {vi ? 'ĐANG CÓ HIỆU LỰC' : 'ACTIVE NOW'}
                </span>
                <p className="mt-2 text-micro text-white/80">{vi ? 'Giảm 15% toàn bộ giỏ hàng' : '15% discount on full cart'}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/** Danh mục quần áo kèm mức giá hấp dẫn */
function CategoryHighlights() {
  const { lang } = useLang()
  const vi = lang === 'vi'

  const categories = [
    {
      title: vi ? 'Áo Thun Nam & Nữ' : 'T-Shirts & Tees',
      price: vi ? 'Chỉ từ 199.000₫' : 'From 199,000₫',
      tag: vi ? 'BÁN CHẠY NHẤT' : 'BEST SELLER',
      link: '/products?category=m-tshirts',
      image: '/img/clothing/ascolour_5027_classic_pocket_tee_bone/front.jpg',
    },
    {
      title: vi ? 'Áo Sơ Mi Oxford' : 'Oxford Shirts',
      price: vi ? 'Chỉ từ 229.000₫' : 'From 229,000₫',
      tag: vi ? 'CAO CẤP' : 'LUXE WEAVE',
      link: '/products?category=m-shirts',
      image: '/img/clothing/ascolour_5401_oxford_shirt_light_blue/front.jpg',
    },
    {
      title: vi ? 'Quần Dài & Chân Váy' : 'Pants & Skirts',
      price: vi ? 'Chỉ từ 259.000₫' : 'From 259,000₫',
      tag: vi ? 'TÔN DÁNG' : 'FLATTERING',
      link: '/products?category=m-trousers',
      image: '/img/clothing/ascolour_5932_relax_track_pants_black/front.jpg',
    },
    {
      title: vi ? 'Phòng Thử Đồ 3D' : '3D Fitting Room',
      price: vi ? 'Miễn phí 100%' : '100% Complimentary',
      tag: vi ? 'CÔNG NGHỆ MỚI' : 'AI & 3D TECH',
      link: '/try-on',
      image: LOOKBOOK,
      isSpecial: true,
    },
  ]

  return (
    <section className="shell py-8" aria-labelledby="category-highlights-heading">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-4">
        <div>
          <p className="eyebrow text-ink-muted">{vi ? 'Khám phá theo danh mục' : 'Categories'}</p>
          <h2 id="category-highlights-heading" className="mt-1 font-display text-title">
            {vi ? 'Sản Phẩm Thời Trang Nổi Bật' : 'Featured Collections'}
          </h2>
        </div>
        <Link to="/products" className="text-body-sm font-semibold text-ink underline underline-offset-4 hover:text-black">
          {vi ? 'Xem toàn bộ 55 mẫu sản phẩm →' : 'View all 55 styles →'}
        </Link>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4 lg:gap-6">
        {categories.map((c, i) => (
          <Link
            key={i}
            to={c.link}
            className="group relative flex flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-xs transition-transform duration-300 hover:-translate-y-1 hover:shadow-md"
          >
            <div className="relative aspect-4/5 overflow-hidden bg-cream/50">
              <img
                src={c.image}
                alt={c.title}
                className="h-full w-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
                loading="lazy"
              />
              <span className={`absolute left-2.5 top-2.5 rounded-sm px-2 py-0.5 text-micro font-bold tracking-wider ${c.isSpecial ? 'bg-indigo-600 text-white' : 'bg-ink text-on-ink'}`}>
                {c.tag}
              </span>
            </div>
            <div className="p-3.5">
              <h3 className="text-body-sm font-bold text-ink group-hover:underline">{c.title}</h3>
              <p className="mt-1 text-caption font-semibold text-red-700">{c.price}</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}

/** Banner Thử Đồ 3D (Đã tinh chỉnh tập trung vào lợi ích mua sắm của khách) */
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
              {vi ? 'Phòng Thử Đồ 3D Thông Minh' : 'Interactive 3D Virtual Try-On'}
            </div>
            <h2 id="home-tryon-heading" className="mt-5 font-display text-title sm:text-display leading-tight">
              {vi ? 'Mặc thử ngay trên người mẫu 360° — Chuẩn size, không lo đổi trả.' : 'Try before you buy — 360° virtual fit personalized to your size.'}
            </h2>
            <p className="mt-5 max-w-xl text-body text-on-ink/80 leading-relaxed">
              {vi
                ? 'Thử ngay mẫu áo thun túi ngực, sơ mi Oxford và quần suông trên người mẫu ảo 3D. Nhập chiều cao cân nặng để hệ thống tự động kiểm tra độ vừa vặn từng milimet.'
                : 'Preview shirts, tees, and trousers moving in 360 degrees on your personal 3D avatar.'}
            </p>

            <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 max-w-lg">
              <div className="rounded-xl border border-on-ink/10 bg-on-ink/5 p-3.5 backdrop-blur-xs">
                <span className="text-body font-bold text-on-ink">360°</span>
                <p className="mt-0.5 text-micro text-on-ink-muted">{vi ? 'Xoay góc nhìn tự do' : 'Full 360° rotation'}</p>
              </div>
              <div className="rounded-xl border border-on-ink/10 bg-on-ink/5 p-3.5 backdrop-blur-xs">
                <span className="text-body font-bold text-on-ink">100%</span>
                <p className="mt-0.5 text-micro text-on-ink-muted">{vi ? 'Chất vải & phom thật' : 'True-to-life texture'}</p>
              </div>
              <div className="col-span-2 sm:col-span-1 rounded-xl border border-on-ink/10 bg-on-ink/5 p-3.5 backdrop-blur-xs">
                <span className="text-body font-bold text-emerald-400">0đ</span>
                <p className="mt-0.5 text-micro text-on-ink-muted">{vi ? 'Dùng thử miễn phí' : 'Free guest trial'}</p>
              </div>
            </div>

            <div className="mt-10 flex flex-wrap items-center gap-4">
              <Link to="/try-on" className="button button--light text-body font-medium shadow-md">
                {vi ? 'Thử Đồ 3D Ngay (Miễn Phí)' : 'Launch 3D fitting room'}
              </Link>
              <Link to="/account/measurements" className="button button--ghost-light text-body font-medium">
                {vi ? 'Nhập Số Đo Của Bạn' : 'Set your measurements'}
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
              <Link to="/try-on?top=ascolour_5401_oxford_shirt_light_blue" className="mt-2 inline-block text-micro font-semibold text-emerald-300 underline underline-offset-2">
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

  const featured = (products || []).slice(0, 8)

  return (
    <section className="shell py-(--section-y)" aria-labelledby="home-featured-heading">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-6">
        <div>
          <p className="eyebrow text-ink-muted">{vi ? 'Tuyển chọn hot nhất' : 'Trending Now'}</p>
          <h2 id="home-featured-heading" className="mt-2 font-display text-title">
            {vi ? 'Sản Phẩm Đang Được Mua Nhiều' : 'Boutique Best Sellers'}
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

/** Biên tập "Dành cho nữ" */
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

/** Biên tập "Dành cho nam" */
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

/** Đánh giá khách hàng */
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
        ? 'Chất vải thun cotton của AS Colour dày dặn, giặt máy không bị bai xù. Nhập mã giảm 15% được freeship giao hàng hỏa tốc trong ngày.'
        : 'The cotton quality is substantial and soft. Used the 15% promo code and got same-day delivery.',
      item: 'Áo thun Classic Túi Ngực',
    },
    {
      author: 'Tuấn Kiệt',
      location: 'Đà Nẵng',
      rating: 5,
      content: vi
        ? 'Tính năng phối trọn bộ Outfit trên người mẫu 3D rất trực quan. Giúp mình chọn được ngay chiếc áo sơ mi phối hợp với quần suông mà không phải đoán mò.'
        : 'The outfit mix-and-match on the 3D model is brilliant. Saved me tons of guessing.',
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

/** Câu chuyện xưởng may */
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
      <CustomerPerks />
      <MegaPromotionBanner />
      <CategoryHighlights />
      <VirtualTryOnSpotlight />
      <FeaturedProducts />
      <WomenEditorial />
      <MenEditorial />
      <CustomerTestimonials />
      <Atelier />
    </main>
  )
}
