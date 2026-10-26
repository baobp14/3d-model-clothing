import { useEffect, useState } from 'react'
import { shopApi } from '../lib/api'
import { useLang } from '../i18n'

export const Stars = ({ value, className = '' }) => <span aria-hidden="true" className={`tracking-wider text-ink ${className}`}>
  {'★'.repeat(Math.round(value))}<span className="text-line-strong">{'★'.repeat(5 - Math.round(value))}</span>
</span>

// Reviews come only from customers whose order with this product was delivered.
export default function ProductReviews({ productId }) {
  const { lang } = useLang()
  const vi = lang === 'vi'
  const [data, setData] = useState(null)
  const [page, setPage] = useState(1)
  const [error, setError] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    setError(false)
    shopApi.request(`/products/${productId}/reviews?page=${page}&limit=5`, { signal: controller.signal })
      .then(result => { if (!controller.signal.aborted) setData(Array.isArray(result?.reviews) ? result : null) })
      .catch(() => { if (!controller.signal.aborted) setError(true) })
    return () => controller.abort()
  }, [productId, page])

  return <section aria-labelledby="reviews-title" className="mt-16 border-t border-line pt-10">
    <h2 id="reviews-title" className="font-display text-heading">{vi ? 'Đánh giá sản phẩm' : 'Reviews'}</h2>
    {error && <p className="mt-4 text-body-sm text-ink-muted">{vi ? 'Chưa tải được đánh giá.' : 'Reviews could not be loaded.'}</p>}
    {data && <>
      <p className="mt-4 flex items-center gap-3 text-body">
        {data.count > 0
          ? <><Stars value={data.average} className="text-lead" /><span className="font-medium">{data.average}/5</span><span className="text-ink-muted">· {data.count} {vi ? 'đánh giá' : data.count === 1 ? 'review' : 'reviews'}</span></>
          : <span className="text-ink-muted">{vi ? 'Chưa có đánh giá. Khách đã nhận hàng có thể đánh giá trong mục Đơn hàng của tôi.' : 'No reviews yet. Customers can review delivered items from My orders.'}</span>}
      </p>
      <ul className="mt-6 space-y-6">{data.reviews.map(review => <li key={review.id} className="border-b border-line pb-6">
        <p className="flex flex-wrap items-center gap-3 text-body-sm"><Stars value={review.rating} /><span className="font-medium">{review.author || (vi ? 'Khách hàng' : 'Customer')}</span>
          <span className="text-ink-muted">{new Date(review.created_at).toLocaleDateString(vi ? 'vi-VN' : 'en-US', { timeZone: 'Asia/Ho_Chi_Minh' })}</span></p>
        {review.comment && <p className="mt-2 whitespace-pre-wrap text-body">{review.comment}</p>}
      </li>)}</ul>
      {data.pages > 1 && <nav aria-label={vi ? 'Phân trang đánh giá' : 'Review pages'} className="mt-6 flex items-center gap-4">
        <button type="button" className="button" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>{vi ? 'Trước' : 'Previous'}</button>
        <span className="text-body-sm">{page}/{data.pages}</span>
        <button type="button" className="button" disabled={page >= data.pages} onClick={() => setPage(p => p + 1)}>{vi ? 'Sau' : 'Next'}</button>
      </nav>}
    </>}
  </section>
}
