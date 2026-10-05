import { useEffect, useState } from 'react'
import { useListParams } from '../hooks/useListParams'
import Pagination from '../components/Pagination'
import { Link, useLocation } from 'react-router-dom'
import { useWishlist } from '../hooks/useWishlist'
import { usePagedProducts } from '../hooks/usePagedProducts'
import { useLang } from '../i18n'
import WishlistButton from '../components/WishlistButton'
import { formatPrice } from '../data/products'

export default function Wishlist() {
  const { lang } = useLang()
  const vi = lang === 'vi'
  const wishlist = useWishlist()
  const location = useLocation()
  const returnTo = location.pathname + location.search
  const { page, setPage } = useListParams()
  const [revision, setRevision] = useState(0)
  const { products, loading, error, pages, total } = usePagedProducts({ page, limit: 12 }, { endpoint: '/wishlist/products', auth: true, offline: false, refreshKey: `${revision}:${wishlist.owner}:${wishlist.ids.join(',')}` })
  useEffect(() => { if (!loading && page > pages) setPage(pages) }, [loading, page, pages])
  return <main className="shop-shell"><div className="flex justify-between gap-3"><h1 className="display-title text-3xl">{vi ? 'Sản phẩm yêu thích' : 'Wishlist'}</h1><button className="button" disabled={wishlist.loading || wishlist.busy} onClick={() => { wishlist.reload(); setRevision(x => x + 1) }}>{vi ? 'Tải lại' : 'Reload'}</button></div>
    {wishlist.error && <p role="alert" className="mt-5 text-red-700">{vi ? 'Chưa thể xác nhận danh sách yêu thích. Vui lòng tải lại.' : 'Could not confirm your wishlist. Please reload.'}</p>}
    {error && <p role="alert" className="mt-5">{vi ? 'Không tải được sản phẩm yêu thích. Vui lòng thử lại.' : 'Could not load saved products. Please retry.'}</p>}
    {loading || wishlist.loading ? <p role="status" className="mt-8">{vi ? 'Đang tải…' : 'Loading…'}</p> : !wishlist.ids.length && !wishlist.error ? <p className="mt-8">{vi ? 'Chưa có sản phẩm yêu thích. Bấm biểu tượng trái tim trên sản phẩm để lưu.' : 'No saved products. Tap a product’s heart to save it.'}</p> : null}
    <div className="mt-8 grid grid-cols-2 gap-6 lg:grid-cols-4">{products.map(product => <article key={product.id} className="relative"><Link to={`/product/${product.id}`} state={{ returnTo }}><img src={product.images[0]} alt={product[lang]} className="aspect-[3/4] w-full bg-alabaster object-contain" /><h2 className="mt-4 text-sm">{product[lang]}</h2><p className="mt-2 text-sm">{formatPrice(product.price)}</p></Link><WishlistButton productId={product.id} className="absolute right-2 top-2 bg-white p-2" /></article>)}</div>
    {!error && <Pagination page={page} pages={pages} total={total} onPage={setPage} busy={loading || wishlist.busy} />}
    <Link className="button mt-8" to="/products">{vi ? 'Xem sản phẩm' : 'Browse products'}</Link>
  </main>
}
