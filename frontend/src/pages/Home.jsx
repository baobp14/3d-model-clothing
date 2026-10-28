import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Hero from '../components/Hero'
import ProductGrid from '../components/ProductGrid'
import Price from '../components/Price'
import { useAuth } from '../hooks/useAuth'
import { useCatalog } from '../hooks/useCatalog'
import { useMeasurements } from '../hooks/useMeasurements'
import { useWishlist } from '../hooks/useWishlist'
import { useLang } from '../i18n'
import { shopApi } from '../lib/api'
import { tryOnLink } from '../tryon/links'

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

/** Đề xuất sản phẩm thông minh cá nhân hóa theo gu khách hàng (dựa trên lịch sử mua, đã xem, wishlist, số đo) */
function PersonalizedTasteRecommendations() {
  const { lang } = useLang()
  const vi = lang === 'vi'
  const { user } = useAuth()
  const { wishlist } = useWishlist()
  const { measurements } = useMeasurements()
  const { products, loading } = useCatalog()

  const [orders, setOrders] = useState([])
  const [viewedIds, setViewedIds] = useState([])
  const [activeTaste, setActiveTaste] = useState('auto') // 'auto' | 'minimal' | 'smart-casual' | 'casual'

  // 1. Tải lịch sử mua hàng khi đã đăng nhập
  useEffect(() => {
    if (!user) {
      setOrders([])
      return
    }
    let live = true
    shopApi.request('/orders?limit=10', { auth: true })
      .then(data => {
        if (live && data?.orders) setOrders(data.orders)
      })
      .catch(() => {})
    return () => { live = false }
  }, [user])

  // 2. Tải danh sách sản phẩm vừa xem từ localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem('nb_viewed_products')
      if (raw) setViewedIds(JSON.parse(raw))
    } catch {}
  }, [])

  // Phân tích "Hồ sơ gu thẩm mỹ" của khách hàng
  const boughtItems = useMemo(() => orders.flatMap(o => o.items || []), [orders])
  const boughtProductIds = useMemo(() => new Set(boughtItems.map(i => i.product_id)), [boughtItems])
  const boughtSampleName = boughtItems[0]?.product_name || null

  const wishlistSet = useMemo(() => new Set(wishlist || []), [wishlist])
  const viewedSet = useMemo(() => new Set(viewedIds || []), [viewedIds])

  // Tính toán đề xuất
  const recommendations = useMemo(() => {
    if (!products || products.length === 0) return { list: [], sourceNote: '' }

    // Tập hợp các sản phẩm khách đã tương tác
    const interacted = products.filter(p => boughtProductIds.has(p.id) || wishlistSet.has(p.id) || viewedSet.has(p.id))

    // Phân tích danh mục và giới tính ưu chuộng
    let topCount = 0
    let bottomCount = 0
    let preferredDepartment = measurements?.gender === 'female' ? 'women' : measurements?.gender === 'male' ? 'men' : null

    interacted.forEach(p => {
      if (p.category?.includes('tshirt') || p.category?.includes('shirt')) topCount++
      if (p.category?.includes('trouser') || p.category?.includes('skirt')) bottomCount++
      if (p.department) preferredDepartment = p.department
    })

    // Xác định nguồn đề xuất (để hiển thị lời dẫn cá nhân hóa)
    let sourceNote = ''
    if (boughtItems.length > 0) {
      sourceNote = vi
        ? `Được gợi ý riêng từ lịch sử đơn hàng của bạn${boughtSampleName ? ` (đã chọn: ${boughtSampleName})` : ''}`
        : `Personalized from your purchase history${boughtSampleName ? ` (includes: ${boughtSampleName})` : ''}`
    } else if (interacted.length > 0) {
      sourceNote = vi
        ? 'Dựa trên các thiết kế bạn quan tâm và phong cách bạn vừa xem'
        : 'Curated based on styles you recently explored'
    } else {
      sourceNote = vi
        ? 'Tuyển chọn các thiết kế chuẩn phom, dễ phối hợp hằng ngày'
        : 'Signature versatile essentials tailored for effortless styling'
    }

    // Lọc và chấm điểm từng sản phẩm trong catalog
    const scored = products
      .filter(p => !p.archived)
      .map(p => {
        let score = 0
        let reasonVi = ''
        let reasonEn = ''

        const isTop = p.category?.includes('tshirt') || p.category?.includes('shirt')
        const isBottom = p.category?.includes('trouser') || p.category?.includes('skirt')

        // 1. Phối set đối ứng (Ngoại suy: Đã mua/xem áo -> ưu tiên gợi ý quần/váy phối cùng và ngược lại)
        if (topCount > bottomCount && isBottom) {
          score += 10
          reasonVi = 'Gợi ý phối set chuẩn cùng áo bạn quan tâm'
          reasonEn = 'Pairs seamlessly with your selected tops'
        } else if (bottomCount > 0 && isTop) {
          score += 10
          reasonVi = 'Phối hoàn hảo cùng phom quần bạn thích'
          reasonEn = 'Complements your preferred trousers'
        } else if (interacted.some(item => item.category === p.category)) {
          score += 7
          reasonVi = 'Cùng dòng phom dáng bạn ưa chuộng'
          reasonEn = 'Matches your favorite silhouette'
        }

        // 2. Khớp giới tính/department
        if (preferredDepartment && p.department === preferredDepartment) {
          score += 4
        }

        // 3. Khớp gu thủ công (khi bấm tab bộ lọc gu)
        if (activeTaste === 'minimal') {
          // Các màu trung tính đanh mịn
          const hasNeutral = p.colors?.some(c => ['black', 'white', 'bone', 'ecru', 'grey_marle'].includes(c))
          if (hasNeutral) {
            score += 8
            if (!reasonVi) {
              reasonVi = 'Tone màu tối giản & đanh mịn kinh điển'
              reasonEn = 'Classic neutral minimalist tone'
            }
          }
        } else if (activeTaste === 'smart-casual') {
          // Áo sơ mi Oxford hoặc quần suông
          if (p.category?.includes('shirt') || p.category?.includes('trouser')) {
            score += 8
            if (!reasonVi) {
              reasonVi = 'Lịch lãm, chuẩn phom công sở & dạo phố'
              reasonEn = 'Refined modern smart-casual staple'
            }
          }
        } else if (activeTaste === 'casual') {
          // Áo thun
          if (p.category?.includes('tshirt')) {
            score += 8
            if (!reasonVi) {
              reasonVi = 'Thoải mái, phóng khoáng hằng ngày'
              reasonEn = 'Effortless relaxed everyday essential'
            }
          }
        }

        // Món đã mua rồi thì hạ điểm để ưu tiên khám phá món mới
        if (boughtProductIds.has(p.id)) {
          score -= 6
        }

        if (!reasonVi) {
          reasonVi = 'Thiết kế chủ đạo được ưa chuộng'
          reasonEn = 'Boutique core essential'
        }

        return { product: p, score, reasonVi, reasonEn }
      })

    // Sắp xếp theo điểm giảm dần và lấy top 4
    scored.sort((a, b) => b.score - a.score)
    return { list: scored.slice(0, 4), sourceNote }
  }, [products, boughtItems, boughtProductIds, wishlistSet, viewedSet, measurements, activeTaste, vi, boughtSampleName])

  return (
    <section className="shell py-(--section-y)" aria-labelledby="personal-recommendations-heading">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-4">
        <div>
          <div className="flex items-center gap-2">
            <p className="eyebrow text-ink-muted">
              {vi ? 'Gợi ý cá nhân hóa' : 'Personalized for you'}
            </p>
            {user && (
              <span className="rounded-full bg-cream px-2 py-0.5 text-micro font-medium text-ink-muted border border-line">
                {vi ? 'Theo gu của bạn' : 'Based on your taste'}
              </span>
            )}
          </div>
          <h2 id="personal-recommendations-heading" className="mt-2 font-display text-title">
            {vi ? 'Đề Xuất Theo Gu Của Bạn' : 'Curated For Your Style'}
          </h2>
          <p className="mt-1 text-micro text-ink-muted">
            {recommendations.sourceNote}
          </p>
        </div>

        {/* Nút lọc gu thẩm mỹ nhanh */}
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={vi ? 'Chọn gu thẩm mỹ' : 'Choose style'}>
          {[
            { id: 'auto', labelVi: 'Tự động theo gu', labelEn: 'Auto match' },
            { id: 'minimal', labelVi: 'Tối giản', labelEn: 'Minimalist' },
            { id: 'smart-casual', labelVi: 'Lịch lãm', labelEn: 'Smart Casual' },
            { id: 'casual', labelVi: 'Hằng ngày', labelEn: 'Casual' },
          ].map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTaste(t.id)}
              className={`min-h-8 px-3 text-caption transition-colors ${
                activeTaste === t.id
                  ? 'border border-ink bg-ink text-on-ink font-medium'
                  : 'border border-line bg-transparent text-ink-muted hover:border-ink hover:text-ink'
              }`}
            >
              {vi ? t.labelVi : t.labelEn}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4 lg:gap-6">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="aspect-4/5 bg-cream" />
              <div className="mt-3 h-4 w-3/4 bg-cream" />
              <div className="mt-1 h-3 w-1/2 bg-cream" />
            </div>
          ))
        ) : (
          recommendations.list?.map(({ product, reasonVi, reasonEn }) => {
            const front = product.images?.[0]
            const tryOn = tryOnLink(product.category, front)
            return (
              <div key={product.id} className="group flex flex-col justify-between">
                <Link to={`/product/${product.id}`} className="block">
                  <div className="aspect-4/5 overflow-hidden bg-cream product-image-surface relative">
                    <img
                      src={front}
                      alt={product[lang]}
                      className="h-full w-full object-contain product-image-blend transition-transform duration-[700ms] ease-soft group-hover:scale-[1.03]"
                      loading="lazy"
                    />
                    {tryOn && (
                      <span className="absolute left-2 top-2 rounded bg-paper/90 px-1.5 py-0.5 text-micro font-medium text-ink shadow-xs backdrop-blur-xs">
                        ✦ 3D
                      </span>
                    )}
                  </div>
                  <div className="mt-3">
                    <h3 className="font-display text-body font-semibold text-ink group-hover:underline underline-offset-4 line-clamp-1">
                      {product[lang]}
                    </h3>
                    <p className="mt-0.5 text-body-sm font-semibold text-ink">
                      <Price value={product.price} />
                    </p>
                    <p className="mt-1 text-micro text-ink-muted">
                      ✦ {vi ? reasonVi : reasonEn}
                    </p>
                  </div>
                </Link>

                <div className="mt-3 flex items-center gap-2">
                  <Link
                    to={`/product/${product.id}`}
                    className="button button--sm flex-1 text-micro"
                  >
                    {vi ? 'Xem chi tiết' : 'Details'}
                  </Link>
                  {tryOn && (
                    <Link
                      to={tryOn}
                      className="button button--sm text-micro px-2 border-line hover:border-ink"
                      title={vi ? 'Mặc thử trên người mẫu 3D' : 'Try on in 3D'}
                    >
                      {vi ? 'Thử 3D' : '3D'}
                    </Link>
                  )}
                </div>
              </div>
            )
          })
        )}
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
      <PersonalizedTasteRecommendations />
      <VirtualTryOnSpotlight />
      <FeaturedProducts />
      <WomenEditorial />
      <MenEditorial />
      <CustomerTestimonials />
      <Atelier />
    </main>
  )
}
