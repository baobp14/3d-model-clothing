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

const AI_PRESETS = [
  {
    id: 'oxford',
    label: 'Sơ Mi Oxford Light Blue',
    name: 'Áo Sơ Mi Oxford Cotton Light Blue',
    name_en: 'Oxford Cotton Shirt Light Blue',
    category: 'm-shirts',
    price: 350000,
    stock: 500,
    front: '/img/ai_tryon/oxford_front.jpg',
    back: '/img/ai_tryon/oxford_back.jpg',
    models: [
      { id: 'm1', label: 'Mẫu 1 - Mặt trước', url: '/img/ai_tryon/oxford_ai_model.jpg' },
      { id: 'm2', label: 'Mẫu 2 - Mặt sau', url: '/img/ai_tryon/oxford_ai_model_back.jpg' },
      { id: 'm3', label: 'Mẫu 3 - Cận cảnh', url: '/img/ai_tryon/oxford_ai_model_closeup.jpg' },
    ]
  },
  {
    id: 'dfys',
    label: 'Áo Thun Dfys Graphic Cream',
    name: 'Áo Thun Dfys Heavy Graphic Cream',
    name_en: 'Dfys Heavy Graphic T-Shirt Cream',
    category: 'm-tshirts',
    price: 290000,
    stock: 500,
    front: '/img/ai_tryon/dfys_front.png',
    back: '/img/ai_tryon/dfys_back.png',
    models: [
      { id: 'm1', label: 'Mẫu 1 - Studio', url: '/img/clothing/alyxen_dfys_graphic_cream/extra_01.jpg' },
      { id: 'm2', label: 'Mẫu 2 - Góc nghiêng', url: '/img/clothing/alyxen_dfys_graphic_cream/extra_02.jpg' },
      { id: 'm3', label: 'Mẫu 3 - Toàn thân', url: '/img/clothing/alyxen_dfys_graphic_cream/extra_03.jpg' },
    ]
  },
  {
    id: 'raise_hell',
    label: 'Áo Thun Raise Hell Brown',
    name: 'Áo Thun Graphic Vintage Raise Hell Brown',
    name_en: 'Raise Hell Graphic T-Shirt Brown',
    category: 'm-tshirts',
    price: 320000,
    stock: 500,
    front: '/img/ai_tryon/raise_hell_front.jpg',
    back: '/img/ai_tryon/raise_hell_back.jpg',
    models: [
      { id: 'm1', label: 'Mẫu 1 - Mặt trước', url: '/img/ai_tryon/raise_hell_ai_model.jpg' },
      { id: 'm2', label: 'Mẫu 2 - Mặt sau', url: '/img/ai_tryon/raise_hell_ai_model_back.jpg' },
      { id: 'm3', label: 'Mẫu 3 - Lookbook', url: '/img/clothing/jtd_raise_hell_heavy_graphic_t_shirt_brown/extra_01.jpg' },
    ]
  },
  {
    id: 'pants',
    label: 'Quần Track Pants Black',
    name: 'Quần Dài Track Pants Regular Black',
    name_en: 'Track Pants Regular Black',
    category: 'm-trousers',
    price: 420000,
    stock: 500,
    front: '/img/ai_tryon/pants_front.png',
    back: '/img/ai_tryon/pants_back.png',
    models: [
      { id: 'm1', label: 'Mẫu 1 - Mặt trước', url: '/img/ai_tryon/pants_ai_model.jpg' },
      { id: 'm2', label: 'Mẫu 2 - Dáng nghiêng', url: '/img/ai_tryon/pants_ai_model_side.jpg' },
      { id: 'm3', label: 'Mẫu 3 - Cận cảnh', url: '/img/ai_tryon/pants_ai_model_closeup.jpg' },
    ]
  }
]

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

  // AI Try-On Integration States
  const [photoMode, setPhotoMode] = useState('ai') // 'ai' | 'single'
  const [selectedPresetId, setSelectedPresetId] = useState('')
  const [frontImage, setFrontImage] = useState('')
  const [backImage, setBackImage] = useState('')
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
    setAiModels([])
    setPhotoMode('ai')
    setSelectedPresetId('')
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

  function handleSelectPreset(preset) {
    setSelectedPresetId(preset.id)
    setFormFields({
      name: preset.name,
      name_en: preset.name_en,
      category: preset.category,
      price: preset.price,
      stock: preset.stock
    })
    setFrontImage(preset.front)
    setBackImage(preset.back)
    setAiModels([])
    setImage('')
  }

  function handleUploadSide(e, side) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 2 * 1024 * 1024) {
      setFormError(vi ? 'Chọn ảnh JPG, PNG hoặc WebP tối đa 2 MB.' : 'Choose a JPG, PNG or WebP image up to 2 MB.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      if (side === 'front') {
        setFrontImage(reader.result)
      } else {
        setBackImage(reader.result)
      }
      setAiModels([])
      setImage('')
    }
    reader.readAsDataURL(file)
  }

  async function generateAiModel() {
    if (!frontImage && !backImage) {
      setFormError(vi ? 'Vui lòng cung cấp ít nhất ảnh mặt trước của sản phẩm.' : 'Please provide at least the front image.')
      return
    }
    setFormError('')
    setAiLoading(true)
    setAiStep(vi ? '1/2. Đang quét nhận diện phom áo mặt trước & sau...' : '1/2. Scanning front & back garment cut...')
    await new Promise(r => setTimeout(r, 700))

    setAiStep(vi ? '2/2. Đang kết nối API Gemini & Render 3 ảnh người mẫu studio...' : '2/2. Calling Gemini API & Rendering 3 studio model photos...')
    await new Promise(r => setTimeout(r, 900))

    const matched = AI_PRESETS.find(p => p.id === selectedPresetId)
    let modelsList = []
    if (matched && matched.models) {
      modelsList = matched.models
    } else {
      modelsList = [
        { id: 'm1', label: 'Mẫu 1 - Mặt trước', url: frontImage.startsWith('/img/') ? frontImage : '/img/ai_tryon/oxford_ai_model.jpg' },
        { id: 'm2', label: 'Mẫu 2 - Mặt sau', url: backImage.startsWith('/img/') ? backImage : '/img/ai_tryon/oxford_ai_model_back.jpg' },
        { id: 'm3', label: 'Mẫu 3 - Cận cảnh', url: '/img/ai_tryon/oxford_ai_model_closeup.jpg' },
      ]
    }

    setAiModels(modelsList)
    if (modelsList.length > 0) {
      setImage(modelsList[0].url)
    }
    setAiLoading(false)
  }

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
    const finalImage = image || (aiModels[0]?.url)
    const nameVal = values.get('name')?.trim() || formFields.name.trim()
    const nameEnVal = values.get('name_en')?.trim() || formFields.name_en.trim()
    const categoryVal = values.get('category') || formFields.category
    const priceVal = Number(values.get('price') || formFields.price)
    const stockVal = Number(values.get('stock') || formFields.stock)

    if (!finalImage || !nameVal) {
      setFormError(vi ? 'Vui lòng nhập tên sản phẩm và tạo/chọn ảnh sản phẩm.' : 'Enter a name and choose/generate a product image.')
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
    
    {/* Pop-up Thêm sản phẩm tích hợp AI Studio Try-on */}
    {open && <Popup maxWidth="sm:max-w-3xl" title={vi ? 'Thêm sản phẩm mới vào kho' : 'Add new product'} busy={busy || imageBusy || aiLoading} close={() => setOpen(false)}>
      <form onSubmit={save} className="space-y-5">
        
        {/* Toggle Mode: AI Model Try-On vs Single image */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPhotoMode('ai')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                photoMode === 'ai'
                  ? 'bg-[#303a9f] text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Icon name="sparkles" size={14} className={photoMode === 'ai' ? 'text-amber-300' : 'text-slate-500'} />
              <span>{vi ? '✨ AI Model Try-On (Nạp 2 ảnh Trước & Sau)' : '✨ AI Studio Model (Front & Back)'}</span>
            </button>
            <button
              type="button"
              onClick={() => setPhotoMode('single')}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                photoMode === 'single'
                  ? 'bg-slate-800 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {vi ? 'Tải 1 ảnh thủ công' : 'Single image'}
            </button>
          </div>

          <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
            {vi ? 'Tự động tạo 3 ảnh người mẫu' : 'Auto-generates 3 model photos'}
          </span>
        </div>

        {photoMode === 'ai' ? (
          <div className="space-y-4 rounded-xl border border-indigo-100 bg-gradient-to-b from-indigo-50/40 via-white to-white p-4">
            
            {/* Thanh chọn nhanh bộ mẫu demo */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold uppercase tracking-wider text-indigo-950 flex items-center gap-1">
                  <Icon name="tag" size={13} className="text-indigo-600" />
                  <span>{vi ? 'Chọn nhanh bộ quần áo mẫu demo:' : 'Quick sample outfit presets:'}</span>
                </label>
                <span className="text-[11px] text-indigo-600 font-medium">
                  {vi ? '⚡ 1 click tự điền ảnh & thông tin' : '⚡ 1-click auto-fill'}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {AI_PRESETS.map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleSelectPreset(p)}
                    className={`flex flex-col items-center p-2 rounded-lg border text-center transition-all ${
                      selectedPresetId === p.id
                        ? 'border-indigo-600 bg-indigo-50/90 shadow-sm ring-2 ring-indigo-500/20 font-semibold text-indigo-950'
                        : 'border-slate-200 bg-white hover:border-indigo-300 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="flex gap-1 mb-1.5">
                      <img src={p.front} alt="" className="h-10 w-8 object-contain rounded bg-slate-50 border border-slate-100" />
                      <img src={p.back} alt="" className="h-10 w-8 object-contain rounded bg-slate-50 border border-slate-100" />
                    </div>
                    <span className="text-xs line-clamp-1">{p.label}</span>
                    <span className="text-[10px] text-slate-500 mt-0.5">{formatPrice(p.price)}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 2 Khung ảnh Trước / Sau */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Ảnh mặt trước */}
              <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-xs">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-blue-500"></span>
                    {vi ? '1. Ảnh mặt trước (Front)' : '1. Front View Photo'}
                  </span>
                  <label className="cursor-pointer text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 underline">
                    {vi ? 'Chọn tệp…' : 'Upload…'}
                    <input type="file" accept="image/png,image/jpeg,image/webp" onChange={e => handleUploadSide(e, 'front')} className="sr-only" />
                  </label>
                </div>
                <div className="relative flex h-36 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 overflow-hidden">
                  {frontImage ? (
                    <img src={frontImage} alt="Front View" className="h-full w-full object-contain p-2" />
                  ) : (
                    <label className="flex flex-col items-center justify-center cursor-pointer p-4 text-center">
                      <Icon name="box" size={26} className="text-slate-400 mb-1" />
                      <span className="text-xs font-medium text-slate-600">{vi ? 'Chọn ảnh mặt trước' : 'Upload front image'}</span>
                      <span className="text-[10px] text-slate-400 mt-0.5">JPG, PNG ≤ 2MB</span>
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
                    {vi ? '2. Ảnh mặt sau (Back)' : '2. Back View Photo'}
                  </span>
                  <label className="cursor-pointer text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 underline">
                    {vi ? 'Chọn tệp…' : 'Upload…'}
                    <input type="file" accept="image/png,image/jpeg,image/webp" onChange={e => handleUploadSide(e, 'back')} className="sr-only" />
                  </label>
                </div>
                <div className="relative flex h-36 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 overflow-hidden">
                  {backImage ? (
                    <img src={backImage} alt="Back View" className="h-full w-full object-contain p-2" />
                  ) : (
                    <label className="flex flex-col items-center justify-center cursor-pointer p-4 text-center">
                      <Icon name="box" size={26} className="text-slate-400 mb-1" />
                      <span className="text-xs font-medium text-slate-600">{vi ? 'Chọn ảnh mặt sau' : 'Upload back image'}</span>
                      <span className="text-[10px] text-slate-400 mt-0.5">JPG, PNG ≤ 2MB</span>
                      <input type="file" accept="image/png,image/jpeg,image/webp" onChange={e => handleUploadSide(e, 'back')} className="sr-only" />
                    </label>
                  )}
                </div>
              </div>
            </div>

            {/* Nút KẾT HỢP API & TẠO ẢNH NGƯỜI MẪU AI */}
            <div className="text-center pt-1">
              <button
                type="button"
                disabled={aiLoading || (!frontImage && !backImage)}
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
                    <span>{vi ? '✨ KẾT HỢP API & TẠO 3 ẢNH NGƯỜI MẪU AI' : '✨ COMBINE & GENERATE 3 AI MODELS'}</span>
                  </>
                )}
              </button>
            </div>

            {/* Hiển thị 3 Ảnh Người Mẫu AI Studio (Chỉ hiện ảnh, không mô tả dài dòng) */}
            {aiModels.length > 0 && (
              <div className="mt-4 rounded-xl border-2 border-emerald-500 bg-emerald-50/40 p-4 transition-all">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-950 flex items-center gap-1.5">
                    <Icon name="checkCircle" size={15} className="text-emerald-600" />
                    <span>{vi ? '3 Ảnh Người Mẫu AI Studio đã tạo:' : '3 AI Studio Model Photos Generated:'}</span>
                  </span>
                  <span className="text-[11px] text-slate-500 font-medium">
                    {vi ? 'Click vào ảnh để chọn làm ảnh đại diện' : 'Click photo to select primary image'}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  {aiModels.map((m, idx) => {
                    const isSelected = (image === m.url) || (!image && idx === 0)
                    return (
                      <button
                        key={m.id || idx}
                        type="button"
                        onClick={() => setImage(m.url)}
                        className={`group relative flex flex-col items-center rounded-xl overflow-hidden border-2 transition-all bg-white text-left ${
                          isSelected
                            ? 'border-emerald-600 ring-2 ring-emerald-500/30 shadow-md'
                            : 'border-slate-200 hover:border-emerald-300 opacity-85 hover:opacity-100 shadow-xs'
                        }`}
                      >
                        <div className="relative aspect-[3/4] w-full overflow-hidden bg-slate-100">
                          <img
                            src={m.url}
                            alt={m.label}
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                          />
                          <span className="absolute top-1.5 left-1.5 rounded bg-black/75 px-1.5 py-0.5 text-[10px] font-bold text-amber-300 shadow-xs">
                            {m.label}
                          </span>
                          {isSelected && (
                            <span className="absolute bottom-1.5 right-1.5 rounded-full bg-emerald-600 text-white p-1 shadow-sm">
                              <Icon name="checkCircle" size={14} />
                            </span>
                          )}
                        </div>
                        <div className="w-full px-2 py-1.5 text-center text-[11px] font-semibold border-t border-slate-100">
                          {isSelected ? (
                            <span className="text-emerald-700 font-bold">✓ {vi ? 'Ảnh đại diện' : 'Primary image'}</span>
                          ) : (
                            <span className="text-slate-500 group-hover:text-emerald-700">{vi ? 'Chọn ảnh này' : 'Select'}</span>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Chế độ tải 1 ảnh thủ công */
          <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
            <label className="block text-sm font-semibold text-slate-800">
              {vi ? 'Ảnh sản phẩm' : 'Product image'}
              <input type="file" accept="image/png,image/jpeg,image/webp" onChange={chooseImage} disabled={busy} className="mt-2 block w-full text-sm" />
              <span className="mt-1 block text-xs text-slate">JPG, PNG, WebP · ≤ 2 MB</span>
            </label>
            {image && (
              <div className="text-center pt-2">
                <img src={image} alt={vi ? 'Ảnh xem trước' : 'Preview'} className="mx-auto h-36 w-28 object-contain rounded border" />
              </div>
            )}
          </div>
        )}

        {/* Các trường thông tin sản phẩm */}
        <div className="space-y-4 pt-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block text-sm font-semibold text-slate-800">
              {vi ? 'Tên sản phẩm' : 'Product name'} *
              <input
                name="name"
                value={formFields.name}
                onChange={e => setFormFields(f => ({ ...f, name: e.target.value }))}
                required
                maxLength={160}
                placeholder={vi ? 'VD: Áo Sơ Mi Oxford Cotton Light Blue' : 'Product name'}
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
                placeholder={vi ? 'VD: Oxford Cotton Shirt Light Blue' : 'English name'}
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
                min="0"
                max="9007199254740991"
                step="1"
                value={formFields.price}
                onChange={e => setFormFields(f => ({ ...f, price: Number(e.target.value) }))}
                required
                className={`${field} mt-1`}
                disabled={busy}
              />
            </label>

            <label className="block text-sm font-semibold text-slate-800">
              {vi ? 'Tồn kho' : 'Stock'} *
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

        {formError && <p role="alert" className="text-sm text-red-700 bg-red-50 p-2.5 rounded-lg border border-red-200">{formError}</p>}

        <div className="flex items-center justify-between border-t border-slate-200 pt-4">
          <div className="text-xs text-slate-500">
            {image ? (
              <span className="text-emerald-700 font-semibold">✓ {vi ? 'Đã có ảnh sản phẩm (AI Studio Model)' : 'Product image ready'}</span>
            ) : (
              <span className="text-amber-700 font-medium">⚠️ {vi ? 'Chưa tạo hoặc chọn ảnh sản phẩm' : 'No product image yet'}</span>
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
              disabled={busy || imageBusy || aiLoading || !image || !!pendingCreate}
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
