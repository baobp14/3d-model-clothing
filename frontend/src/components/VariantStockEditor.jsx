import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { shopApi } from '../lib/api'
import { mapProduct } from '../hooks/useCatalog'
import { useLang } from '../i18n'

export default function VariantStockEditor({ product, onSave, colors = [] }) {
  const { lang } = useLang()
  const vi = lang === 'vi'
  const [rows, setRows] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const lock = useRef(false)
  useEffect(() => {
    const combinations = (product.colors.length ? product.colors : ['']).flatMap(color => (product.sizes.length ? product.sizes : ['']).map(size => ({ color, size, stock: 0 })))
    setRows(product.variants || combinations.map(row => ({ ...row, stock: combinations.length === 1 ? product.stock : 0 })))
  }, [product])
  const total = rows.reduce((sum, row) => sum + Number(row.stock), 0)
  const valid = rows.length && rows.every(row => row.stock !== '' && Number.isInteger(Number(row.stock)) && Number(row.stock) >= 0 && Number(row.stock) <= 2147483647) && total <= 2147483647
  async function save(e) {
    e.preventDefault()
    if (lock.current || !valid) return
    lock.current = true; setBusy(true); setError(''); setSuccess('')
    try {
      const data = await shopApi.request(`/admin/products/${product.id}/variants`, { method: 'PATCH', auth: true, body: {
        reason: new FormData(e.currentTarget).get('reason')?.trim() || '',
        variants: rows.map(row => ({ ...row, stock: Number(row.stock) })), expected_revision: product.stockRevision, expected_stock: product.stock,
      } })
      onSave(mapProduct(data)); setSuccess(vi ? 'Đã lưu tồn kho theo màu và kích cỡ.' : 'Variant stock saved.')
    } catch (e) {
      setError(e.code === 'NB_OPEN_AGGREGATE_ORDERS'
        ? (vi ? 'Còn đơn dùng kho chung đang chờ xác nhận hoặc đã xác nhận. Giao/hủy các đơn đó trước khi chuyển sang kho biến thể.' : 'Existing shared-stock orders are pending or confirmed. Ship or cancel them before switching to variant stock.')
        : e.code === 'NB_PRODUCT_CONFLICT' ? (vi ? 'Tồn kho đã thay đổi. Tải lại trang để xem số lượng mới trước khi lưu.' : 'Stock changed. Reload to review the current quantities before saving.')
        : e.code === 'NB_STOCK_ALLOCATION' ? (vi ? 'Tổng phân bổ ban đầu phải bằng tồn kho hiện tại.' : 'Initial allocation must equal current product stock.')
        : (vi ? 'Không lưu được tồn kho. Vui lòng kiểm tra rồi thử lại.' : 'Could not save stock. Please check and retry.'))
    } finally { lock.current = false; setBusy(false) }
  }
  return <section id="variant-stock" className="mt-7 scroll-mt-24 rounded-2xl border border-feather bg-white p-5 sm:p-7"><h2 className="font-semibold">{vi ? 'Tồn kho theo màu và kích cỡ' : 'Stock by color and size'}</h2>
    <p className="mt-3 text-sm text-slate">{product.variants ? (vi ? 'Tổng kho bằng tổng các biến thể. Đặt/hủy đơn cập nhật đúng màu và kích cỡ.' : 'Product stock equals the sum of variants. Orders and cancellations update the selected variant.') : (vi ? 'Hiện dùng kho chung. Nhập phân bổ thực tế; giữ nguyên tổng số lượng khi thiết lập lần đầu.' : 'Currently using shared stock. Enter actual quantities; preserve total stock on first setup.')}</p>
    <form onSubmit={save}><fieldset disabled={busy}><div className="mt-5 max-h-[480px] overflow-auto"><table className="w-full text-left text-sm"><thead><tr><th className="p-3">{vi ? 'Màu' : 'Color'}</th><th className="p-3">{vi ? 'Kích cỡ' : 'Size'}</th><th className="p-3">{vi ? 'Tồn kho' : 'Stock'}</th></tr></thead><tbody>{rows.map((row, index) => <tr key={JSON.stringify([row.color, row.size])} className="border-t border-feather"><td className="p-3">{colors.find(color => color.id === row.color)?.[lang] || row.color || (vi ? 'Mặc định' : 'Default')}</td><td className="p-3">{row.size || (vi ? 'Mặc định' : 'Default')}</td><td className="p-3"><input aria-label={`${vi ? 'Tồn kho' : 'Stock'} ${row.color || 'default'} ${row.size || 'default'}`} type="number" min="0" max="2147483647" step="1" required value={row.stock} onChange={e => setRows(current => current.map((item, i) => i === index ? { ...item, stock: e.target.value } : item))} className="shop-input w-28" /></td></tr>)}</tbody></table></div>
      <p className="mt-5 text-sm">{vi ? 'Tổng phân bổ' : 'Allocated total'}: {total.toLocaleString()} · {vi ? 'Tồn kho hiện tại' : 'Current stock'}: {product.stock.toLocaleString()}</p>
      {!product.variants && total !== product.stock && <p className="mt-2 text-sm text-amber-700">{vi ? 'Phân bổ đủ tồn kho hiện tại để chuyển sang quản lý biến thể.' : 'Allocate all current stock to enable variant inventory.'}</p>}
      <label className="mt-4 block text-sm">{vi ? 'Lý do phân bổ/điều chỉnh kho' : 'Stock allocation/adjustment reason'}<input name="reason" required maxLength={300} className="shop-input mt-2 w-full" /></label>
      <button className="button mt-5" disabled={!valid || (!product.variants && total !== product.stock)}>{busy ? (vi ? 'Đang lưu…' : 'Saving…') : (vi ? 'Lưu kho biến thể' : 'Save variant stock')}</button>
    </fieldset></form>{error && <p role="alert" className="mt-4 text-sm text-red-700">{error} <Link to="/admin/orders" className="underline">{vi ? 'Xem đơn hàng' : 'View orders'}</Link></p>}{success && <p role="status" className="mt-4 text-sm text-emerald-700">{success}</p>}
  </section>
}
