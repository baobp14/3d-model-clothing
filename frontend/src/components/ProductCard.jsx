import { Link, useLocation } from 'react-router-dom'
import WishlistButton from './WishlistButton'
import Price from './Price'
import { useLang } from '../i18n'

/**
 * Thẻ sản phẩm duy nhất cho danh sách, trang chủ, yêu thích.
 * Ảnh → tên → giá → số màu. Ảnh là link phụ (ẩn với trình đọc màn hình) để tên là link chính,
 * nút yêu thích nằm ngoài link (không lồng phần tử tương tác).
 */
export default function ProductCard({ product, wishlist = true, priority = false, heading: Heading = 'h3' }) {
  const { lang, t } = useLang()
  const location = useLocation()
  const state = { returnTo: location.pathname + location.search }
  const name = product[lang]
  const href = `/product/${product.id}`
  const front = product.images[0]
  // Ảnh thứ hai của cùng màu (thường là mặt sau) hiện khi rê chuột
  const second = product.colorImages?.[product.colors[0]]?.[1]
  const image = 'absolute inset-0 h-full w-full object-contain product-image-blend transition duration-(--duration-slow) ease-soft'
  return <article className="group relative">
    <div className="product-image-surface relative aspect-product overflow-hidden">
      <Link to={href} state={state} tabIndex={-1} aria-hidden="true" className="absolute inset-0">
        {front && <img src={front} alt="" loading={priority ? 'eager' : 'lazy'} decoding="async" width="600" height="800"
          className={`${image} motion-safe:group-hover:scale-[1.03] ${second ? 'group-hover:opacity-0' : ''}`} />}
        {second && <img src={second} alt="" loading="lazy" decoding="async" width="600" height="800" className={`${image} opacity-0 group-hover:opacity-100`} />}
      </Link>
      {wishlist && <WishlistButton productId={product.id} className="absolute right-1 top-1 grid size-11 place-items-center text-ink" />}
    </div>
    <div className="pt-3 pr-2">
      {product.isNew && <p className="mb-1.5"><span className="rounded-sm bg-ink px-1.5 py-0.5 text-micro font-semibold text-on-ink">{t('plp.new')}</span></p>}
      <Heading className="-my-1 text-body leading-snug"><Link to={href} state={state} className="line-clamp-2 py-1 hover:underline hover:underline-offset-4">{name}</Link></Heading>
      <p className="mt-1.5 text-body font-semibold"><Price value={product.price} /></p>
      {product.colors.length > 1 && <p className="mt-1 text-caption text-ink-muted">{product.colors.length} {t('plp.colorsCount')}</p>}
    </div>
  </article>
}
