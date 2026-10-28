import { Link } from 'react-router-dom'
import Hero from '../components/Hero'
import ProductGrid from '../components/ProductGrid'
import { useCatalog } from '../hooks/useCatalog'
import { useLang } from '../i18n'

const WOMAN = '/img/home/24144889-4574-4e08-9cbb-f2b91276276f.jpg'
const MAN = '/img/home/93716292-f67d-436f-9944-76792d2d518a.jpg'
const CAMPAIGN = '/img/home/61d0c12e-9132-428f-8150-aa5521e142f6.jpg'
const LOOKBOOK = '/img/home/e30d6819-39c8-4361-b5c7-8f5e75aecd2d.jpg'

/** Dải thông tin dịch vụ & quyền lợi mua sắm theo phong cách tinh giản */
function ServiceStrip() {
  const { lang } = useLang()
  const vi = lang === 'vi'

  const items = [
    {
      title: vi ? 'Ưu đãi thành viên mới' : 'Welcome offer',
      desc: vi ? 'Nhập mã TET2026 giảm 15% đơn đầu tiên' : 'Use code TET2026 for 15% off',
    },
    {
      title: vi ? 'Giao hàng tiêu chuẩn' : 'Complimentary shipping',
      desc: vi ? 'Miễn phí đơn từ 399.000₫ toàn quốc' : 'Free delivery on orders over 399,000₫',
    },
    {
      title: vi ? 'Phòng thử đồ 3D' : '3D Virtual fitting',
      desc: vi ? 'Ướm phom theo số đo thực tế 360°' : '360° fit simulation tailored to your size',
    },
    {
      title: vi ? 'Đổi trả linh hoạt' : '7-Day returns',
      desc: vi ? 'Hỗ trợ đổi size tận nơi trong 7 ngày' : 'Effortless doorstep size exchanges',
    },
  ]

  return (
    <section className="border-y border-line bg-cream/60 py-6" aria-label={vi ? 'Dịch vụ & Ưu đãi' : 'Services & Offers'}>
      <div className="shell grid grid-cols-2 gap-y-6 gap-x-4 md:grid-cols-4 lg:gap-8">
        {items.map((item, i) => (
          <div key={i} className="text-center sm:text-left">
            <p className="font-display text-body font-semibold text-ink">{item.title}</p>
            <p className="mt-1 text-micro text-ink-muted leading-relaxed">{item.desc}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

/** Banner quảng bá chiến dịch ưu đãi theo phong cách editorial */
function SeasonalPromotion() {
  const { lang } = useLang()
  const vi = lang === 'vi'

  return (
    <section className="shell py-(--section-y)" aria-labelledby="home-promotion">
      <div className="relative isolate overflow-hidden bg-ink text-on-ink md:grid md:grid-cols-12 min-h-[26rem] items-center">
        <img
          src={CAMPAIGN}
          alt=""
          loading="lazy"
          className="absolute inset-0 -z-10 h-full w-full object-cover object-[60%_35%] opacity-40 md:opacity-50"
        />
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-linear-to-r from-ink via-ink/90 to-transparent" />

        <div className="p-8 sm:p-12 md:p-16 md:col-span-8 lg:col-span-7">
          <p className="eyebrow text-on-ink-muted">{vi ? 'Ưu đãi bộ sưu tập' : 'Seasonal selection'}</p>
          <h2 id="home-promotion" className="mt-3 font-display text-title sm:text-display text-on-ink leading-tight">
            {vi ? 'Giảm đến 30% áo thun & sơ mi' : 'Up to 30% off shirts & tees'}
          </h2>
          <p className="mt-4 max-w-lg text-body text-on-ink/80 leading-relaxed">
            {vi
              ? 'Chất liệu cotton chải kỹ và đường may tỉ mỉ từ xưởng may N&B. Nhập mã TET2026 để giảm thêm 15% cho đơn hàng của bạn.'
              : 'Enduring essentials cut from premium combed cotton. Apply code TET2026 at checkout for an extra 15% off.'}
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link to="/products" className="button button--light">
              {vi ? 'Khám phá bộ sưu tập' : 'Explore collection'}
            </Link>
            <Link to="/try-on" className="button button--ghost-light">
              {vi ? 'Thử đồ 3D' : '3D fitting room'}
            </Link>
          </div>
        </div>

        <div className="hidden md:flex md:col-span-4 lg:col-span-5 justify-end p-8 pr-12">
          <div className="border border-on-ink/20 bg-ink/60 p-6 text-center backdrop-blur-sm max-w-xs w-full">
            <p className="eyebrow text-on-ink-muted">{vi ? 'Mã ưu đãi' : 'Promo code'}</p>
            <p className="mt-2 font-display text-2xl tracking-widest text-on-ink font-semibold">TET2026</p>
            <p className="mt-2 border-t border-on-ink/15 pt-2 text-micro text-on-ink-muted">
              {vi ? 'Giảm 15% toàn bộ giỏ hàng' : '15% off your entire order'}
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

/** Danh mục sản phẩm chủ đạo */
function CategoryHighlights() {
  const { lang } = useLang()
  const vi = lang === 'vi'

  const categories = [
    {
      title: vi ? 'Áo thun' : 'T-Shirts',
      subtitle: vi ? 'Từ 199.000₫' : 'From 199,000₫',
      link: '/products?category=m-tshirts',
      image: '/img/clothing/ascolour_5027_classic_pocket_tee_bone/front.jpg',
    },
    {
      title: vi ? 'Áo sơ mi' : 'Oxford Shirts',
      subtitle: vi ? 'Từ 229.000₫' : 'From 229,000₫',
      link: '/products?category=m-shirts',
      image: '/img/clothing/ascolour_5401_oxford_shirt_light_blue/front.jpg',
    },
    {
      title: vi ? 'Quần & Chân váy' : 'Trousers',
      subtitle: vi ? 'Từ 259.000₫' : 'From 259,000₫',
      link: '/products?category=m-trousers',
      image: '/img/clothing/ascolour_5932_relax_track_pants_black/front.jpg',
    },
    {
      title: vi ? 'Phòng thử đồ 3D' : '3D Fitting',
      subtitle: vi ? 'Trải nghiệm trực quan' : 'Interactive avatar',
      link: '/try-on',
      image: LOOKBOOK,
    },
  ]

  return (
    <section className="shell py-(--section-y)" aria-labelledby="category-highlights-heading">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-4">
        <div>
          <p className="eyebrow text-ink-muted">{vi ? 'Danh mục' : 'Categories'}</p>
          <h2 id="category-highlights-heading" className="mt-2 font-display text-title">
            {vi ? 'Thiết kế chủ đạo' : 'Core Collections'}
          </h2>
        </div>
        <Link to="/products" className="text-body-sm text-ink text-link">
          {vi ? 'Xem tất cả sản phẩm' : 'View all'}
        </Link>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4 lg:gap-6">
        {categories.map((c, i) => (
          <Link
            key={i}
            to={c.link}
            className="group block"
          >
            <div className="aspect-4/5 overflow-hidden bg-cream product-image-surface">
              <img
                src={c.image}
                alt={c.title}
                className="h-full w-full object-cover object-top transition-transform duration-[700ms] ease-soft group-hover:scale-[1.03]"
                loading="lazy"
              />
            </div>
            <div className="mt-3">
              <h3 className="font-display text-body font-semibold text-ink group-hover:underline underline-offset-4">{c.title}</h3>
              <p className="mt-0.5 text-micro text-ink-muted">{c.subtitle}</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}

/** Giới thiệu phòng thử đồ 3D */
function VirtualTryOnSpotlight() {
  const { lang } = useLang()
  const vi = lang === 'vi'

  return (
    <section className="shell py-(--section-y)" aria-labelledby="home-tryon-heading">
      <div className="grid items-center gap-10 md:grid-cols-12 lg:gap-16 border border-line bg-cream/40 p-8 sm:p-12 lg:p-16">
        <div className="md:col-span-7">
          <p className="eyebrow text-ink-muted">{vi ? 'Công nghệ phòng thử đồ' : 'Virtual fitting room'}</p>
          <h2 id="home-tryon-heading" className="mt-3 font-display text-title sm:text-display leading-tight text-ink">
            {vi ? 'Mặc thử trên người mẫu 360° theo đúng số đo' : 'Experience 360° virtual fitting tailored to your fit'}
          </h2>
          <p className="mt-4 max-w-xl text-body text-ink-muted leading-relaxed">
            {vi
              ? 'Xoay góc nhìn toàn diện, thử các mẫu áo sơ mi, áo thun và quần suông để cảm nhận độ rũ vải và phom dáng trước khi quyết định.'
              : 'Rotate 360 degrees, inspect drape and proportions across our tops and trousers before buying.'}
          </p>

          <div className="mt-8 grid grid-cols-3 gap-6 max-w-md border-t border-line pt-6">
            <div>
              <p className="font-display text-2xl font-semibold text-ink">360°</p>
              <p className="mt-1 text-micro text-ink-muted">{vi ? 'Xoay góc nhìn' : 'Full rotation'}</p>
            </div>
            <div>
              <p className="font-display text-2xl font-semibold text-ink">0đ</p>
              <p className="mt-1 text-micro text-ink-muted">{vi ? 'Dùng thử trải nghiệm' : 'Guest trial'}</p>
            </div>
            <div>
              <p className="font-display text-2xl font-semibold text-ink">1:1</p>
              <p className="mt-1 text-micro text-ink-muted">{vi ? 'Mô phỏng phom thật' : 'True-to-size'}</p>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link to="/try-on" className="button button--primary">
              {vi ? 'Bắt đầu thử đồ' : 'Launch fitting room'}
            </Link>
            <Link to="/account/measurements" className="button">
              {vi ? 'Cập nhật số đo' : 'Set measurements'}
            </Link>
          </div>
        </div>

        <div className="md:col-span-5">
          <div className="aspect-4/5 overflow-hidden bg-cream product-image-surface border border-line">
            <img
              src={LOOKBOOK}
              alt=""
              className="h-full w-full object-cover object-center"
              loading="lazy"
            />
          </div>
        </div>
      </div>
    </section>
  )
}

/** Sản phẩm nổi bật */
function FeaturedProducts() {
  const { lang, t } = useLang()
  const vi = lang === 'vi'
  const { products, loading } = useCatalog()

  const featured = (products || []).slice(0, 8)

  return (
    <section className="shell py-(--section-y) border-t border-line" aria-labelledby="home-featured-heading">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-4">
        <div>
          <p className="eyebrow text-ink-muted">{vi ? 'Tuyển chọn' : 'Curated'}</p>
          <h2 id="home-featured-heading" className="mt-2 font-display text-title">
            {vi ? 'Sản phẩm nổi bật' : 'Featured Pieces'}
          </h2>
        </div>
        <Link to="/products" className="text-body-sm text-ink text-link">
          {t('nav.viewAll')}
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
    <section className="shell grid items-center gap-8 py-(--section-y) md:grid-cols-[5fr_6fr] lg:gap-16 border-t border-line" aria-labelledby="home-women">
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

/** Ý kiến khách hàng */
function CustomerTestimonials() {
  const { lang } = useLang()
  const vi = lang === 'vi'

  const reviews = [
    {
      author: 'Hoàng Minh',
      location: 'Hà Nội',
      content: vi
        ? 'Phòng thử đồ 3D rất trực quan, nhập chiều cao cân nặng là hệ thống gợi ý size vừa vặn, mặc lên đúng form.'
        : 'The 3D fitting room is intuitive and accurate. Recommended size M fits perfectly as expected.',
      item: 'Áo sơ mi Oxford',
    },
    {
      author: 'Phương Linh',
      location: 'TP. Hồ Chí Minh',
      content: vi
        ? 'Chất vải thun cotton dày dặn, cầm chắc tay và đường may chỉn chu. Giao hàng nhanh và đóng gói cẩn thận.'
        : 'The cotton fabric is substantial and soft. Prompt delivery and tasteful packaging.',
      item: 'Áo thun Pocket Tee',
    },
    {
      author: 'Tuấn Kiệt',
      location: 'Đà Nẵng',
      content: vi
        ? 'Phối cả set áo và quần trực tiếp trên người mẫu giúp mình dễ hình dung tổng thể phong cách trước khi đặt.'
        : 'Previewing top and bottom pairings together made choosing outfits completely effortless.',
      item: 'Set Minimalist',
    },
  ]

  return (
    <section className="shell py-(--section-y) border-t border-line" aria-labelledby="home-reviews-heading">
      <div className="max-w-md">
        <p className="eyebrow text-ink-muted">{vi ? 'Ý kiến khách hàng' : 'Customer feedback'}</p>
        <h2 id="home-reviews-heading" className="mt-2 font-display text-title">
          {vi ? 'Trải nghiệm mua sắm' : 'Client Notes'}
        </h2>
      </div>

      <div className="mt-10 grid grid-cols-1 gap-8 md:grid-cols-3 lg:gap-12">
        {reviews.map((r, i) => (
          <div key={i} className="flex flex-col justify-between border-l border-line pl-6">
            <p className="text-body text-ink/90 leading-relaxed">“{r.content}”</p>
            <div className="mt-6">
              <p className="font-display text-body font-semibold text-ink">{r.author}</p>
              <p className="text-micro text-ink-muted">{r.location} · {r.item}</p>
            </div>
          </div>
        ))}
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
      <ServiceStrip />
      <SeasonalPromotion />
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
