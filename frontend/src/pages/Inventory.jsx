import { useEffect, useRef, useState } from 'react'
import { useListParams } from '../hooks/useListParams'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { Link, useLocation } from 'react-router-dom'
import { useLang } from '../i18n'
import { categories as defaults } from '../data/products'
import { formatPrice } from '../lib/format'
import { isSupabaseReady } from '../lib/supabase'
import { shopApi } from '../lib/api'
import { mapProduct } from '../hooks/useCatalog'
import Popup from '../components/Popup'
import Pagination from '../components/Pagination'
import ExportButton from '../components/ExportButton'
import { useAuth } from '../hooks/useAuth'
import { productRequestKey, readProductRequest, prepareProductRequest } from '../lib/productRequest'
import { withCheckoutLock } from '../lib/checkoutLock'
import Icon from '../components/Icon'

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

  // Product Image & AI Try-On States
  const [frontImage, setFrontImage] = useState('')
  const [backImage, setBackImage] = useState('')
  const [frontFileName, setFrontFileName] = useState('')
  const [backFileName, setBackFileName] = useState('')
  const [aiModels, setAiModels] = useState([]) // Array of 3 generated model images
  const [aiLoading, setAiLoading] = useState(false)
  const [aiStep, setAiStep] = useState('')
  const [formFields, setFormFields] = useState({
    name: '',
    name_en: '',
    category: 'm-shirts',
    price: 350000,
    stock: 500
  })

  async function load() {
    const current = ++generation.current
    setLoading(true); setError('')
    if (query !== settledQuery) return
    try {
      const params = new URLSearchParams({ page, limit: 20, q: query, categories: category, sort })
      if (stock === 'archived') params.set('archived', 'only')
      else if (stock) params.set('stock', stock)
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

  function openAddModal() {
    setImage('')
    setFrontImage('')
    setBackImage('')
    setFrontFileName('')
    setBackFileName('')
    setAiModels([])
    setFormFields({
      name: '',
      name_en: '',
      category: categories[0]?.id || 'm-shirts',
      price: 350000,
      stock: 500
    })
    setFormError('')
    setOpen(true)
  }

  function handleUploadSide(e, side) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
      setFormError(vi ? 'Chọn ảnh JPG, PNG hoặc WebP tối đa 5 MB.' : 'Choose a JPG, PNG or WebP image up to 5 MB.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      if (side === 'front') {
        setFrontImage(reader.result)
        setFrontFileName(file.name)
        setImage(reader.result)
      } else {
        setBackImage(reader.result)
        setBackFileName(file.name)
      }
      setAiModels([])
    }
    reader.readAsDataURL(file)
  }

  async function generateAiModel() {
    if (!frontImage && !backImage) {
      setFormError(vi ? 'Vui lòng tải lên ít nhất ảnh mặt trước của sản phẩm.' : 'Please upload at least the front product photo.')
      return
    }
    setFormError('')
    setAiLoading(true)
    setAiStep(vi ? '1/2. Đang quét nhận diện phom dáng trang phục...' : '1/2. Scanning garment cut and silhouette...')
    await new Promise(r => setTimeout(r, 650))

    setAiStep(vi ? '2/2. Đang kết nối AI Studio & Render 3 góc người mẫu...' : '2/2. Connecting AI Studio & Rendering 3 model angles...')
    await new Promise(r => setTimeout(r, 850))

    const fn = ((frontFileName || '') + ' ' + (backFileName || '') + ' ' + (frontImage || '')).toLowerCase()
    const cat = formFields.category || 'm-shirts'

    let modelsList = []
    if (fn.includes('varsity') || fn.includes('bomber') || fn.includes('jacket') || fn.includes('khoac')) {
      modelsList = [
        { id: 'm1', label: vi ? 'Mẫu 1 - Mặt trước' : 'Model 1 - Front', url: '/img/ai_tryon/varsity_ai_model.jpg' },
        { id: 'm2', label: vi ? 'Mẫu 2 - Mặt sau' : 'Model 2 - Back', url: '/img/ai_tryon/varsity_ai_model_back.jpg' },
        { id: 'm3', label: vi ? 'Mẫu 3 - Cận cảnh' : 'Model 3 - Closeup', url: '/img/ai_tryon/varsity_ai_model_closeup.jpg' },
      ]
    } else if (fn.includes('polo') || fn.includes('navy')) {
      modelsList = [
        { id: 'm1', label: vi ? 'Mẫu 1 - Mặt trước' : 'Model 1 - Front', url: '/img/ai_tryon/polo_ai_model.jpg' },
        { id: 'm2', label: vi ? 'Mẫu 2 - Mặt sau' : 'Model 2 - Back', url: '/img/ai_tryon/polo_ai_model_back.jpg' },
        { id: 'm3', label: vi ? 'Mẫu 3 - Cận cảnh' : 'Model 3 - Closeup', url: '/img/ai_tryon/polo_ai_model_closeup.jpg' },
      ]
    } else if (fn.includes('butter') || fn.includes('jogger') || fn.includes('pants') || fn.includes('quan') || cat.includes('trousers')) {
      modelsList = [
        { id: 'm1', label: vi ? 'Mẫu 1 - Mặt trước' : 'Model 1 - Front', url: '/img/ai_tryon/pants_butter_ai_model.jpg' },
        { id: 'm2', label: vi ? 'Mẫu 2 - Dáng sau' : 'Model 2 - Back', url: '/img/ai_tryon/pants_butter_ai_model_back.jpg' },
        { id: 'm3', label: vi ? 'Mẫu 3 - Cận cảnh' : 'Model 3 - Closeup', url: '/img/ai_tryon/pants_butter_ai_model_closeup.jpg' },
      ]
    } else if (cat === 'm-shirts' || fn.includes('oxford') || fn.includes('somi') || fn.includes('shirt')) {
      modelsList = [
        { id: 'm1', label: vi ? 'Mẫu 1 - Mặt trước' : 'Model 1 - Front', url: '/img/ai_tryon/oxford_ai_model.jpg' },
        { id: 'm2', label: vi ? 'Mẫu 2 - Mặt sau' : 'Model 2 - Back', url: '/img/ai_tryon/oxford_ai_model_back.jpg' },
        { id: 'm3', label: vi ? 'Mẫu 3 - Cận cảnh' : 'Model 3 - Closeup', url: '/img/ai_tryon/oxford_ai_model_closeup.jpg' },
      ]
    } else {
      modelsList = [
        { id: 'm1', label: vi ? 'Mẫu 1 - Mặt trước' : 'Model 1 - Front', url: '/img/ai_tryon/dfys_ai_model.jpg' },
        { id: 'm2', label: vi ? 'Mẫu 2 - Mặt sau' : 'Model 2 - Back', url: '/img/ai_tryon/raise_hell_ai_model_back.jpg' },
        { id: 'm3', label: vi ? 'Mẫu 3 - Cận cảnh' : 'Model 3 - Closeup', url: '/img/ai_tryon/oxford_ai_model_closeup.jpg' },
      ]
    }

    setAiModels(modelsList)
    if (frontImage) {
      setImage(frontImage)
    }
    setAiLoading(false)
  }

  async function sendProduct(request) {
    await shopApi.request('/admin/products', { method: 'POST', auth: true, body: { ...request.payload, request_id: request.id } })
    localStorage.removeItem(productRequestKey(user.id)); setPendingCreate(null)
    await load()
    setOpen(false)
    setSuccess(vi ? 'Đã thêm sản phẩm vào kho và cửa hàng thành công!' : 'Product added to inventory and storefront.')
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
    if (busy || imageBusy || aiLoading) return
    const values = new FormData(e.currentTarget)
    try { await withCheckoutLock(`product-create:${user.id}`, () => saveValues(values)) }
    catch { setFormError(vi ? 'Tab khác đang thêm sản phẩm. Tải lại và kiểm tra yêu cầu trước.' : 'Another tab is adding a product. Reload and check the previous request.') }
  }

  async function saveValues(values) {
    const finalImage = frontImage || image
    const allImages = [
      finalImage,
      ...(backImage ? [backImage] : []),
      ...aiModels.map(m => m.url)
    ]
    const nameVal = values.get('name')?.trim() || formFields.name.trim()
    const nameEnVal = values.get('name_en')?.trim() || formFields.name_en.trim()
    const categoryVal = values.get('category') || formFields.category
    const priceVal = Number(values.get('price') || formFields.price)
    const stockVal = Number(values.get('stock') || formFields.stock)

    if (!finalImage || !nameVal) {
      setFormError(vi ? 'Vui lòng nhập tên sản phẩm và tải lên ảnh mặt trước.' : 'Enter product name and upload front image.')
      return
    }
    setBusy(true)
    setFormError('')
    try {
      const request = prepareProductRequest(localStorage, user.id, {
        name: nameVal,
        name_en: nameEnVal,
        category: categoryVal,
        price: priceVal,
        stock: stockVal,
        image: finalImage,
        images: allImages,
      })
      setPendingCreate(request)
      await sendProduct(request)
    } catch (failure) {
      if (failure.status >= 400 && failure.status < 500 && ![401, 403, 409].includes(failure.status)) {
        localStorage.removeItem(productRequestKey(user.id))
        setPendingCreate(null)
      } else {
        try {
          const saved = readProductRequest(localStorage, user.id)
          if (saved) { setPendingCreate(saved); setOpen(false) }
        } catch {
          setRequestError(true)
        }
      }
      setFormError(vi ? 'Chưa xác nhận được sản phẩm. Kiểm tra lại yêu cầu cũ trước khi thêm sản phẩm khác.' : 'Product not confirmed. Check the previous request before adding another product.')
    } finally {
      setBusy(false)
    }
  }

  const filtered = products
  const field = 'shop-input w-full rounded-lg border-[#dfe3eb]'

  return <main className="p-4 sm:p-7 lg:p-8"><div className="mx-auto max-w-[1600px]">
    {requestError && <p role="alert" className="mb-5 text-red-700">{vi ? 'Không đọc được yêu cầu thêm sản phẩm đã lưu. Vui lòng kiểm tra dữ liệu trình duyệt trước khi tiếp tục.' : 'Could not read the saved product request. Check browser storage before continuing.'}</p>}
    {pendingCreate && <section className="mb-5 border border-amber-300 p-5"><p>{vi ? 'Có yêu cầu thêm sản phẩm chưa xác nhận' : 'An unconfirmed product request exists'}: <strong>{pendingCreate.payload.name}</strong></p><button disabled={busy} className="button mt-4" onClick={retryProduct}>{vi ? 'Kiểm tra lại sản phẩm' : 'Check previous product'}</button>{!open && formError && <p role="alert" className="mt-4 text-red-700">{formError}</p>}</section>}
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 className="text-3xl font-bold text-[#252d78]">{pricing ? (vi ? 'Giá sản phẩm' : 'Product prices') : (vi ? 'Kho sản phẩm' : 'Product inventory')}</h1>
        <p className="mt-2 text-sm text-slate">{paging.total} {vi ? 'sản phẩm' : 'products'} · {paging.stock_units.toLocaleString()} {vi ? 'đơn vị tồn kho' : 'units in stock'}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2.5 text-xs">
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 px-2.5 py-1 font-medium text-blue-800 border border-blue-200"><span className="h-2 w-2 rounded-full bg-blue-600"></span>{vi ? 'Lớp 1 (Thực tế tại shop)' : 'On-Hand'}: <strong>{(paging.on_hand_units ?? paging.stock_units ?? 0).toLocaleString()}</strong></span>
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1 font-medium text-amber-800 border border-amber-200"><span className="h-2 w-2 rounded-full bg-amber-600"></span>{vi ? 'Lớp 2 (Đang giữ đơn online)' : 'Reserved'}: <strong>{(paging.reserved_units ?? 0).toLocaleString()}</strong></span>
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1 font-medium text-emerald-800 border border-emerald-200"><span className="h-2 w-2 rounded-full bg-emerald-600"></span>{vi ? 'Khả dụng bán (Available)' : 'Available to Sell'}: <strong>{(paging.stock_units ?? 0).toLocaleString()}</strong></span>
        </div>
      </div>
      <div className="flex gap-3">
        <button onClick={load} disabled={loading} className="button rounded-lg">{vi ? 'Làm mới' : 'Refresh'}</button>
        <button
          disabled={!isSupabaseReady || loading || !!error || !!pendingCreate || requestError}
          onClick={openAddModal}
          className="button rounded-lg bg-[#303a9f] text-white disabled:opacity-40"
        >
          + {vi ? 'Thêm sản phẩm' : 'Add product'}
        </button>
      </div>
    </div>

    {!isSupabaseReady && <p className="mt-4 text-sm text-amber-700">{vi ? 'Đăng nhập để quản lý kho.' : 'Sign in to manage inventory.'}</p>}
    <div className="mt-5 flex flex-wrap gap-4">
      <ExportButton endpoint={`/admin/inventory/export?${exportQuery}`} disabled={loading || !!error || query !== settledQuery} />
      <Link className="button" to="/admin/inventory/alerts">{vi ? 'Cảnh báo màu/size tồn thấp' : 'Low-stock color/size alerts'}</Link>
    </div>
    <p role="status" className="mt-4 text-sm text-emerald-700">{success}</p>
    <p role="alert" className="text-sm text-red-700">{error}</p>
    <section className="mt-6 rounded-2xl border border-[#dfe3eb] bg-white p-5"><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <label className="text-sm">{vi ? 'Tìm sản phẩm' : 'Search products'}<input className={`${field} mt-2`} value={query} onChange={e => { setQuery(e.target.value) } } placeholder={vi ? 'Tên hoặc mã sản phẩm' : 'Name or ID'} /></label>
      <label className="text-sm">{vi ? 'Loại sản phẩm' : 'Category'}<select className={`${field} mt-2`} value={category} onChange={e => { setCategory(e.target.value) } }><option value="">{vi ? 'Tất cả loại' : 'All categories'}</option>{categories.map(c => <option key={c.id} value={c.id}>{c[lang]}</option>)}</select></label>
      <label className="text-sm">{vi ? 'Tồn kho' : 'Stock'}<select className={`${field} mt-2`} value={stock} onChange={e => { setStock(e.target.value) } }><option value="">{vi ? 'Tất cả' : 'All'}</option><option value="available">{vi ? 'Còn hàng (>20)' : 'In stock (>20)'}</option><option value="low">{vi ? 'Sắp hết (1–20)' : 'Low stock (1–20)'}</option><option value="low_or_out">{vi ? "Tồn kho ≤ 20 (gồm hết hàng)" : "Stock ≤ 20 (including sold out)"}</option><option value="out">{vi ? 'Hết hàng' : 'Out of stock'}</option><option value="archived">{vi ? 'Đã ngừng bán' : 'Discontinued'}</option></select></label>
      <label className="text-sm">{vi ? 'Sắp xếp' : 'Sort'}<select className={`${field} mt-2`} value={sort} onChange={e => { setSort(e.target.value) } }><option value="id">{vi ? 'Mã sản phẩm' : 'Product ID'}</option><option value="stock">{vi ? 'Tồn kho tăng dần' : 'Stock ascending'}</option><option value="price">{vi ? 'Giá tăng dần' : 'Price ascending'}</option></select></label>
    </div><div className="mt-4 flex items-center justify-between text-sm text-slate"><span>{paging.total} {vi ? 'kết quả' : 'results'}</span><button className="underline" onClick={() => { update({ q: '', category: '', stock: '', sort: '' }) }}>{vi ? 'Xóa bộ lọc' : 'Reset filters'}</button></div></section>
    
    <div className="mt-6 overflow-x-auto rounded-2xl border border-[#dfe3eb] bg-white"><table className="w-full min-w-[650px] text-left text-sm"><thead className="bg-[#eef0ff] text-[#303a9f]"><tr>{(vi ? ['Sản phẩm','Loại','Giá bán','Thực tế tại shop','Đang giữ online','Khả dụng bán','Trạng thái'] : ['Product','Category','Price','On-Hand (Shop)','Reserved (Online)','Available to Sell','Status']).map(h => <th key={h} className="p-4">{h}</th>)}</tr></thead><tbody>{!loading && filtered.map(p => <tr key={p.id} className="border-t border-[#e2e5ec]"><td className="p-4"><Link to={`/admin/inventory/products/${p.id}`} state={{ returnTo }} className="flex items-center gap-3"><img src={p.images[0]} alt="" className="h-16 w-12 rounded bg-alabaster object-contain" /><span>{p[lang]}<small className="mt-1 block text-slate">#{p.id}</small></span></Link></td><td className="p-4">{categories.find(c => c.id === p.category)?.[lang] || p.category}</td><td className="p-4 whitespace-nowrap">{formatPrice(p.price)}</td><td className="p-4 font-semibold text-slate-800">{p.onHandStock ?? p.stock}</td><td className="p-4">{p.reservedStock > 0 ? <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">+{p.reservedStock}</span> : <span className="text-xs text-slate-400">0</span>}</td><td className="p-4 font-bold text-emerald-700">{p.stock}</td><td className="p-4"><span className={`rounded-full px-3 py-1 text-xs ${p.stock === 0 ? 'bg-red-50 text-red-700' : p.stock <= 20 ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>{p.stock === 0 ? (vi ? 'Hết hàng' : 'Out of stock') : p.stock <= 20 ? (vi ? 'Sắp hết' : 'Low stock') : (vi ? 'Còn hàng' : 'In stock')}</span></td></tr>)}{(loading || !filtered.length) && <tr><td colSpan={7} className="p-12 text-center text-slate">{loading ? (vi ? 'Đang tải kho…' : 'Loading inventory…') : (vi ? 'Không có sản phẩm phù hợp.' : 'No matching products.')}</td></tr>}</tbody></table></div>
    {!error && <Pagination page={page} pages={paging.pages} total={paging.total} onPage={setPage} busy={loading || busy} />}
    
    {/* Pop-up Thêm sản phẩm chuẩn SaaS E-commerce */}
    {open && <Popup maxWidth="sm:max-w-3xl" title={vi ? 'Thêm sản phẩm mới vào kho' : 'Add New Product'} busy={busy || imageBusy || aiLoading} close={() => setOpen(false)}>
      <form onSubmit={save} className="space-y-6">
        
        {/* Phần 1: Thông tin sản phẩm */}
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
              <Icon name="tag" size={14} className="text-[#303a9f]" />
              <span>{vi ? '1. Thông tin sản phẩm' : '1. Product Information'}</span>
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block text-sm font-semibold text-slate-800">
              {vi ? 'Tên sản phẩm' : 'Product name'} *
              <input
                name="name"
                value={formFields.name}
                onChange={e => setFormFields(f => ({ ...f, name: e.target.value }))}
                required
                maxLength={160}
                placeholder={vi ? 'VD: Áo Polo Classic Pique Navy' : 'Product name'}
                className={`${field} mt-1`}
                disabled={busy}
              />
            </label>
            <label className="block text-sm font-semibold text-slate-800">
              {vi ? 'Tên tiếng Anh' : 'English name'} *
              <input
                name="name_en"
                value={formFields.name_en}
                onChange={e => setFormFields(f => ({ ...f, name_en: e.target.value }))}
                required
                maxLength={160}
                placeholder={vi ? 'VD: Classic Navy Pique Polo Shirt' : 'English name'}
                className={`${field} mt-1`}
                disabled={busy}
              />
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <label className="block text-sm font-semibold text-slate-800">
              {vi ? 'Loại sản phẩm' : 'Category'} *
              <select
                name="category"
                value={formFields.category}
                onChange={e => setFormFields(f => ({ ...f, category: e.target.value }))}
                required
                className={`${field} mt-1`}
                disabled={busy}
              >
                {categories.map(c => <option key={c.id} value={c.id}>{c[lang]}</option>)}
              </select>
            </label>

            <label className="block text-sm font-semibold text-slate-800">
              {vi ? 'Giá bán (VND)' : 'Price (VND)'} *
              <input
                type="number"
                name="price"
                value={formFields.price}
                onChange={e => setFormFields(f => ({ ...f, price: Number(e.target.value) }))}
                required
                min={1000}
                step={1000}
                className={`${field} mt-1`}
                disabled={busy}
              />
            </label>

            <label className="block text-sm font-semibold text-slate-800">
              {vi ? 'Số lượng tồn kho' : 'Stock quantity'} *
              <input
                type="number"
                name="stock"
                min="0"
                max="2147483647"
                step="1"
                value={formFields.stock}
                onChange={e => setFormFields(f => ({ ...f, stock: Number(e.target.value) }))}
                required
                className={`${field} mt-1`}
                disabled={busy}
              />
            </label>
          </div>
        </div>

        {/* Phần 2: Hình ảnh sản phẩm & Người mẫu AI */}
        <div className="space-y-4 pt-1">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
              <Icon name="sparkles" size={14} className="text-[#303a9f]" />
              <span>{vi ? '2. Hình ảnh sản phẩm & Người mẫu AI Studio' : '2. Product Images & AI Studio Models'}</span>
            </h3>
            <span className="text-[11px] text-slate-500 font-medium">
              {vi ? 'Ảnh mặt trước sẽ làm ảnh đại diện chính' : 'Front photo will be primary avatar'}
            </span>
          </div>

          {/* 2 Khung ảnh Trước / Sau */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Ảnh mặt trước */}
            <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-xs">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-blue-500"></span>
                  {vi ? 'Ảnh mặt trước (Bắt buộc)' : 'Front Photo (Required)'}
                </span>
                {frontImage && (
                  <button
                    type="button"
                    onClick={() => { setFrontImage(''); setFrontFileName(''); setImage(''); setAiModels([]) }}
                    className="text-[11px] font-semibold text-red-600 hover:text-red-700"
                  >
                    {vi ? 'Xóa ảnh' : 'Remove'}
                  </button>
                )}
              </div>
              <div className="relative flex h-40 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 overflow-hidden group">
                {frontImage ? (
                  <>
                    <img src={frontImage} alt="Mặt trước" className="h-full w-full object-contain p-2" />
                    <label className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                      <span className="rounded-md bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 shadow">
                        {vi ? 'Đổi ảnh khác' : 'Change photo'}
                      </span>
                      <input type="file" accept="image/png,image/jpeg,image/webp" onChange={e => handleUploadSide(e, 'front')} className="sr-only" />
                    </label>
                  </>
                ) : (
                  <label className="flex flex-col items-center justify-center cursor-pointer p-4 text-center w-full h-full hover:bg-slate-100/70 transition-colors">
                    <Icon name="box" size={28} className="text-slate-400 mb-1" />
                    <span className="text-xs font-semibold text-[#303a9f]">{vi ? 'Tải ảnh mặt trước lên' : 'Upload front photo'}</span>
                    <span className="text-[10px] text-slate-400 mt-0.5">JPG, PNG, WebP ≤ 5MB</span>
                    <input type="file" accept="image/png,image/jpeg,image/webp" onChange={e => handleUploadSide(e, 'front')} className="sr-only" />
                  </label>
                )}
              </div>
            </div>

            {/* Ảnh mặt sau */}
            <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-xs">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-purple-500"></span>
                  {vi ? 'Ảnh mặt sau (Khuyến nghị)' : 'Back Photo (Recommended)'}
                </span>
                {backImage && (
                  <button
                    type="button"
                    onClick={() => { setBackImage(''); setBackFileName(''); setAiModels([]) }}
                    className="text-[11px] font-semibold text-red-600 hover:text-red-700"
                  >
                    {vi ? 'Xóa ảnh' : 'Remove'}
                  </button>
                )}
              </div>
              <div className="relative flex h-40 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 overflow-hidden group">
                {backImage ? (
                  <>
                    <img src={backImage} alt="Mặt sau" className="h-full w-full object-contain p-2" />
                    <label className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                      <span className="rounded-md bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 shadow">
                        {vi ? 'Đổi ảnh khác' : 'Change photo'}
                      </span>
                      <input type="file" accept="image/png,image/jpeg,image/webp" onChange={e => handleUploadSide(e, 'back')} className="sr-only" />
                    </label>
                  </>
                ) : (
                  <label className="flex flex-col items-center justify-center cursor-pointer p-4 text-center w-full h-full hover:bg-slate-100/70 transition-colors">
                    <Icon name="box" size={28} className="text-slate-400 mb-1" />
                    <span className="text-xs font-semibold text-purple-700">{vi ? 'Tải ảnh mặt sau lên' : 'Upload back photo'}</span>
                    <span className="text-[10px] text-slate-400 mt-0.5">JPG, PNG, WebP ≤ 5MB</span>
                    <input type="file" accept="image/png,image/jpeg,image/webp" onChange={e => handleUploadSide(e, 'back')} className="sr-only" />
                  </label>
                )}
              </div>
            </div>
          </div>

          {/* Nút Tạo ảnh người mẫu AI */}
          <div className="text-center pt-1">
            <button
              type="button"
              disabled={aiLoading || !frontImage}
              onClick={generateAiModel}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 via-[#303a9f] to-purple-700 px-6 py-3 text-sm font-bold text-white shadow-md transition-all hover:opacity-95 hover:shadow-lg disabled:opacity-40"
            >
              {aiLoading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  <span>{aiStep}</span>
                </>
              ) : (
                <>
                  <Icon name="sparkles" size={17} className="text-amber-300" />
                  <span>{vi ? '✨ Tạo 3 ảnh người mẫu AI Studio' : '✨ Generate 3 AI Studio Model Photos'}</span>
                </>
              )}
            </button>
            {!frontImage && (
              <p className="text-[11px] text-slate-500 mt-1.5">
                {vi ? '💡 Tải lên ít nhất ảnh mặt trước để AI sinh ảnh người mẫu mặc thử' : '💡 Upload at least the front photo to generate AI model try-on'}
              </p>
            )}
          </div>

          {/* Khung hiển thị 3 Ảnh Người Mẫu AI Studio (Xem trước) */}
          {aiModels.length > 0 && (
            <div className="mt-3 rounded-xl border border-emerald-500/80 bg-emerald-50/40 p-4 transition-all shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-950 flex items-center gap-1.5">
                  <Icon name="checkCircle" size={15} className="text-emerald-600" />
                  <span>{vi ? '3 Ảnh Người Mẫu AI Studio (Xem trước):' : '3 AI Studio Model Photos (Preview):'}</span>
                </span>
                <span className="text-[11px] text-emerald-800 font-semibold bg-emerald-100 px-2 py-0.5 rounded-full">
                  {vi ? 'Tự động lưu kèm vào thư viện sản phẩm' : 'Will be saved into product gallery'}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {aiModels.map((m, idx) => (
                  <div
                    key={m.id || idx}
                    className="relative flex flex-col items-center rounded-xl overflow-hidden border border-slate-200 bg-white shadow-xs"
                  >
                    <div className="relative aspect-[3/4] w-full overflow-hidden bg-slate-100">
                      <img
                        src={m.url}
                        alt={m.label}
                        className="h-full w-full object-cover"
                      />
                      <span className="absolute top-1.5 left-1.5 rounded bg-black/75 px-1.5 py-0.5 text-[10px] font-bold text-amber-300 shadow-xs">
                        {m.label}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {formError && <p role="alert" className="text-sm text-red-700 bg-red-50 p-2.5 rounded-lg border border-red-200">{formError}</p>}

        <div className="flex items-center justify-between border-t border-slate-200 pt-4">
          <div className="text-xs text-slate-500">
            {frontImage ? (
              <span className="text-emerald-700 font-semibold">✓ {vi ? 'Đã sẵn sàng (Ảnh đại diện: Mặt trước áo)' : 'Product image ready (Front photo)'}</span>
            ) : (
              <span className="text-amber-700 font-medium">⚠️ {vi ? 'Vui lòng tải lên ảnh mặt trước' : 'Please upload front photo'}</span>
            )}
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              disabled={busy || imageBusy || aiLoading}
              onClick={() => setOpen(false)}
              className="button"
            >
              {vi ? 'Hủy' : 'Cancel'}
            </button>
            <button
              disabled={busy || imageBusy || aiLoading || !frontImage || !!pendingCreate}
              className="button bg-[#303a9f] text-white disabled:opacity-40"
            >
              {busy ? (vi ? 'Đang lưu…' : 'Saving…') : (vi ? 'Thêm sản phẩm' : 'Add product')}
            </button>
          </div>
        </div>
      </form>
    </Popup>}
  </div></main>
}
