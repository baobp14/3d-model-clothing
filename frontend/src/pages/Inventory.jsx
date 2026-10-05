import { useEffect, useRef, useState } from 'react'
import { useListParams } from '../hooks/useListParams'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { Link, useLocation } from 'react-router-dom'
import { useLang } from '../i18n'
import { categories as defaults, formatPrice } from '../data/products'
import { isSupabaseReady } from '../lib/supabase'
import { shopApi } from '../lib/api'
import { mapProduct } from '../hooks/useCatalog'
import Popup from '../components/Popup'
import Pagination from '../components/Pagination'
import ExportButton from '../components/ExportButton'
import { useAuth } from '../hooks/useAuth'
import { productRequestKey, readProductRequest, prepareProductRequest } from '../lib/productRequest'
import { withCheckoutLock } from '../lib/checkoutLock'

export default function Inventory({ pricing = false }) {
  const { lang } = useLang()
  const vi = lang === 'vi'
  const { user } = useAuth()
  const [pendingCreate, setPendingCreate] = useState(null)
  const [requestError, setRequestError] = useState(false)
  useEffect(() => {
    try { setPendingCreate(readProductRequest(localStorage, user.id)) }
    catch { setRequestError(true) }
  }, [user.id])
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState(defaults)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const { params, page, setPage, update } = useListParams()
  const location = useLocation()
  const returnTo = location.pathname + location.search
  const query = params.get('q') || '', category = params.get('category') || '', stock = params.get('stock') || '', sort = params.get('sort') || 'id'
  const settledQuery = useDebouncedValue(query)
  const exportQuery = new URLSearchParams({ q: query, categories: category, sort })
  if (stock) exportQuery.set('stock', stock)
  const setQuery = value => update({ q: value })
  const setCategory = value => update({ category: value })
  const setStock = value => update({ stock: value })
  const setSort = value => update({ sort: value })
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState('')
  const [image, setImage] = useState('')
  const [imageBusy, setImageBusy] = useState(false)
  const [success, setSuccess] = useState('')
  const [paging, setPaging] = useState({ total: 0, pages: 1, stock_units: 0 })
  const generation = useRef(0)
  async function load() {
    const current = ++generation.current
    setLoading(true); setError('')
    if (query !== settledQuery) return
    try {
      const params = new URLSearchParams({ page, limit: 20, q: query, categories: category, sort })
      if (stock) params.set('stock', stock)
      const catalog = await shopApi.request(`/product-page?${params}`)
      if (current !== generation.current) return
      if (page > catalog.pages) { setPage(catalog.pages); return }
      setPaging(catalog)
      setProducts(catalog.products.map(mapProduct))
      setCategories(catalog.categories.map(r => ({ id: r.id, department: r.department, vi: r.name_vi, en: r.name_en })))
    } catch { if (current === generation.current) setError(vi ? 'Không thể tải kho. Vui lòng thử làm mới.' : 'Could not load inventory. Please refresh and retry.') }
    finally { if (current === generation.current) setLoading(false) }
  }
  useEffect(() => { load(); return () => { generation.current += 1 } }, [page, query, settledQuery, category, stock, sort])
  useEffect(() => {
    const refresh = () => load()
    window.addEventListener('focus', refresh)
    return () => window.removeEventListener('focus', refresh)
  }, [page, query, settledQuery, category, stock, sort])
  async function chooseImage(e) {
    const file = e.target.files[0]
    setImage(''); setFormError('')
    if (!file) return
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 2 * 1024 * 1024) {
      setFormError(vi ? 'Chọn ảnh JPG, PNG hoặc WebP tối đa 2 MB.' : 'Choose a JPG, PNG or WebP image up to 2 MB.'); return
    }
    setImageBusy(true)
    try {
      const data = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file) })
      setImage(data)
    } catch { setFormError(vi ? 'Không thể đọc ảnh.' : 'Could not read image.') }
    finally { setImageBusy(false) }
  }
  async function sendProduct(request) {
    await shopApi.request('/admin/products', { method: 'POST', auth: true, body: { ...request.payload, request_id: request.id } })
    localStorage.removeItem(productRequestKey(user.id)); setPendingCreate(null)
    await load()
    setOpen(false); setSuccess(vi ? 'Đã thêm sản phẩm vào kho và cửa hàng.' : 'Product added to inventory and storefront.')
  }
  async function retryProduct() {
    if (busy || !pendingCreate) return
    setBusy(true); setFormError('')
    try { await sendProduct(pendingCreate) }
    catch { setFormError(vi ? 'Chưa xác nhận được sản phẩm. Thử lại cùng yêu cầu để tránh tạo trùng.' : 'Product not confirmed. Retry the same request to avoid duplicates.') }
    finally { setBusy(false) }
  }
  async function save(e) {
    e.preventDefault()
    if (busy || imageBusy) return
    const values = new FormData(e.currentTarget)
    try { await withCheckoutLock(`product-create:${user.id}`, () => saveValues(values)) }
    catch { setFormError(vi ? 'Tab khác đang thêm sản phẩm. Tải lại và kiểm tra yêu cầu trước.' : 'Another tab is adding a product. Reload and check the previous request.') }
  }
  async function saveValues(values) {
    if (!image || !values.get('name').trim()) { setFormError(vi ? 'Vui lòng nhập tên và chọn ảnh sản phẩm.' : 'Enter a name and choose a product image.'); return }
    setBusy(true); setFormError('')
    try {
      const request = prepareProductRequest(localStorage, user.id, {
        name: values.get('name').trim(), name_en: values.get('name_en').trim(), category: values.get('category'), price: Number(values.get('price')), stock: Number(values.get('stock')), image,
      })
      setPendingCreate(request)
      await sendProduct(request)
    } catch (failure) {
      if (failure.status >= 400 && failure.status < 500 && ![401, 403, 409].includes(failure.status)) { localStorage.removeItem(productRequestKey(user.id)); setPendingCreate(null) }
      else {
        try { const saved = readProductRequest(localStorage, user.id); if (saved) { setPendingCreate(saved); setOpen(false) } }
        catch { setRequestError(true) }
      }
      setFormError(vi ? 'Chưa xác nhận được sản phẩm. Kiểm tra lại yêu cầu cũ trước khi thêm sản phẩm khác.' : 'Product not confirmed. Check the previous request before adding another product.')
    }
    finally { setBusy(false) }
  }
  const filtered = products
  const field = 'shop-input w-full rounded-lg border-[#dfe3eb]'
  return <main className="p-4 sm:p-7 lg:p-8"><div className="mx-auto max-w-[1600px]">
    {requestError && <p role="alert" className="mb-5 text-red-700">{vi ? 'Không đọc được yêu cầu thêm sản phẩm đã lưu. Vui lòng kiểm tra dữ liệu trình duyệt trước khi tiếp tục.' : 'Could not read the saved product request. Check browser storage before continuing.'}</p>}
    {pendingCreate && <section className="mb-5 border border-amber-300 p-5"><p>{vi ? 'Có yêu cầu thêm sản phẩm chưa xác nhận' : 'An unconfirmed product request exists'}: <strong>{pendingCreate.payload.name}</strong></p><button disabled={busy} className="button mt-4" onClick={retryProduct}>{vi ? 'Kiểm tra lại sản phẩm' : 'Check previous product'}</button>{!open && formError && <p role="alert" className="mt-4 text-red-700">{formError}</p>}</section>}
    <div className="flex flex-wrap items-center justify-between gap-4"><div><h1 className="text-3xl font-bold text-[#252d78]">{pricing ? (vi ? 'Giá sản phẩm' : 'Product prices') : (vi ? 'Kho sản phẩm' : 'Product inventory')}</h1><p className="mt-2 text-sm text-slate">{paging.total} {vi ? 'sản phẩm' : 'products'} · {paging.stock_units.toLocaleString()} {vi ? 'đơn vị tồn kho' : 'units in stock'}</p></div><div className="flex gap-3"><button onClick={load} disabled={loading} className="button rounded-lg">{vi ? 'Làm mới' : 'Refresh'}</button><button disabled={!isSupabaseReady || loading || !!error || !!pendingCreate || requestError} onClick={() => { setImage(''); setFormError(''); setOpen(true) }} className="button rounded-lg bg-[#303a9f] text-white disabled:opacity-40">+ {vi ? 'Thêm sản phẩm' : 'Add product'}</button></div></div>
    {!isSupabaseReady && <p className="mt-4 text-sm text-amber-700">{vi ? 'Đăng nhập để quản lý kho.' : 'Sign in to manage inventory.'}</p>}
    <div className="mt-5 flex flex-wrap gap-4"><ExportButton endpoint={`/admin/inventory/export?${exportQuery}`} disabled={loading || !!error || query !== settledQuery} /><Link className="button" to="/admin/inventory/alerts">{vi ? 'Cảnh báo màu/size tồn thấp' : 'Low-stock color/size alerts'}</Link></div>
    <p role="status" className="mt-4 text-sm text-emerald-700">{success}</p><p role="alert" className="text-sm text-red-700">{error}</p>
    <section className="mt-6 rounded-2xl border border-[#dfe3eb] bg-white p-5"><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <label className="text-sm">{vi ? 'Tìm sản phẩm' : 'Search products'}<input className={`${field} mt-2`} value={query} onChange={e => { setQuery(e.target.value) } } placeholder={vi ? 'Tên hoặc mã sản phẩm' : 'Name or ID'} /></label>
      <label className="text-sm">{vi ? 'Loại sản phẩm' : 'Category'}<select className={`${field} mt-2`} value={category} onChange={e => { setCategory(e.target.value) } }><option value="">{vi ? 'Tất cả loại' : 'All categories'}</option>{categories.map(c => <option key={c.id} value={c.id}>{c[lang]}</option>)}</select></label>
      <label className="text-sm">{vi ? 'Tồn kho' : 'Stock'}<select className={`${field} mt-2`} value={stock} onChange={e => { setStock(e.target.value) } }><option value="">{vi ? 'Tất cả' : 'All'}</option><option value="available">{vi ? 'Còn hàng (>20)' : 'In stock (>20)'}</option><option value="low">{vi ? 'Sắp hết (1–20)' : 'Low stock (1–20)'}</option><option value="low_or_out">{vi ? "Tồn kho ≤ 20 (gồm hết hàng)" : "Stock ≤ 20 (including sold out)"}</option><option value="out">{vi ? 'Hết hàng' : 'Out of stock'}</option></select></label>
      <label className="text-sm">{vi ? 'Sắp xếp' : 'Sort'}<select className={`${field} mt-2`} value={sort} onChange={e => { setSort(e.target.value) } }><option value="id">{vi ? 'Mã sản phẩm' : 'Product ID'}</option><option value="stock">{vi ? 'Tồn kho tăng dần' : 'Stock ascending'}</option><option value="price">{vi ? 'Giá tăng dần' : 'Price ascending'}</option></select></label>
    </div><div className="mt-4 flex items-center justify-between text-sm text-slate"><span>{paging.total} {vi ? 'kết quả' : 'results'}</span><button className="underline" onClick={() => { update({ q: '', category: '', stock: '', sort: '' }) }}>{vi ? 'Xóa bộ lọc' : 'Reset filters'}</button></div></section>
    <div className="mt-6 overflow-x-auto rounded-2xl border border-[#dfe3eb] bg-white"><table className="w-full min-w-[650px] text-left text-sm"><thead className="bg-[#eef0ff] text-[#303a9f]"><tr>{(vi ? ['Sản phẩm','Loại','Giá bán','Tồn kho','Trạng thái'] : ['Product','Category','Price','Stock','Status']).map(h => <th key={h} className="p-4">{h}</th>)}</tr></thead><tbody>{!loading && filtered.map(p => <tr key={p.id} className="border-t border-[#e2e5ec]"><td className="p-4"><Link to={`/admin/inventory/products/${p.id}`} state={{ returnTo }} className="flex items-center gap-3"><img src={p.images[0]} alt="" className="h-16 w-12 rounded bg-alabaster object-contain" /><span>{p[lang]}<small className="mt-1 block text-slate">#{p.id}</small></span></Link></td><td className="p-4">{categories.find(c => c.id === p.category)?.[lang] || p.category}</td><td className="p-4 whitespace-nowrap">{formatPrice(p.price)}</td><td className="p-4 font-semibold">{p.stock}</td><td className="p-4"><span className={`rounded-full px-3 py-1 text-xs ${p.stock === 0 ? 'bg-red-50 text-red-700' : p.stock <= 20 ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>{p.stock === 0 ? (vi ? 'Hết hàng' : 'Out of stock') : p.stock <= 20 ? (vi ? 'Sắp hết' : 'Low stock') : (vi ? 'Còn hàng' : 'In stock')}</span></td></tr>)}{(loading || !filtered.length) && <tr><td colSpan={5} className="p-12 text-center text-slate">{loading ? (vi ? 'Đang tải kho…' : 'Loading inventory…') : (vi ? 'Không có sản phẩm phù hợp.' : 'No matching products.')}</td></tr>}</tbody></table></div>
    {!error && <Pagination page={page} pages={paging.pages} total={paging.total} onPage={setPage} busy={loading || busy} />}
    {open && <Popup title={vi ? 'Thêm sản phẩm' : 'Add product'} busy={busy || imageBusy} close={() => setOpen(false)}><form onSubmit={save} className="space-y-4">
      <label className="block text-sm">{vi ? 'Ảnh sản phẩm' : 'Product image'}<input type="file" accept="image/png,image/jpeg,image/webp" onChange={chooseImage} disabled={busy} className="mt-2 block w-full text-sm" /><span className="mt-1 block text-xs text-slate">JPG, PNG, WebP · ≤ 2 MB</span></label>{image && <img src={image} alt={vi ? 'Ảnh xem trước' : 'Preview'} className="mx-auto h-36 w-28 object-contain" />}
      <label className="block text-sm">{vi ? 'Tên sản phẩm' : 'Product name'}<input name="name" required maxLength={160} className={`${field} mt-2`} disabled={busy} /></label>
      <label className="block text-sm">{vi ? 'Tên tiếng Anh' : 'English name'}<input name="name_en" required maxLength={160} disabled={busy} className={`${field} mt-2`} /></label>
      <label className="block text-sm">{vi ? 'Loại sản phẩm' : 'Category'}<select name="category" required className={`${field} mt-2`} disabled={busy}>{categories.map(c => <option key={c.id} value={c.id}>{c[lang]}</option>)}</select></label>
      <div className="grid grid-cols-2 gap-4"><label className="text-sm">{vi ? 'Giá bán (VND)' : 'Price (VND)'}<input type="number" name="price" min="0" max="9007199254740991" step="1" required disabled={busy} className={`${field} mt-2`} /></label><label className="text-sm">{vi ? 'Tồn kho' : 'Stock'}<input type="number" name="stock" min="0" max="2147483647" step="1" defaultValue="500" required disabled={busy} className={`${field} mt-2`} /></label></div>
      <p role="alert" className="text-sm text-red-700">{formError}</p><div className="flex justify-end gap-3"><button type="button" disabled={busy || imageBusy} onClick={() => setOpen(false)} className="button">{vi ? 'Hủy' : 'Cancel'}</button><button disabled={busy || imageBusy || !!pendingCreate} className="button bg-[#303a9f] text-white disabled:opacity-40">{busy ? (vi ? 'Đang lưu…' : 'Saving…') : (vi ? 'Thêm sản phẩm' : 'Add product')}</button></div>
    </form></Popup>}
  </div></main>
}

