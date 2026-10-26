import ProductDescription from '../components/ProductDescription'
import VariantStockEditor from '../components/VariantStockEditor'
import { getProductDescription } from '../data/productDescriptions'
﻿import { useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { useLang } from '../i18n'
import { categories as localCategories } from '../data/products'
import { formatPrice } from '../lib/format'
import { isSupabaseReady } from '../lib/supabase'
import { shopApi } from '../lib/api'
import { mapProduct } from '../hooks/useCatalog'
import Popup from '../components/Popup'
import StockHistory from '../components/StockHistory'

export default function InventoryDetail() {
  const { id } = useParams()
  const { state } = useLocation()
  const returnTo = /^\/admin\/((inventory|pricing)\/products|inventory\/alerts)(?:\?|$)/.test(state?.returnTo || '') ? state.returnTo : '/admin/inventory/products'
  const { lang } = useLang()
  const vi = lang === 'vi'
  const [product, setProduct] = useState(null)
  const [categories, setCategories] = useState(localCategories)
  const [colors, setColors] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState('')
  const [success, setSuccess] = useState('')
  useEffect(() => {
    let alive = true
    setLoading(true); setError(''); setProduct(null); setEditing(false); setSuccess('')
    async function load() {
      try {
        const p = await shopApi.request(`/products/${id}`)
        if (alive) {
          setProduct(mapProduct(p.product))
          setColors(p.colors.map(c => ({ ...c, vi: c.name_vi, en: c.name_en })))
          setCategories(p.categories.map(r => ({ id: r.id, vi: r.name_vi, en: r.name_en })))
        }
      } catch { if (alive) setError(vi ? 'Không thể tải sản phẩm. Vui lòng thử lại.' : 'Could not load product. Please retry.') }
      finally { if (alive) setLoading(false) }
    }
    load()
    return () => { alive = false }
  }, [id, vi])
  async function save(e) {
    e.preventDefault()
    if (busy) return
    const form = new FormData(e.currentTarget)
    const name = form.get('name').trim()
    const price = Number(form.get('price'))
    const stock = Number(form.get('stock'))
    if (!name || !Number.isSafeInteger(price) || price < 0 || !Number.isInteger(stock) || stock < 0 || stock > 2147483647) {
      setFormError(vi ? 'Nhập tên, giá và tồn kho hợp lệ.' : 'Enter a valid name, price and stock.'); return
    }
    setBusy(true); setFormError('')
    try {
      const data = await shopApi.request(`/admin/products/${product.id}`, { method: 'PATCH', auth: true, body: {
        name, price, stock, description: form.get('description'),
        reason: form.get('reason')?.trim() || '',
        name_en: form.get('name_en').trim(), description_en: form.get('description_en'),
        colors: form.get('colors').split(',').map(x => x.trim()).filter(Boolean),
        sizes: form.get('sizes').split(',').map(x => x.trim()).filter(Boolean),
        images: form.get('images').split('\n').map(x => x.trim()).filter(Boolean),
        expected: { name: product.vi, price: product.price, stock: product.stock, description: product.description, name_en: product.en, description_en: product.descriptionEn, colors: product.colors, sizes: product.sizes, images: product.images },
      } })
      setProduct(mapProduct(data)); setEditing(false)
      setSuccess(vi ? 'Đã lưu thay đổi sản phẩm.' : 'Product changes saved.')
    } catch (failure) {
      const code = failure.code || failure.message
      setFormError(code === 'NB_PRODUCT_CONFLICT'
        ? (vi ? 'Thông tin hoặc tồn kho đã thay đổi. Tải lại trang để kiểm tra dữ liệu mới trước khi sửa.' : 'Product or stock has changed. Reload the page to review current data before editing.')
        : code === 'NB_VARIANT_HAS_STOCK'
        ? (vi ? 'Chưa thể bỏ màu/size này vì vẫn còn tồn kho. Kiểm tra số lượng thực tế và xử lý tồn trong bảng kho biến thể trước khi bỏ lựa chọn.' : 'This color/size still has stock and cannot be removed. Check actual quantities and resolve its stock in the variant inventory table first.')
        : code === 'NB_VARIANT_IN_USE'
        ? (vi ? 'Chưa thể bỏ màu/size này vì đang có trong đơn chờ hoặc đã xác nhận. Vào quản lý đơn hàng để xử lý giao/hủy đơn liên quan trước.' : 'This color/size is used by pending or confirmed orders and cannot be removed. Process the related orders by shipping or canceling them first.')
        : code === 'NB_VARIANT_STOCK_REQUIRED'
        ? (vi ? 'Sản phẩm dùng kho theo màu/size. Sửa số lượng trong bảng kho biến thể, không sửa tổng kho ở đây.' : 'This product uses color/size inventory. Edit quantities in the variant inventory table rather than the aggregate stock field.')
        : code === 'NB_INVALID_PRODUCT' || code === 'NB_INVALID_INPUT'
        ? (vi ? 'Thông tin sản phẩm chưa hợp lệ. Kiểm tra tên, giá, mã màu, size và đường dẫn ảnh rồi lưu lại.' : 'Product details are invalid. Check names, prices, color IDs, sizes and image URLs before saving again.')
        : (vi ? 'Không thể lưu thay đổi. Vui lòng kiểm tra kết nối rồi thử lại.' : 'Could not save changes. Please check your connection and retry.'))
    } finally { setBusy(false) }
  }
  async function toggleArchived() {
    if (busy) return
    const archived = !product.archived
    if (!window.confirm(archived
      ? (vi ? 'Ngừng bán sản phẩm này? Sản phẩm sẽ ẩn khỏi cửa hàng và không đặt mới được; đơn đã đặt không bị ảnh hưởng.' : 'Discontinue this product? It is hidden from the shop and cannot be ordered; existing orders are unaffected.')
      : (vi ? 'Mở bán lại sản phẩm này?' : 'Put this product back on sale?'))) return
    setBusy(true); setError(''); setSuccess('')
    try {
      const data = await shopApi.request(`/admin/products/${product.id}/archive`, { method: 'POST', auth: true, body: { archived } })
      setProduct(mapProduct(data))
      setSuccess(archived ? (vi ? 'Đã ngừng bán sản phẩm.' : 'Product discontinued.') : (vi ? 'Đã mở bán lại sản phẩm.' : 'Product is on sale again.'))
    } catch { setError(vi ? 'Chưa đổi được trạng thái bán. Vui lòng thử lại.' : 'Could not change sale status. Please retry.') }
    finally { setBusy(false) }
  }
  const field = 'shop-input mt-2 w-full rounded-lg border-[#dfe3eb]'
  const values = product ? [
    [vi ? 'Mã sản phẩm' : 'Product ID', `#${product.id}`],
    [vi ? 'Tên tiếng Việt' : 'Vietnamese name', product.vi],
    [vi ? 'Tên tiếng Anh' : 'English name', product.en],
    [vi ? 'Loại sản phẩm' : 'Category', categories.find(c => c.id === product.category)?.[lang] || product.category],
    [vi ? 'Danh mục' : 'Department', { men: vi ? 'Nam' : 'Men', women: vi ? 'Nữ' : 'Women', bags: vi ? 'Túi & phụ kiện' : 'Bags & accessories', watches: vi ? 'Đồng hồ' : 'Watches' }[product.department]],
    [vi ? 'Giá bán' : 'Price', formatPrice(product.price)],
    [vi ? 'Số lượng tồn kho' : 'Stock quantity', product.stock ?? '—'],
    [vi ? 'Màu sắc' : 'Colors', product.colors.map(c => colors.find(x => x.id === c)?.[lang] || c).join(', ') || '—'],
    [vi ? 'Kích cỡ' : 'Sizes', product.sizes.join(', ') || '—'],
    [vi ? 'Sản phẩm mới' : 'New product', product.isNew ? (vi ? 'Có' : 'Yes') : (vi ? 'Không' : 'No')],
    [vi ? 'Ngày tạo' : 'Created at', product.createdAt ? new Date(product.createdAt).toLocaleString(vi ? 'vi-VN' : 'en-GB', { timeZone: 'Asia/Saigon' }) : '—'],
  ] : []
  return <main className="p-4 sm:p-7 lg:p-8"><div className="mx-auto max-w-[1400px]">
    <Link to={returnTo} className="text-sm text-[#303a9f] underline underline-offset-4">{vi ? '← Quay lại danh sách sản phẩm' : '← Back to product list'}</Link>
    <div className="mt-6 flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-2xl font-bold text-[#252d78] sm:text-3xl">{vi ? 'Chi tiết sản phẩm' : 'Product details'}</h1>{product && <p className="mt-2 text-sm text-slate">{product[lang]} · #{product.id}</p>}</div>{product && <button disabled={!isSupabaseReady || product.description === undefined || product.stock == null} onClick={() => { setFormError(''); setSuccess(''); setEditing(true) }} className="button rounded-lg bg-[#303a9f] text-white disabled:opacity-40">{vi ? 'Chỉnh sửa' : 'Edit'}</button>}{product && <button disabled={!isSupabaseReady || busy} onClick={toggleArchived} className="button rounded-lg disabled:opacity-40">{product.archived ? (vi ? 'Mở bán lại' : 'Put back on sale') : (vi ? 'Ngừng bán' : 'Discontinue')}</button>}</div>
    {product?.archived && <p className="mt-4 text-sm font-semibold text-amber-700">{vi ? 'Sản phẩm đang ngừng bán: đã ẩn khỏi cửa hàng.' : 'Discontinued: hidden from the shop.'}</p>}
    <p role="alert" className="mt-4 text-sm text-red-700">{error}</p><p role="status" className="text-sm text-emerald-700">{success}</p>
    {loading ? <p className="py-12 text-slate">{vi ? 'Đang tải sản phẩm…' : 'Loading product…'}</p> : !product ? !error && <p className="py-12">{vi ? 'Không tìm thấy sản phẩm.' : 'Product not found.'}</p> : <>
      {!isSupabaseReady && <p className="mt-4 text-sm text-amber-700">{vi ? 'Chưa thể xác minh tài khoản quản trị. Vui lòng đăng nhập lại.' : 'Could not verify your admin account. Please sign in again.'}</p>}
      {isSupabaseReady && product.description === undefined && <p className="mt-4 text-sm text-amber-700">{vi ? 'Thông tin sản phẩm chưa đầy đủ. Chưa thể chỉnh sửa lúc này.' : 'Product information is incomplete. Editing is temporarily unavailable.'}</p>}
      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]"><section className="rounded-2xl border border-[#dfe3eb] bg-white p-5"><h2 className="mb-4 font-semibold">{vi ? 'Ảnh sản phẩm' : 'Product images'}</h2>{product.images.length ? <div className="grid grid-cols-2 gap-3">{product.images.map((image, i) => <img key={i} src={image} alt={`${product[lang]} — ${i + 1}`} className={`w-full rounded-lg bg-alabaster object-contain ${i === 0 ? 'col-span-2 h-96' : 'h-40'}`} />)}</div> : <p className="text-slate">{vi ? 'Chưa có ảnh.' : 'No images.'}</p>}</section>
      <section className="rounded-2xl border border-[#dfe3eb] bg-white p-5 sm:p-7"><h2 className="font-semibold">{vi ? 'Thông tin sản phẩm' : 'Product information'}</h2><dl className="mt-4 grid gap-x-8 sm:grid-cols-2">{values.map(([label, value]) => <div key={label} className="border-b border-[#e2e5ec] py-4"><dt className="text-xs text-slate">{label}</dt><dd className="mt-2 break-words text-sm font-medium">{value}</dd></div>)}</dl><h2 className="mt-6 font-semibold">{vi ? 'Mô tả' : 'Description'}</h2><ProductDescription product={product} productColors={colors} className="mt-3 !text-sm !leading-7" /></section></div>
      <VariantStockEditor product={product} colors={colors} onSave={setProduct} />
      <StockHistory product={product} colors={colors} />
    </>}
    {editing && <Popup title={vi ? 'Chỉnh sửa sản phẩm' : 'Edit product'} busy={busy} close={() => setEditing(false)}><form onSubmit={save} className="space-y-4"><fieldset disabled={busy} className="space-y-4">
      <label className="block text-sm">{vi ? 'Tên sản phẩm' : 'Product name'}<input name="name" defaultValue={product.vi} required maxLength={160} className={field} /></label>
      <div className="grid grid-cols-2 gap-4"><label className="text-sm">{vi ? 'Giá bán (VND)' : 'Price (VND)'}<input name="price" type="number" min="0" max="9007199254740991" step="1" defaultValue={product.price} required className={field} /></label><label className="text-sm">{vi ? 'Số lượng tồn kho' : 'Stock quantity'}<input name="stock" readOnly={!!product.variants} type="number" min="0" max="2147483647" step="1" defaultValue={product.stock} required className={field} /></label></div>
      <label className="block text-sm">{vi ? 'Mô tả (tiếng Việt)' : 'Description (Vietnamese)'}<textarea name="description" rows={5} maxLength={5000} defaultValue={getProductDescription(product, 'vi', colors)} className={field} /></label>
      <label className="block text-sm">{vi ? 'Tên tiếng Anh' : 'English name'}<input name="name_en" required maxLength={160} defaultValue={product.en} className={field} /></label>
      <label className="block text-sm">{vi ? 'Lý do điều chỉnh kho (nếu có)' : 'Stock adjustment reason (if applicable)'}<input name="reason" maxLength={300} className={field} /></label>
      <label className="block text-sm">{vi ? 'Mô tả tiếng Anh' : 'English description'}<textarea name="description_en" rows={5} maxLength={5000} defaultValue={product.descriptionEn || ''} className={field} /></label>
      <label className="block text-sm">{vi ? 'Mã màu, cách nhau bằng dấu phẩy' : 'Color IDs, comma separated'}<input name="colors" defaultValue={product.colors.join(', ')} className={field} /><small>{colors.map(x => `${x.id}: ${x[lang]}`).join(' · ')}</small></label>
      <label className="block text-sm">{vi ? 'Kích cỡ, cách nhau bằng dấu phẩy' : 'Sizes, comma separated'}<input name="sizes" defaultValue={product.sizes.join(', ')} className={field} /></label>
      <label className="block text-sm">{vi ? 'Ảnh: mỗi dòng một URL hoặc đường dẫn /img/' : 'Images: one URL or /img/ path per line'}<textarea name="images" rows={4} defaultValue={product.images.join('\n')} className={field} /></label>
      <p className="text-xs text-slate">{product.variants ? (vi ? 'Sửa số lượng trong bảng kho biến thể. Trước khi bỏ màu/size, kiểm tra hàng thực tế và xử lý tồn kho. Chỉ bỏ khi không còn hàng và không còn đơn chờ/đã xác nhận sử dụng; không đặt tồn kho về 0 chỉ để xóa lựa chọn.' : 'Edit quantities in the variant stock table. Before removing a color/size, verify physical stock and resolve its inventory. Remove it only when no stock or pending/confirmed orders remain. Do not set stock to zero just to remove an option.') : (vi ? 'Thiết lập kho riêng trong bảng màu–kích cỡ bên dưới.' : 'Set up separate quantities in the color–size stock table below.')}</p>
      </fieldset><p role="alert" className="text-sm text-red-700">{formError}</p><div className="flex justify-end gap-3"><button type="button" disabled={busy} onClick={() => setEditing(false)} className="button">{vi ? 'Hủy' : 'Cancel'}</button><button disabled={busy} className="button bg-[#303a9f] text-white disabled:opacity-40">{busy ? (vi ? 'Đang lưu…' : 'Saving…') : (vi ? 'Lưu thay đổi' : 'Save changes')}</button></div>
    </form></Popup>}
  </div></main>
}

