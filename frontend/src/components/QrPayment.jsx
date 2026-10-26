import { useEffect, useRef, useState } from 'react'
import { shopApi } from '../lib/api'
import { useLang } from '../i18n'
import { formatPrice } from '../lib/format'

const POLL_MS = 4000
const POLL_LIMIT_MS = 15 * 60 * 1000

/** Shows the TConnect QR for an unpaid QR order and polls until the bank confirms payment. */
export default function QrPayment({ orderId, onPaid }) {
  const { lang } = useLang()
  const vi = lang === 'vi'
  const [qr, setQr] = useState(null)
  const [status, setStatus] = useState('loading')
  const [polling, setPolling] = useState(true)
  const paidCallback = useRef(onPaid)
  paidCallback.current = onPaid

  function settle(result) {
    if (result.order.payment_status === 'received') {
      setStatus('paid'); setPolling(false); paidCallback.current?.(result.order); return true
    }
    if (result.order.status === 'canceled') { setStatus('canceled'); setPolling(false); return true }
    return false
  }

  useEffect(() => {
    let alive = true
    setStatus('loading')
    shopApi.request(`/orders/${orderId}/qr`, { method: 'POST', auth: true }).then(result => {
      if (!alive) return
      if (settle(result)) return
      if (!result.qr) { setStatus('unavailable'); setPolling(false); return }
      setQr(result.qr); setStatus('waiting')
    }).catch(() => { if (alive) { setStatus('error'); setPolling(false) } })
    return () => { alive = false }
  }, [orderId])

  useEffect(() => {
    if (!polling || status !== 'waiting') return
    const started = Date.now()
    let alive = true
    let timer
    async function check() {
      try {
        const result = await shopApi.request(`/orders/${orderId}/payment-check`, { method: 'POST', auth: true })
        if (!alive || settle(result)) return
      } catch { /* transient: keep polling until the time limit */ }
      if (!alive) return
      if (Date.now() - started > POLL_LIMIT_MS) { setPolling(false); return }
      timer = setTimeout(check, POLL_MS)
    }
    timer = setTimeout(check, POLL_MS)
    return () => { alive = false; clearTimeout(timer) }
  }, [polling, status, orderId])

  if (status === 'loading') return <p role="status" className="mt-6 text-sm">{vi ? 'Đang tạo mã QR…' : 'Creating QR code…'}</p>
  if (status === 'paid') return <p role="status" className="mt-6 text-sm font-semibold text-success">{vi ? 'Đã nhận thanh toán. Cảm ơn bạn!' : 'Payment received. Thank you!'}</p>
  if (status === 'canceled') return <p role="status" className="mt-6 text-sm">{vi ? 'Đơn đã bị hủy nên không thể thanh toán.' : 'This order was canceled and cannot be paid.'}</p>
  if (status === 'error' || status === 'unavailable') return <p role="alert" className="mt-6 text-sm text-danger">{vi ? 'Chưa tạo được mã QR. Vào "Đơn hàng của tôi" để thử lại sau.' : 'Could not create the QR code. Retry later from "My orders".'}</p>
  return <section className="mx-auto mt-8 max-w-sm border border-line bg-white p-6 text-center">
    <h2 className="font-display text-xl uppercase">{vi ? 'Quét mã để thanh toán' : 'Scan to pay'}</h2>
    <img src={`data:image/png;base64,${qr.image_png_base64}`} alt={vi ? 'Mã QR thanh toán' : 'Payment QR code'} className="mx-auto mt-5 h-56 w-56" />
    <p className="mt-4 font-semibold">{formatPrice(qr.amount)}</p>
    <p className="mt-2 break-all text-xs text-ink-muted">{vi ? 'Mã tham chiếu' : 'Reference'}: {qr.reference}</p>
    <p className="mt-4 text-xs leading-6 text-ink-muted">{vi ? 'Mở ứng dụng ngân hàng, quét mã và giữ nguyên số tiền. Trang sẽ tự cập nhật khi nhận được tiền.' : 'Open your banking app, scan the code and keep the amount unchanged. This page updates once payment arrives.'}</p>
    {polling ? <p role="status" className="mt-4 text-xs">{vi ? 'Đang chờ thanh toán…' : 'Waiting for payment…'}</p>
      : <button type="button" className="button mt-4" onClick={() => setPolling(true)}>{vi ? 'Kiểm tra lại thanh toán' : 'Check payment again'}</button>}
  </section>
}
