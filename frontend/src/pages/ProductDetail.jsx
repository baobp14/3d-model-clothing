import WishlistButton from '../components/WishlistButton'
import DevelopmentButton from '../components/DevelopmentButton'
import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { canShop, loginPath } from '../lib/customerSession'
import { useProduct } from '../hooks/useProduct'
import { useCart } from '../hooks/useCart'
import { useLang } from '../i18n'
import { formatPrice } from '../data/products'
import ProductDescription from '../components/ProductDescription'

export const departmentPath = d => ({ men: '/men/ready-to-wear', women: '/women/ready-to-wear', bags: '/bags', watches: '/watches' }[d] || '/')

export default function ProductDetail() {
  const { id } = useParams()
  const { product, colors, loading } = useProduct(id)
  const { lang, t } = useLang()
  if (loading) return <main className="shop-shell" aria-busy="true">{lang === 'vi' ? 'Đang tải sản phẩm…' : 'Loading product…'}</main>
  if (!product) return <main className="shop-shell"><h1 className="display-title text-3xl">{lang === 'vi' ? 'Không tìm thấy sản phẩm' : 'Product not found'}</h1><Link className="button mt-8" to="/">{t('plp.home')}</Link></main>
  return <Detail key={id} product={product} colors={colors} />
}

function Detail({ product, colors }) {
  const { lang, t } = useLang()
  const vi = lang === 'vi'
  const { add, ready, pending } = useCart()
  const { user, loading: authLoading, recovery } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const returnTo = /^\/(products|search|men\/ready-to-wear|women\/ready-to-wear|bags|watches|account\/(wishlist|orders)|admin\/orders)(?:\?|$)/.test(location.state?.returnTo || '') ? location.state.returnTo : null
  const saved = location.state?.shoppingSelection?.productId === product.id ? location.state.shoppingSelection : null
  const [color, setColor] = useState(product.colors.includes(saved?.color) ? saved.color : product.colors[0] || '')
  const [size, setSize] = useState(product.sizes.includes(saved?.size) ? saved.size : '')
  const [quantity, setQuantity] = useState(Number.isInteger(saved?.quantity) ? Math.max(1, Math.min(99, saved.quantity)) : 1)
  const [message, setMessage] = useState('')
  const [added, setAdded] = useState(false)
  const [imageIndex, setImageIndex] = useState(0)
  useEffect(() => { setImageIndex(0) }, [color])
  const selectedStock = product.variants ? (product.variants.find(row => row.color === color && row.size === size)?.stock ?? 0) : product.stock
  useEffect(() => { if (selectedStock > 0) setQuantity(current => Math.min(current, selectedStock, 99)) }, [selectedStock])
  const gallery = product.colorImages?.[color] || []
  const image = gallery[imageIndex] || product.images[product.colors.indexOf(color)] || product.images[0]
  const choose = fn => value => { fn(value); setMessage(''); setAdded(false) }
  function submit(e) {
    e.preventDefault()
    if (product.archived) return
    if (!canShop(user, authLoading, recovery)) {
      navigate(loginPath(location.pathname), { state: { ...location.state, shoppingSelection: { productId: product.id, color, size, quantity } } })
      return
    }
    if (product.sizes.length && !size) { setMessage(vi ? 'Vui lòng chọn kích cỡ.' : 'Please select a size.'); return }
    if (selectedStock == null || selectedStock < quantity) { setMessage(vi ? 'Lựa chọn này chưa có tồn kho hoặc không đủ số lượng.' : 'Selected variant inventory is unavailable or insufficient.'); return }
    if (!add(product, color, size, quantity)) { setMessage(vi ? 'Số lượng lựa chọn này trong giỏ vượt tồn kho.' : 'This variant’s bag quantity exceeds its available stock.'); return }
    setAdded(true)
    setMessage(vi ? 'Đã thêm vào giỏ hàng.' : 'Added to your bag.')
  }
  return <main className="shop-shell">
    {returnTo && <Link to={returnTo} className="mb-5 inline-block text-sm underline underline-offset-4">{vi ? '← Quay lại danh sách' : '← Back to list'}</Link>}
    <nav className="mb-8 flex gap-3 text-xs text-stone" aria-label="Breadcrumb"><Link to="/">{t('plp.home')}</Link><span>/</span><Link to={departmentPath(product.department)}>{t(`nav.${product.department}`)}</Link><span>/</span><span>{product[lang]}</span></nav>
    <div className="grid gap-10 lg:grid-cols-2 lg:gap-20">
      <div><div className="product-image-surface aspect-[3/4]"><img src={image} alt={product[lang]} className="h-full w-full object-contain product-image-blend" /></div><div className="mt-4 flex flex-wrap gap-3">{product.colors.map((c, i) => <button key={c} onClick={() => choose(setColor)(c)} aria-label={colors.find(x => x.id === c)?.[lang] || c} aria-pressed={color === c} className={`product-image-surface h-24 w-20 border ${color === c ? 'border-obsidian' : 'border-feather'}`}><img src={product.images[i] || product.images[0]} alt="" className="h-full w-full object-contain product-image-blend" /></button>)}</div>
        {gallery.length > 1 && <div className="mt-5"><p className="mb-3 text-xs text-stone">{vi ? 'Ảnh chi tiết của màu đã chọn' : 'Details of the selected color'}</p><div className="flex flex-wrap gap-3">{gallery.map((src, index) => <button type="button" key={src} aria-label={`${vi ? 'Xem ảnh' : 'View image'} ${index + 1}`} aria-pressed={imageIndex === index} onClick={() => setImageIndex(index)} className={`product-image-surface h-24 w-20 border ${imageIndex === index ? 'border-obsidian' : 'border-feather'}`}><img src={src} alt="" loading="lazy" className="h-full w-full object-contain product-image-blend" /></button>)}</div></div>}
      </div>
      <form onSubmit={submit} className="lg:pt-8"><p className="eyebrow text-stone">N&B · {product.id}</p><h1 className="display-title mt-4 text-3xl">{product[lang]}</h1><p className="mt-5 text-lg">{formatPrice(product.price)}</p>
        {product.colors.length > 0 && <fieldset className="mt-8"><legend className="mb-3 text-sm">{t('plp.color')}: {colors.find(c => c.id === color)?.[lang] || color}</legend><div className="flex flex-wrap gap-3">{product.colors.map(c => <button type="button" key={c} onClick={() => choose(setColor)(c)} aria-pressed={color === c} className={`flex items-center gap-2 border px-4 py-3 text-xs ${color === c ? 'border-obsidian' : 'border-feather'}`}><span className="h-4 w-4 rounded-full border border-feather" style={{ background: colors.find(x => x.id === c)?.hex }} />{colors.find(x => x.id === c)?.[lang] || c}</button>)}</div></fieldset>}
        {product.sizes.length > 0 && <fieldset className="mt-6"><legend className="mb-3 text-sm">{t('plp.size')}</legend><div className="flex flex-wrap gap-2">{product.sizes.map(s => <button type="button" key={s} onClick={() => choose(setSize)(s)} aria-pressed={size === s} className={`h-11 min-w-12 border px-3 text-xs ${size === s ? 'border-obsidian bg-obsidian text-white' : 'border-feather'}`}>{s}</button>)}</div></fieldset>}
        <label className="mt-6 flex items-center gap-4 text-sm">{vi ? 'Số lượng' : 'Quantity'} <span aria-hidden="true" className="text-red-700">*</span><input type="number" min="1" max={Math.max(1, Math.min(99, selectedStock ?? 0))} disabled={selectedStock === 0} required value={quantity} onChange={e => setQuantity(Math.max(1, Math.min(99, Number(e.target.value) || 1)))} className="shop-input w-24" /></label>
        <p className="mt-4 text-sm text-stone">{product.variants && product.sizes.length && !size ? (vi ? 'Chọn kích cỡ để xem tồn kho.' : 'Select a size to check stock.') : selectedStock == null ? (vi ? 'Chưa có thông tin tồn kho' : 'Inventory unavailable') : selectedStock === 0 ? (vi ? 'Lựa chọn này hết hàng' : 'This option is out of stock') : (vi ? `Lựa chọn này còn ${selectedStock} sản phẩm` : `${selectedStock} in stock for this option`)}</p>
        <button disabled={product.archived || !!pending || selectedStock == null || selectedStock === 0 || authLoading || (canShop(user, authLoading, recovery) && !ready)} className="button mt-8 w-full bg-obsidian text-white disabled:cursor-wait disabled:opacity-50">{product.archived ? (vi ? 'Sản phẩm thuộc bộ dữ liệu cũ' : 'Product from the previous collection') : canShop(user, authLoading, recovery) ? (vi ? 'Thêm vào giỏ hàng' : 'Add to bag') : (vi ? 'Đăng nhập để thêm vào giỏ' : 'Sign in to add to bag')}</button><p role="status" className="mt-4 text-sm">{message}</p>{added && <Link to="/cart" className="button mt-4 w-full">{vi ? 'Xem giỏ hàng' : 'View bag'}</Link>}
        <p className="mt-4 text-sm text-amber-700">{pending && <Link to="/checkout" className="underline">{vi ? 'Có đơn đang chờ xác nhận. Kiểm tra lại đơn trước khi thêm sản phẩm.' : 'An order is awaiting confirmation. Check it before adding products.'}</Link>}</p><WishlistButton productId={product.id} className="button mr-3" /><DevelopmentButton className="mt-6 block text-center text-xs underline underline-offset-4">{t('plp.tryon')}</DevelopmentButton><p className="mt-8 border-t border-feather pt-6 text-xs leading-6 text-stone">{vi ? 'Miễn phí giao hàng. Tồn kho được kiểm tra khi đặt hàng.' : 'Complimentary delivery. Availability is checked when you place an order.'}</p>
      </form>
    </div>
    <section className="product-description-panel mt-10 border border-feather bg-alabaster p-6 sm:p-8" aria-labelledby="product-description-title">
      <h2 id="product-description-title" className="font-display mb-4 text-2xl text-foreground">{vi ? 'Mô tả sản phẩm' : 'Product description'}</h2>
      <ProductDescription product={product} productColors={colors} className="product-description-content" />
    </section>
  </main>
}
