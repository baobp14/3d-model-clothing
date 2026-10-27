import { useState } from 'react'
import { CARRIERS, generateTrackingCode } from '../lib/shipping'
import { useLang } from '../i18n'

export default function ShippingModal({ order, onConfirm, onClose, busy }) {
  const { lang } = useLang()
  const vi = lang === 'vi'

  const [carrier, setCarrier] = useState(order.delivery?.carrier || CARRIERS[0].name)
  const [trackingCode, setTrackingCode] = useState(
    order.delivery?.tracking_code || generateTrackingCode('GHN')
  )
  const [error, setError] = useState('')

  function handleCarrierChange(e) {
    const selectedName = e.target.value
    setCarrier(selectedName)
    const found = CARRIERS.find(c => c.name === selectedName)
    if (found && (!trackingCode || CARRIERS.some(c => trackingCode.startsWith(c.codePrefix)))) {
      setTrackingCode(generateTrackingCode(found.id))
    }
  }

  function handleAutoGenerate() {
    const found = CARRIERS.find(c => c.name === carrier) || CARRIERS[0]
    setTrackingCode(generateTrackingCode(found.id))
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (!trackingCode.trim()) {
      setError(vi ? 'Vui lòng nhập mã vận đơn.' : 'Please enter tracking code.')
      return
    }
    setError('')
    onConfirm({ carrier: carrier.trim(), tracking_code: trackingCode.trim() })
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="shipping-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    >
      <div className="w-full max-w-md rounded bg-paper p-6 shadow-xl sm:p-7">
        <h2 id="shipping-modal-title" className="font-display text-title-sm font-semibold">
          {vi ? 'Giao hàng & Mã vận đơn' : 'Fulfillment & Shipping Tracking'}
        </h2>
        <p className="mt-1 text-caption text-ink-muted">
          {vi
            ? `Cập nhật đơn vị vận chuyển và mã vận đơn cho đơn #${order.id.slice(0, 8)}...`
            : `Set carrier and tracking code for order #${order.id.slice(0, 8)}...`}
        </p>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label htmlFor="ship-carrier" className="block text-body-sm font-medium">
              {vi ? 'Đơn vị vận chuyển' : 'Shipping Carrier'}
            </label>
            <select
              id="ship-carrier"
              value={carrier}
              onChange={handleCarrierChange}
              className="mt-1.5 h-11 w-full border border-line-strong bg-paper px-3 text-body-sm"
            >
              {CARRIERS.map(c => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label htmlFor="ship-tracking" className="block text-body-sm font-medium">
                {vi ? 'Mã vận đơn (Tracking Code)' : 'Tracking Code'}
              </label>
              <button
                type="button"
                onClick={handleAutoGenerate}
                className="text-micro font-medium text-link hover:underline"
              >
                ⚡ {vi ? 'Tạo mã tự động' : 'Generate sample'}
              </button>
            </div>
            <input
              id="ship-tracking"
              type="text"
              required
              value={trackingCode}
              onChange={e => setTrackingCode(e.target.value)}
              placeholder="vd: GHN12345678"
              className="mt-1.5 h-11 w-full border border-line-strong bg-paper px-3 font-mono text-body-sm"
            />
          </div>

          {error && <p role="alert" className="text-body-sm text-danger">{error}</p>}

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-line">
            <button
              type="button"
              disabled={busy}
              onClick={onClose}
              className="button min-h-10 text-body-sm"
            >
              {vi ? 'Hủy' : 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={busy}
              className="button button--primary min-h-10 text-body-sm"
            >
              {busy ? (vi ? 'Đang lưu…' : 'Saving…') : (vi ? 'Xác nhận gửi hàng' : 'Confirm Shipped')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
