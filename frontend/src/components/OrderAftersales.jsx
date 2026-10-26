import { useState } from 'react'
import { shopApi } from '../lib/api'
import { useLang } from '../i18n'

export const returnWords = {
  vi: { pending: 'Chờ cửa hàng duyệt', approved: 'Đã duyệt, chờ gửi hàng về', rejected: 'Bị từ chối', received: 'Cửa hàng đã nhận hàng trả' },
  en: { pending: 'Awaiting review', approved: 'Approved, send the goods back', rejected: 'Rejected', received: 'Return received' },
}

const errors = {
  NB_REVIEW_EXISTS: ['Bạn đã đánh giá sản phẩm này trong đơn này.', 'You already reviewed this item for this order.'],
  NB_RETURN_EXISTS: ['Đơn này đã có yêu cầu đổi trả.', 'This order already has a return request.'],
  NB_ORDER_NOT_DELIVERED: ['Chỉ đơn đã giao mới được đánh giá hoặc đổi trả.', 'Only delivered orders can be reviewed or returned.'],
  NB_INVALID_INPUT: ['Nội dung chưa hợp lệ. Lý do đổi trả cần ít nhất 5 ký tự.', 'Invalid input. A return reason needs at least 5 characters.'],
}

// Review and return actions for one delivered order in "My orders".
export default function OrderAftersales({ order, reviewed, returnRequest, onChanged }) {
  const { lang } = useLang()
  const vi = lang === 'vi'
  const [open, setOpen] = useState(null) // product_id being reviewed, or 'return'
  const [rating, setRating] = useState(5)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const products = [...new Map(order.items.map(item => [item.product_id, item])).values()]
  const explain = e => (errors[e.code] || ['Chưa gửi được. Vui lòng thử lại.', 'Could not submit. Please try again.'])[vi ? 0 : 1]

  function start(target) { setOpen(target); setRating(5); setText(''); setMessage('') }

  async function submit(e) {
    e.preventDefault()
    setBusy(true); setMessage('')
    try {
      if (open === 'return') {
        await shopApi.request(`/orders/${order.id}/returns`, { method: 'POST', auth: true, body: { reason: text } })
        setMessage(vi ? 'Đã gửi yêu cầu đổi trả.' : 'Return request sent.')
      } else {
        await shopApi.request(`/products/${open}/reviews`, { method: 'POST', auth: true, body: { order_id: order.id, rating, comment: text } })
        setMessage(vi ? 'Cảm ơn bạn đã đánh giá.' : 'Thanks for your review.')
      }
      setOpen(null)
      onChanged()
    } catch (err) {
      setMessage(explain(err))
    } finally {
      setBusy(false)
    }
  }

  return <div className="mt-5 border-t border-line pt-4">
    <div className="flex flex-wrap gap-3">
      {products.map(item => reviewed.has(`${order.id}:${item.product_id}`)
        ? <span key={item.product_id} className="text-sm text-success">{vi ? 'Đã đánh giá' : 'Reviewed'}: {item[`name_${lang}`] || item.name}</span>
        : <button key={item.product_id} type="button" disabled={busy} className="button" onClick={() => start(item.product_id)}>{vi ? 'Đánh giá' : 'Review'}: {item[`name_${lang}`] || item.name}</button>)}
      {returnRequest
        ? <span className="text-sm font-semibold">{vi ? 'Đổi trả' : 'Return'}: {returnWords[lang][returnRequest.status]}{returnRequest.admin_note && ` · ${returnRequest.admin_note}`}</span>
        : <button type="button" disabled={busy} className="button" onClick={() => start('return')}>{vi ? 'Yêu cầu đổi trả' : 'Request a return'}</button>}
    </div>
    {open !== null && <form onSubmit={submit} className="mt-4 space-y-3">
      {open !== 'return' && <label className="block text-sm">{vi ? 'Số sao' : 'Rating'}
        <select value={rating} onChange={e => setRating(Number(e.target.value))} className="shop-input mt-2 w-full max-w-xs">
          {[5, 4, 3, 2, 1].map(n => <option key={n} value={n}>{'★'.repeat(n)} ({n}/5)</option>)}
        </select></label>}
      <label className="block text-sm">{open === 'return' ? (vi ? 'Lý do đổi trả' : 'Reason for return') : (vi ? 'Nhận xét (không bắt buộc)' : 'Comment (optional)')}
        <textarea value={text} onChange={e => setText(e.target.value)} maxLength={1000} required={open === 'return'} minLength={open === 'return' ? 5 : undefined} rows={3} className="shop-input mt-2 w-full" /></label>
      <div className="flex gap-3"><button disabled={busy} className="button button--primary">{busy ? (vi ? 'Đang gửi…' : 'Sending…') : (vi ? 'Gửi' : 'Submit')}</button>
        <button type="button" className="button" disabled={busy} onClick={() => setOpen(null)}>{vi ? 'Hủy' : 'Cancel'}</button></div>
    </form>}
    {message && <p role="status" className="mt-3 text-sm">{message}</p>}
  </div>
}
