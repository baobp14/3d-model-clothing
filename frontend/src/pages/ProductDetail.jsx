import WishlistButton from '../components/WishlistButton'
import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { canShop, loginPath } from '../lib/customerSession'
import { useProduct } from '../hooks/useProduct'
import { useCart } from '../hooks/useCart'
import { useLang } from '../i18n'
import Price from '../components/Price'
import ProductDescription from '../components/ProductDescription'
import { AccordionItem } from '../components/ui/Accordion'
import { Skeleton } from '../components/ui/Skeleton'
import EmptyState from '../components/ui/EmptyState'
import ProductReviews from '../components/ProductReviews'
import OutfitSuggestions from '../components/OutfitSuggestions'
import SizeChart, { sizeChartFor } from '../components/SizeChart'
import { fromSaved } from '@/lib/tryon/brandSizes'
import { shopApi } from '../lib/api'
import { tryOnLink } from '../tryon/links'
import { recommendSize } from '../lib/sizeRecommendation'
import { useMeasurements } from '../hooks/useMeasurements'

export const departmentPath = d => ({ men: '/men/ready-to-wear', women: '/women/ready-to-wear', bags: '/bags', watches: '/watches' }[d] || '/')

export default function ProductDetail() {
  const { id } = useParams()
  const { product, colors, loading } = useProduct(id)
  const { lang, t } = useLang()
  if (loading) return <main className="shop-shell" role="status" aria-busy="true">
    <span className="sr-only">{lang === 'vi' ? 'Đang tải sản phẩm…' : 'Loading product…'}</span>
    <div className="grid gap-10 lg:grid-cols-12"><Skeleton className="aspect-product lg:col-span-7" /><div className="lg:col-span-5"><Skeleton className="h-8 w-3/4" /><Skeleton className="mt-4 h-5 w-1/3" /><Skeleton className="mt-10 h-12" /></div></div>
  </main>
  if (!product) return <main className="shop-shell">
    <title>{`${lang === 'vi' ? 'Không tìm thấy sản phẩm' : 'Product not found'} – N&B`}</title>
    <EmptyState as="h1" title={lang === 'vi' ? 'Không tìm thấy sản phẩm' : 'Product not found'}>
      <Link className="button button--primary" to="/products">{t('nav.all')}</Link>
      <Link className="button" to="/">{t('plp.home')}</Link>
    </EmptyState>
  </main>
  return <Detail key={id} product={product} colors={colors} />
}

