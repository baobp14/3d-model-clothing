import { useEffect, useState } from 'react'
import { useListParams } from '../hooks/useListParams'
import Pagination from '../components/Pagination'
import { Link } from 'react-router-dom'
import { useWishlist } from '../hooks/useWishlist'
import { usePagedProducts } from '../hooks/usePagedProducts'
import { useLang } from '../i18n'
import ProductGrid from '../components/ProductGrid'
import EmptyState from '../components/ui/EmptyState'

export default function Wishlist() {
  const { lang } = useLang()
  const vi = lang === 'vi'
  const wishlist = useWishlist()
  const { page, setPage } = useListParams()
  const [revision, setRevision] = useState(0)
  const { products, loading, error, pages, total } = usePagedProducts({ page, limit: 12 }, { endpoint: '/wishlist/products', auth: true, offline: false, refreshKey: `${revision}:${wishlist.owner}:${wishlist.ids.join(',')}` })
  useEffect(() => { if (!loading && page > pages) setPage(pages) }, [loading, page, pages])
  const empty = !loading && !wishlist.loading && !wishlist.ids.length && !wishlist.error
  return <main className="shop-shell">
    <title>{`${vi ? 'Sản phẩm yêu thích' : 'Wishlist'} – N&B`}</title>
    <div className="mb-(--stack-heading) flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-title">{vi ? 'Sản phẩm yêu thích' : 'Wishlist'}</h1>
        {!loading && !empty && <p className="mt-2 text-body-sm text-ink-muted">{total} {vi ? 'sản phẩm' : 'items'}</p>}
      </div>
      <button className="min-h-11 text-body-sm text-link disabled:opacity-40" disabled={wishlist.loading || wishlist.busy} onClick={() => { wishlist.reload(); setRevision(x => x + 1) }}>{vi ? 'Tải lại' : 'Reload'}</button>
    </div>
    {wishlist.error && <p role="alert" className="mb-6 border border-danger/30 bg-danger-soft px-4 py-3 text-body-sm text-danger">{vi ? 'Chưa thể xác nhận danh sách yêu thích. Vui lòng tải lại.' : 'Could not confirm your wishlist. Please reload.'}</p>}
    {error && <p role="alert" className="mb-6 border border-danger/30 bg-danger-soft px-4 py-3 text-body-sm text-danger">{vi ? 'Không tải được sản phẩm yêu thích. Vui lòng thử lại.' : 'Could not load saved products. Please retry.'}</p>}
    {empty
      ? <EmptyState title={vi ? 'Chưa có sản phẩm yêu thích' : 'No saved products yet'} description={vi ? 'Bấm biểu tượng trái tim trên sản phẩm để lưu.' : 'Tap a product’s heart to save it.'}>
          <Link className="button button--primary" to="/products">{vi ? 'Xem sản phẩm' : 'Browse products'}</Link>
        </EmptyState>
      : <ProductGrid products={products} loading={loading || wishlist.loading} skeletonCount={4} label={vi ? 'Đang tải…' : 'Loading…'} />}
    {!error && !empty && <Pagination page={page} pages={pages} total={total} onPage={setPage} busy={loading || wishlist.busy} />}
  </main>
}
