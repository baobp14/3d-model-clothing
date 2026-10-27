import { useEffect } from 'react'
import { useLang } from '../i18n'

export default function OrderInvoiceModal({ order, onClose }) {
  const { lang } = useLang()
  const vi = lang === 'vi'

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  if (!order) return null

  const money = val =>
    new Intl.NumberFormat(vi ? 'vi-VN' : 'en-US', {
      style: 'currency',
      currency: 'VND',
    }).format(val || 0)

  const dateStr = new Date(order.created_at).toLocaleString(vi ? 'vi-VN' : 'en-US', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })

  const carrier = order.delivery?.carrier || (vi ? 'Chưa chỉ định' : 'Unassigned')
  const trackingCode = order.delivery?.tracking_code || '—'
  const isPaid = order.payment_status === 'received' || order.payment === 'qr' && order.status !== 'pending'
  const codAmount = order.payment === 'cod' ? order.total : 0

  function handlePrint() {
    window.print()
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="invoice-title"
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-4 print:static print:inset-auto print:bg-transparent print:p-0"
    >
      {/* Container phiếu hóa đơn */}
      <div className="relative w-full max-w-2xl bg-paper p-6 shadow-2xl sm:p-8 print:w-full print:max-w-none print:p-0 print:shadow-none">
        {/* Nút thao tác ở modal (ẩn khi in) */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4 print:hidden">
          <h2 id="invoice-title" className="font-display text-title-sm font-semibold">
            {vi ? 'Phiếu đóng gói & Hóa đơn đơn hàng' : 'Packing Slip & Order Invoice'}
          </h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="button button--primary min-h-10 text-body-sm"
            >
              🖨 {vi ? 'In phiếu / Xuất PDF' : 'Print / Export PDF'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="button min-h-10 text-body-sm"
            >
              {vi ? 'Đóng' : 'Close'}
            </button>
          </div>
        </div>

        {/* --- NỘI DUNG PHIẾU ĐÓNG GÓI & GIAO HÀNG CHUẨN IN --- */}
        <div className="invoice-print-area space-y-5 text-ink">
          {/* Header */}
          <div className="flex items-start justify-between border-b-2 border-ink pb-4">
            <div>
              <p className="font-display text-2xl font-bold tracking-widest uppercase">N&amp;B</p>
              <p className="text-caption text-ink-muted">
                {vi ? 'Thời trang may sẵn cao cấp' : 'Refined Ready-to-Wear'}
              </p>
              <p className="mt-1 text-micro text-ink-muted">Hotline: 1900 8888 · contact@nb-atelier.vn</p>
            </div>
            <div className="text-right">
              <span className="inline-block border border-ink px-2.5 py-1 text-caption font-bold uppercase tracking-wider">
                {vi ? 'PHIẾU GIAO HÀNG & HÓA ĐƠN' : 'PACKING SLIP & INVOICE'}
              </span>
              <p className="mt-2 text-micro font-mono text-ink-muted">
                {vi ? 'Mã đơn' : 'Order ID'}: {order.id.slice(0, 18)}...
              </p>
              <p className="text-micro text-ink-muted">{dateStr}</p>
            </div>
          </div>

          {/* Khung Thông tin Người gửi & Người nhận */}
          <div className="grid grid-cols-2 gap-4 border border-line p-4 text-xs">
            <div>
              <p className="font-semibold uppercase tracking-wider text-ink-muted">
                {vi ? 'GỬI TỪ (SENDER):' : 'FROM:'}
              </p>
              <p className="mt-1 font-medium">Kho hàng Flagship N&amp;B Fashion</p>
              <p className="mt-0.5 text-ink-muted">Tòa nhà N&amp;B, Quận 1, TP. Hồ Chí Minh</p>
              <p className="mt-0.5 text-ink-muted">SĐT: 028 3822 8888</p>
            </div>

            <div className="border-l border-line pl-4">
              <p className="font-semibold uppercase tracking-wider text-ink-muted">
                {vi ? 'GỬI ĐẾN (RECIPIENT):' : 'DELIVER TO:'}
              </p>
              <p className="mt-1 text-sm font-bold">{order.delivery?.name}</p>
              <p className="mt-0.5 font-semibold text-ink">{order.delivery?.phone}</p>
              <p className="mt-0.5">{order.delivery?.address}</p>
              <p className="mt-0.5 font-medium">{order.delivery?.city}</p>
              {order.delivery?.notes && (
                <p className="mt-1 rounded bg-cream/70 p-1 text-[11px] italic">
                  {vi ? 'Ghi chú' : 'Notes'}: {order.delivery.notes}
                </p>
              )}
            </div>
          </div>

          {/* Khung Vận đơn & Đơn vị vận chuyển */}
          <div className="flex flex-wrap items-center justify-between border border-line bg-surface/30 px-4 py-2.5 text-xs">
            <div>
              <span className="text-ink-muted">{vi ? 'Đơn vị vận chuyển: ' : 'Carrier: '}</span>
              <span className="font-bold text-ink">{carrier}</span>
            </div>
            <div>
              <span className="text-ink-muted">{vi ? 'Mã vận đơn: ' : 'Tracking No: '}</span>
              <span className="font-mono text-sm font-extrabold tracking-wider text-ink">
                {trackingCode}
              </span>
            </div>
          </div>

          {/* Bảng danh sách sản phẩm */}
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-y border-line-strong bg-surface/50 text-caption font-semibold">
                <th className="py-2 pl-2">STT</th>
                <th className="py-2">{vi ? 'Tên sản phẩm' : 'Product'}</th>
                <th className="py-2">{vi ? 'Phân loại' : 'Variant'}</th>
                <th className="py-2 text-center">{vi ? 'SL' : 'Qty'}</th>
                <th className="py-2 text-right">{vi ? 'Đơn giá' : 'Unit Price'}</th>
                <th className="py-2 pr-2 text-right">{vi ? 'Thành tiền' : 'Amount'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {order.items.map((item, idx) => (
                <tr key={idx}>
                  <td className="py-2.5 pl-2 text-ink-muted">{idx + 1}</td>
                  <td className="py-2.5 font-medium">{item[`name_${lang}`] || item.name}</td>
                  <td className="py-2.5 text-ink-muted">
                    {item[`color_${lang}`] || item.color} · Size {item.size}
                  </td>
                  <td className="py-2.5 text-center font-bold">{item.quantity}</td>
                  <td className="py-2.5 text-right font-mono">{money(item.price)}</td>
                  <td className="py-2.5 pr-2 text-right font-mono font-medium">
                    {money(item.price * item.quantity)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Bảng tổng tiền */}
          <div className="flex justify-end pt-2">
            <div className="w-64 space-y-1.5 text-xs">
              <div className="flex justify-between text-ink-muted">
                <span>{vi ? 'Tạm tính' : 'Subtotal'}:</span>
                <span className="font-mono">{money(order.subtotal || order.total)}</span>
              </div>
              {order.discount > 0 && (
                <div className="flex justify-between text-danger">
                  <span>{vi ? 'Khuyến mãi' : 'Discount'} ({order.promotion_code}):</span>
                  <span className="font-mono">−{money(order.discount)}</span>
                </div>
              )}
              <div className="flex justify-between text-ink-muted">
                <span>{vi ? 'Phí vận chuyển' : 'Shipping fee'}:</span>
                <span>{vi ? 'Miễn phí' : 'Complimentary'}</span>
              </div>
              <div className="flex justify-between border-t border-line-strong pt-2 text-sm font-bold">
                <span>{vi ? 'TỔNG CỘNG' : 'TOTAL'}:</span>
                <span className="font-mono">{money(order.total)}</span>
              </div>
            </div>
          </div>

          {/* Ô chỉ dẫn COD & Thu tiền cho shipper */}
          <div className="rounded border-2 border-dashed border-ink p-3 text-center">
            {order.payment === 'cod' ? (
              <div>
                <p className="text-caption font-bold tracking-wider uppercase text-danger">
                  {vi ? 'TIỀN THU NGƯỜI NHẬN (COD):' : 'AMOUNT TO COLLECT (COD):'}
                </p>
                <p className="font-display text-2xl font-black text-danger">
                  {money(codAmount)}
                </p>
                <p className="mt-1 text-micro text-ink-muted">
                  {vi
                    ? 'Bưu tá thu đúng số tiền trên. Cho khách đồng kiểm hàng khi nhận.'
                    : 'Collect exact amount above. Package inspection allowed.'}
                </p>
              </div>
            ) : (
              <div>
                <p className="text-caption font-bold tracking-wider uppercase text-success">
                  {vi ? '✓ ĐƠN ĐÃ THANH TOÁN QR TRƯỚC' : '✓ PREPAID VIA QR'}
                </p>
                <p className="font-display text-lg font-bold text-success">
                  {vi ? 'BƯU TÁ KHÔNG THU TIỀN' : 'DO NOT COLLECT MONEY'}
                </p>
              </div>
            )}
          </div>

          {/* Chữ ký bưu tá / người nhận */}
          <div className="grid grid-cols-2 pt-4 text-center text-xs">
            <div>
              <p className="font-semibold">{vi ? 'Người đóng gói' : 'Packer'}</p>
              <p className="mt-1 text-micro text-ink-muted">{vi ? '(Ký & ghi rõ họ tên)' : '(Sign & full name)'}</p>
              <div className="h-12" />
              <p className="text-caption text-ink-muted">N&amp;B Warehouse</p>
            </div>
            <div>
              <p className="font-semibold">{vi ? 'Người nhận hàng' : 'Recipient'}</p>
              <p className="mt-1 text-micro text-ink-muted">{vi ? '(Ký & xác nhận nguyên vẹn)' : '(Sign & verify condition)'}</p>
              <div className="h-12" />
              <p className="text-caption text-ink-muted">{order.delivery?.name}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