function Detail({ product, colors }) {
  const { lang, t } = useLang()
  const vi = lang === 'vi'
  const { add, ready, pending } = useCart()
  const { user, loading: authLoading, recovery } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const sizeGroup = useRef(null)
  const returnTo = /^\/(products|search|men\/ready-to-wear|women\/ready-to-wear|bags|watches|account\/(wishlist|orders)|admin\/orders)(?:\?|$)/.test(location.state?.returnTo || '') ? location.state.returnTo : null
  const saved = location.state?.shoppingSelection?.productId === product.id ? location.state.shoppingSelection : null
  const [color, setColor] = useState(product.colors.includes(saved?.color) ? saved.color : product.colors[0] || '')
  const [size, setSize] = useState(product.sizes.includes(saved?.size) ? saved.size : '')
  const [quantity, setQuantity] = useState(Number.isInteger(saved?.quantity) ? Math.max(1, Math.min(99, saved.quantity)) : 1)
  const [message, setMessage] = useState('')
  const [sizeError, setSizeError] = useState(false)
  const [added, setAdded] = useState(false)
  const [imageIndex, setImageIndex] = useState(0)
  useEffect(() => { setImageIndex(0) }, [color])
  useEffect(() => {
    if (!product?.id) return
    try {
      const raw = localStorage.getItem('nb_viewed_products')
      const list = raw ? JSON.parse(raw) : []
      const next = [product.id, ...list.filter(id => id !== product.id)].slice(0, 16)
      localStorage.setItem('nb_viewed_products', JSON.stringify(next))
    } catch {}
  }, [product?.id])
  const stockFor = (c, s) => product.variants ? (product.variants.find(row => row.color === c && row.size === s)?.stock ?? 0) : product.stock
  const selectedStock = stockFor(color, size)
  useEffect(() => { if (selectedStock > 0) setQuantity(current => Math.min(current, selectedStock, 99)) }, [selectedStock])
  const gallery = product.colorImages?.[color] || []
  const image = gallery[imageIndex] || product.images[product.colors.indexOf(color)] || product.images[0]
  const [savedChart, setSavedChart] = useState(undefined)
  useEffect(() => {
    let live = true
    shopApi.request(`/products/${product.id}/size-chart`).then(data => { if (live) setSavedChart(data.chart) }).catch(() => { if (live) setSavedChart(null) })
    return () => { live = false }
  }, [product.id])
  // A chart saved in admin wins over the built-in brand lookup.
  const sizeChart = fromSaved(savedChart) || sizeChartFor(gallery[0] || image)
  const { measurements } = useMeasurements()
  const recommendation = recommendSize({
    measurements,
    sizeChart,
    category: product.category,
    availableSizes: product.sizes,
  })
  const recommendedSize = recommendation?.recommendedSize
  const tryOnBase = tryOnLink(product.category, gallery[0] || image)
  const targetSize = size || recommendedSize
  const tryOn = tryOnBase
    ? `${tryOnBase}${targetSize ? `&size=${encodeURIComponent(targetSize)}` : ''}`
    : null
  const colorName = c => colors.find(x => x.id === c)?.[lang] || product.colorNames?.[c]?.[lang] || c
  const shopper = canShop(user, authLoading, recovery)
  const needsSize = product.sizes.length > 0 && !size
  // Chưa chọn size: vẫn cho chọn số lượng (sẽ được giới hạn lại theo tồn kho khi chọn size)
  const qtyLocked = !needsSize && selectedStock === 0
  const maxQuantity = needsSize ? 99 : Math.max(1, Math.min(99, selectedStock ?? 0))
  const choose = fn => value => { fn(value); setMessage(''); setSizeError(false); setAdded(false) }

  function submit(e) {
    e.preventDefault()
    if (product.archived) return
    if (!shopper) {
      navigate(loginPath(location.pathname), { state: { ...location.state, shoppingSelection: { productId: product.id, color, size, quantity } } })
      return
    }
    // Không khóa nút khi chưa chọn size: báo lỗi cạnh nhóm size và đưa focus tới đó (WD-FORM, WCAG 3.3.1)
    if (needsSize) { setSizeError(true); setMessage(''); sizeGroup.current?.querySelector('button')?.focus(); return }
    if (selectedStock == null || selectedStock < quantity) { setMessage(vi ? 'Lựa chọn này chưa có tồn kho hoặc không đủ số lượng.' : 'Selected variant inventory is unavailable or insufficient.'); return }
    if (!add(product, color, size, quantity)) { setMessage(vi ? 'Số lượng lựa chọn này trong giỏ vượt tồn kho.' : 'This variant’s bag quantity exceeds its available stock.'); return }
    setAdded(true)
    setMessage(vi ? 'Đã thêm vào giỏ hàng.' : 'Added to your bag.')
  }

  const stockText = product.variants && needsSize ? (vi ? 'Chọn kích cỡ để xem tồn kho.' : 'Select a size to check stock.')
    : selectedStock == null ? (vi ? 'Chưa có thông tin tồn kho' : 'Inventory unavailable')
    : selectedStock === 0 ? (vi ? 'Lựa chọn này hết hàng' : 'This option is out of stock')
    : (vi ? `Còn ${selectedStock} sản phẩm` : `${selectedStock} in stock`)
  const blocked = product.archived || !!pending || authLoading || (shopper && !ready) || (!needsSize && (selectedStock == null || selectedStock === 0))

  return <main className="shop-shell">
    <title>{`${product[lang]} – N&B`}</title>
    <div className="mb-6 flex flex-wrap items-center gap-x-6 gap-y-2">
      {returnTo && <Link to={returnTo} className="inline-flex min-h-11 items-center text-body-sm text-link">{vi ? '← Quay lại danh sách' : '← Back to list'}</Link>}
      <nav aria-label="Breadcrumb"><ol className="flex flex-wrap items-center gap-2 text-caption text-ink-muted">
        <li><Link to="/" className="inline-flex min-h-6 items-center hover:text-ink">{t('plp.home')}</Link></li><li aria-hidden="true">/</li>
        <li><Link to={departmentPath(product.department)} className="inline-flex min-h-6 items-center hover:text-ink">{t(`nav.${product.department}`)}</Link></li><li aria-hidden="true">/</li>
        <li aria-current="page" className="line-clamp-1 text-ink">{product[lang]}</li>
      </ol></nav>
    </div>

    <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-12 xl:gap-16">
      {/* Gallery: ảnh chính + ảnh chi tiết của màu đang chọn (dọc bên trái ở desktop, hàng ngang ở mobile) */}
      <div className="min-w-0 lg:col-span-7 lg:grid lg:grid-cols-[4.5rem_1fr] lg:items-start lg:gap-4">
        <div className="product-image-surface aspect-product lg:order-2">
          <img src={image} alt={product[lang]} fetchPriority="high" width="900" height="1200" className="h-full w-full object-contain product-image-blend" />
        </div>
        {gallery.length > 1 && <ul className="scroll-rail mt-3 flex gap-2 overflow-x-auto lg:order-1 lg:mt-0 lg:flex-col lg:overflow-visible" aria-label={vi ? 'Ảnh chi tiết của màu đã chọn' : 'Details of the selected color'}>
          {gallery.map((src, index) => <li key={src} className="shrink-0">
            <button type="button" aria-label={`${vi ? 'Xem ảnh' : 'View image'} ${index + 1}`} aria-pressed={imageIndex === index} onClick={() => setImageIndex(index)}
              className={`product-image-surface block aspect-product w-16 border lg:w-full ${imageIndex === index ? 'border-ink' : 'border-transparent hover:border-line-strong'}`}>
              <img src={src} alt="" loading="lazy" className="h-full w-full object-contain product-image-blend" />
            </button>
          </li>)}
        </ul>}
      </div>

      <form onSubmit={submit} className="min-w-0 lg:col-span-5">
        <div className="lg:sticky lg:top-[calc(var(--header-h)+2rem)]">
          <p className="eyebrow text-ink-muted">N&B · {product.id}</p>
          <h1 className="mt-3 font-display text-title">{product[lang]}</h1>
          <p className="mt-4 text-title-sm font-semibold"><Price value={product.price} /></p>

          {product.colors.length > 0 && <fieldset className="mt-8">
            <legend className="mb-3 text-body-sm">{t('plp.color')}: <span className="font-medium">{colorName(color)}</span></legend>
            <div className="flex flex-wrap gap-2">
              {product.colors.map((c, i) => <button type="button" key={c} onClick={() => choose(setColor)(c)} aria-label={colorName(c)} aria-pressed={color === c}
                className={`product-image-surface relative aspect-product w-14 border ${color === c ? 'border-ink ring-1 ring-ink ring-offset-2' : 'border-line-strong/40 hover:border-ink'}`}>
                {product.images[i] || product.images[0]
                  ? <img src={product.images[i] || product.images[0]} alt="" className="h-full w-full object-contain product-image-blend" />
                  : <span aria-hidden="true" className="absolute inset-3 rounded-full" style={{ background: colors.find(x => x.id === c)?.hex }} />}
              </button>)}
            </div>
          </fieldset>}

          {product.sizes.length > 0 && <fieldset className="mt-8" aria-describedby={sizeError ? 'size-error' : undefined}>
            <legend className="mb-3 text-body-sm">{t('plp.size')}{size && <>: <span className="font-medium">{size}</span></>}</legend>
            <div ref={sizeGroup} className="flex flex-wrap gap-2">
              {product.sizes.map(s => {
                const soldOut = product.variants && stockFor(color, s) === 0
                const isRec = s === recommendedSize
                return <button type="button" key={s} onClick={() => choose(setSize)(s)} aria-pressed={size === s}
                  className={`relative h-12 min-w-12 border px-3 text-body-sm transition-colors ${size === s ? 'border-ink bg-ink text-on-ink' : sizeError ? 'border-danger' : isRec ? 'border-ink ring-1 ring-ink font-semibold' : 'border-line-strong hover:border-ink'} ${soldOut && size !== s ? 'text-ink-muted line-through' : ''}`}>
                  {s}
                  {isRec && (
                    <span className="pointer-events-none absolute -top-2.5 -right-2 z-10 whitespace-nowrap rounded bg-ink px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-on-ink shadow-xs">
                      {t('pdp.recommended')}
                    </span>
                  )}
                  {soldOut && <span className="sr-only">{vi ? 'hết hàng' : 'out of stock'}</span>}
                </button>
              })}
            </div>
            {recommendation ? (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-caption text-ink-muted">
                <span>
                  ✓ <span className="font-medium text-ink">{vi ? 'Đề xuất size ' : 'Recommended size '}{recommendedSize}</span>: {vi ? recommendation.reasonVi : recommendation.reasonEn}
                </span>
                <Link to="/account/measurements" className="text-link hover:underline">
                  {vi ? 'Sửa số đo' : 'Edit measurements'}
                </Link>
              </div>
            ) : user ? (
              <div className="mt-3 text-caption text-ink-muted">
                <Link to="/account/measurements" className="text-link hover:underline">
                  {vi ? '💡 Nhập số đo cá nhân để nhận đề xuất size chuẩn xác' : '💡 Enter your measurements for size recommendation'}
                </Link>
              </div>
            ) : null}
            {sizeError && <p id="size-error" role="alert" className="mt-3 text-body-sm text-danger">{vi ? 'Vui lòng chọn kích cỡ.' : 'Please select a size.'}</p>}
          </fieldset>}

          <div className="mt-8 flex items-center gap-4">
            <label htmlFor="pdp-quantity" className="text-body-sm">{vi ? 'Số lượng' : 'Quantity'}</label>
            <div className="flex items-center border border-line-strong">
              <button type="button" onClick={() => setQuantity(q => Math.max(1, q - 1))} disabled={quantity <= 1 || qtyLocked} aria-label={vi ? 'Giảm số lượng' : 'Decrease quantity'} className="grid size-11 place-items-center text-lg disabled:opacity-30">−</button>
              <input id="pdp-quantity" type="number" inputMode="numeric" min="1" max={maxQuantity} disabled={qtyLocked} required value={quantity}
                onChange={e => setQuantity(Math.max(1, Math.min(99, Number(e.target.value) || 1)))}
                className="h-11 w-12 bg-transparent text-center text-body tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none" />
              <button type="button" onClick={() => setQuantity(q => Math.min(maxQuantity, q + 1))} disabled={quantity >= maxQuantity || qtyLocked} aria-label={vi ? 'Tăng số lượng' : 'Increase quantity'} className="grid size-11 place-items-center text-lg disabled:opacity-30">+</button>
            </div>
          </div>
          <p className="mt-3 text-body-sm text-ink-muted" aria-live="polite">{stockText}</p>

          {/* Dưới lg: thanh mua cố định ở đáy ngay từ khi mở trang (sticky không bám được vì cột thông tin nằm dưới ảnh).
              Nút vẫn nằm trong form nên việc gửi form không đổi. Desktop: nằm trong cột thông tin sticky. */}
          <div data-buy-bar className="fixed inset-x-0 bottom-0 z-(--z-sticky) border-t border-line bg-paper/95 px-(--gutter) py-3 backdrop-blur lg:static lg:mt-6 lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
            <div className="flex items-center gap-2">
              <p aria-hidden="true" className="mr-1 shrink-0 text-body-sm font-medium tabular-nums lg:hidden"><Price value={product.price} /></p>
              <button disabled={blocked} className="button button--primary flex-1 disabled:cursor-not-allowed">{product.archived ? (vi ? 'Sản phẩm thuộc bộ dữ liệu cũ' : 'Product from the previous collection') : shopper ? (vi ? 'Thêm vào giỏ hàng' : 'Add to bag') : (vi ? 'Đăng nhập để thêm vào giỏ' : 'Sign in to add to bag')}</button>
              <WishlistButton productId={product.id} className="grid size-12 shrink-0 place-items-center border border-ink" />
            </div>
          </div>
          <p role="status" className={`text-body-sm ${message ? 'mt-4' : ''} ${added ? 'text-success' : ''}`}>{message}</p>
          {tryOn && <Link to={tryOn} className="button mt-3 w-full border-accent text-accent">{vi ? '✦ Mặc thử 3D trên người mẫu' : '✦ Try on a 3D model'}</Link>}
          {added && <Link to="/cart" className="button mt-3 w-full">{vi ? 'Xem giỏ hàng' : 'View bag'}</Link>}
          {pending && <p className="mt-4 border border-warning/30 bg-warning-soft px-4 py-3 text-body-sm text-warning"><Link to="/checkout" className="underline">{vi ? 'Có đơn đang chờ xác nhận. Kiểm tra lại đơn trước khi thêm sản phẩm.' : 'An order is awaiting confirmation. Check it before adding products.'}</Link></p>}

          <div className="mt-10 border-t border-line">
            <AccordionItem title={t('pdp.description')} defaultOpen><ProductDescription product={product} productColors={colors} /></AccordionItem>
            {sizeChart && <AccordionItem title={vi ? 'Bảng size' : 'Size chart'}><SizeChart chart={sizeChart} /></AccordionItem>}
            <AccordionItem title={t('pdp.delivery')}>{t('pdp.deliveryText')}</AccordionItem>
          </div>
        </div>
      </form>
    </div>
    <OutfitSuggestions product={product} color={color} />
    <ProductReviews productId={product.id} />
  </main>
}
