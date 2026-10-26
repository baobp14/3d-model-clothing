import ProductCard from './ProductCard'
import { Skeleton } from './ui/Skeleton'

const base = 'grid grid-cols-2 gap-x-(--grid-gap-x) gap-y-(--grid-gap-y)'
const defaultColumns = 'md:grid-cols-3 xl:grid-cols-4'

/** Lưới sản phẩm: 2 cột điện thoại · 3 cột tablet/laptop · 4 cột desktop. */
// heading: cấp tiêu đề của tên sản phẩm — h2 khi lưới nằm ngay dưới h1 của trang
export default function ProductGrid({ products, loading = false, skeletonCount = 8, wishlist = true, label, columns = defaultColumns, heading = 'h2' }) {
  const grid = `${base} ${columns}`
  if (loading) return <div className={grid} role="status" aria-busy="true">
    {label && <span className="sr-only">{label}</span>}
    {Array.from({ length: skeletonCount }, (_, i) => <div key={i}><Skeleton className="aspect-product" /><Skeleton className="mt-4 h-3 w-3/4" /><Skeleton className="mt-2 h-3 w-1/3" /></div>)}
  </div>
  return <div className={grid}>
    {products.map((product, index) => <ProductCard key={product.id} product={product} wishlist={wishlist} priority={index < 4} heading={heading} />)}
  </div>
}
