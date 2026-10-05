import DevelopmentButton from '../components/DevelopmentButton'
import WishlistButton from '../components/WishlistButton'
import { useEffect, useMemo, useState } from 'react'
import { useListParams } from '../hooks/useListParams'
import { Link, useLocation } from 'react-router-dom'
import Icon from '../components/Icon'
import { useLang } from '../i18n'
import { usePagedProducts } from '../hooks/usePagedProducts'
import Pagination from '../components/Pagination'
import { formatPrice } from '../data/products'

const PAGE = 12
const sorts = ['featured', 'new', 'priceAsc', 'priceDesc']
const sortLabel = { featured: 'plp.sortFeatured', new: 'plp.sortNew', priceAsc: 'plp.sortPriceAsc', priceDesc: 'plp.sortPriceDesc' }

function toggle(list, value) {
  return list.includes(value) ? list.filter(x => x !== value) : [...list, value]
}

function ProductCard({ product, colors, lang, t }) {
  const location = useLocation()
  const returnTo = location.pathname + location.search
  const [hover, setHover] = useState(false)
  const [variant, setVariant] = useState(0)
  // images[i] là ảnh của colors[i]; sản phẩm 1 màu thì chỉ có 1 ảnh
  const image = product.images[variant] ?? product.images[0]
  return <article onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} className="group">
    <div className="product-image-surface relative isolate aspect-[3/4] overflow-hidden">
      <Link to={`/product/${product.id}`} state={{ returnTo }} aria-label={product[lang]} className="absolute inset-0"><img src={image} alt={product[lang]} loading="lazy" className={`absolute inset-0 h-full w-full object-contain product-image-blend transition-transform duration-[900ms] ease-soft ${hover ? 'scale-105' : 'scale-100'}`} /></Link>
      {product.isNew && <span className="absolute left-4 top-4 bg-white px-3 py-1 text-[9px] tracking-[.2em] uppercase">{t('plp.new')}</span>}
      <WishlistButton productId={product.id} className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center bg-transparent transition hover:bg-white/70 focus-visible:bg-white/90" />
      <DevelopmentButton className="absolute inset-x-0 bottom-0 flex translate-y-full items-center justify-center gap-2 bg-obsidian/90 py-3 text-[10px] tracking-[.18em] text-white uppercase transition-transform duration-500 ease-soft group-hover:translate-y-0"><Icon name="scan" size={14} />{t('plp.tryon')}</DevelopmentButton>
    </div>
    <div className="pt-4">
      <h3 className="text-[13px] leading-5"><Link to={`/product/${product.id}`} state={{ returnTo }}>{product[lang]}</Link></h3>
      <p className="mt-1.5 text-[12px] text-charcoal">{formatPrice(product.price)}</p>
      <div className="mt-2.5 flex items-center gap-1.5">
        {product.colors.map((c, i) => {
          const def = colors.find(x => x.id === c)
          return <button key={c} onClick={() => setVariant(i)} onMouseEnter={() => setVariant(i)} aria-label={def?.[lang] ?? c} aria-pressed={variant === i}
            className="-m-1 grid h-6 w-6 place-items-center rounded-full">
            <span className={`block h-3.5 w-3.5 rounded-full border transition ${variant === i ? 'border-obsidian ring-1 ring-obsidian ring-offset-1' : 'border-obsidian/20 hover:border-obsidian/50'}`}
              style={{ background: def?.hex }} />
          </button>
        })}
        {product.colors.length > 1 && <span className="ml-1 text-[10px] text-stone">{product.colors.length} {t('plp.colorsCount')}</span>}
      </div>
    </div>
  </article>
}

function FilterGroup({ title, children }) {
  return <div className="border-b border-feather py-6">
    <p className="eyebrow mb-4 text-taupe">{title}</p>
    {children}
  </div>
}

export default function ProductList({ department, searchQuery }) {
  const { lang, t } = useLang()
  const searching = searchQuery !== undefined
  const departmentLabel = department || 'products'
  const [openFilters, setOpenFilters] = useState(false)
  const [cats, setCats] = useState([])
  const [cols, setCols] = useState([])
  const [szs, setSzs] = useState([])
  const { params, page, setPage, update } = useListParams()
  const queryString = params.toString()
  const appliedFilters = useMemo(() => ({ cats: (params.get('categories') || '').split(',').filter(Boolean), cols: (params.get('colors') || '').split(',').filter(Boolean), szs: (params.get('sizes') || '').split(',').filter(Boolean) }), [queryString])
  const setAppliedFilters = values => update({ categories: values.cats.join(','), colors: values.cols.join(','), sizes: values.szs.join(',') })
  const sort = params.get('sort') || 'featured'
  const setSort = value => update({ sort: value })
  const { products, categories, colors, sizes, loading, error, total, pages } = usePagedProducts({ department, q: searchQuery, page, limit: PAGE, sort, categories: appliedFilters.cats.join(','), colors: appliedFilters.cols.join(','), sizes: appliedFilters.szs.join(',') })
  useEffect(() => { if (!loading && page > pages) setPage(pages) }, [loading, page, pages])
  const [density, setDensity] = useState(3)

  useEffect(() => { window.scrollTo(0, 0) }, [department, searchQuery])
  useEffect(() => {
    setCats([]); setCols([]); setSzs([])
    setOpenFilters(false)
  }, [department, searchQuery])
  useEffect(() => {
    if (!openFilters) return
    const onKey = e => { if (e.key === 'Escape') setOpenFilters(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [openFilters])

  const filtered = products
  const active = appliedFilters.cats.length + appliedFilters.cols.length + appliedFilters.szs.length
  const grid = { 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-2 lg:grid-cols-3', 4: 'sm:grid-cols-2 lg:grid-cols-4' }[density]

  return <main className="bg-background pb-24">
    <div className="shell px-4 pt-8 sm:px-5 sm:pt-10 md:px-8">
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-[10px] tracking-[.18em] text-stone uppercase">
        <Link to="/" className="hover:text-obsidian">{t('plp.home')}</Link><span>/</span><span className="text-obsidian">{searching ? t('search.title') : t(`nav.${departmentLabel}`)}</span>
      </nav>
      <h1 className="display-title mt-6 text-[clamp(1.6rem,3vw,2.25rem)]">{searching ? t('search.title') : t(`plp.title.${departmentLabel}`)}</h1>
      <p className="mt-4 max-w-xl text-sm leading-7 text-stone">{searching ? (searchQuery ? t('search.for').replace('{query}', searchQuery) : t('search.all')) : t(`plp.intro.${departmentLabel}`)}</p>
    </div>

    <div className="sticky top-16 z-30 mt-8 border-y sm:top-20 border-feather bg-background/95 backdrop-blur">
      <div className="shell flex flex-wrap items-center justify-between gap-x-4 gap-y-3 px-4 py-3 sm:px-5 sm:py-4 md:px-8">
      <button onClick={() => {
        setCats(appliedFilters.cats); setCols(appliedFilters.cols); setSzs(appliedFilters.szs)
        setOpenFilters(true)
      }} className="flex items-center gap-3 text-[11px] tracking-[.18em] uppercase">
        <Icon name="sliders" size={16} />{t('plp.filter')}{active > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-obsidian px-1.5 text-[10px] text-white">{active}</span>}
      </button>
      <p className="hidden text-[11px] tracking-[.15em] text-stone uppercase sm:block">{total} {t('plp.count')}</p>
      <div className="flex items-center gap-5">
        <div className="hidden items-center gap-2 lg:flex" role="group" aria-label={t('plp.density')}>
          {[2, 3, 4].map(n => <button key={n} onClick={() => setDensity(n)} aria-pressed={density === n} className={`text-[11px] tracking-[.1em] ${density === n ? 'text-obsidian underline underline-offset-4' : 'text-stone hover:text-obsidian'}`}>{n}</button>)}
        </div>
        <label className="flex items-center gap-2 text-[11px] tracking-[.18em] uppercase">
          <span className="hidden sm:inline">{t('plp.sort')}</span>
          <select value={sort} onChange={e => { setSort(e.target.value) }} className="border-b border-obsidian/30 bg-transparent py-1 text-[11px] tracking-[.12em] focus:outline-none">
            {sorts.map(s => <option key={s} value={s}>{t(sortLabel[s])}</option>)}
          </select>
        </label>
      </div>
      </div>
    </div>

    {error && <p className="shell px-4 pt-6 text-xs text-champagne sm:px-5 md:px-8">{t('plp.offline')}</p>}

    {loading
      ? <div className={`shell grid grid-cols-2 gap-x-4 gap-y-10 px-4 pt-8 sm:gap-x-5 sm:gap-y-12 sm:px-5 sm:pt-10 md:px-8 ${grid}`}>
        {Array.from({ length: 6 }, (_, i) => <div key={i}><div className="aspect-[3/4] animate-pulse bg-muted" /><div className="mt-4 h-3 w-2/3 animate-pulse bg-muted" /><div className="mt-2 h-3 w-1/3 animate-pulse bg-muted" /></div>)}
      </div>
      : filtered.length === 0
      ? <p className="shell px-4 py-24 text-center text-sm text-stone sm:px-5 md:px-8">{t('plp.empty')}</p>
      : <>
        <div className={`shell grid grid-cols-2 gap-x-4 gap-y-10 px-4 pt-8 sm:gap-x-5 sm:gap-y-12 sm:px-5 sm:pt-10 md:px-8 ${grid}`}>
          {filtered.map(p => <ProductCard key={p.id} product={p} colors={colors} lang={lang} t={t} />)}
        </div>
        <Pagination page={page} pages={pages} total={total} busy={loading} onPage={value => { setPage(value); window.scrollTo(0, 0) }} />
      </>}

    <div onClick={() => setOpenFilters(false)} className={`fixed inset-0 z-55 bg-obsidian/40 transition-opacity duration-500 ease-soft ${openFilters ? 'opacity-100' : 'pointer-events-none opacity-0'}`} aria-hidden="true" />
    <aside className={`fixed inset-y-0 left-0 z-60 flex w-full flex-col bg-white shadow-2xl transition-transform duration-550 ease-soft will-change-transform sm:w-105 ${openFilters ? 'translate-x-0' : '-translate-x-full'}`} aria-hidden={!openFilters}>
      <div className="flex items-center justify-between border-b border-feather px-8 py-6">
        <p className="text-sm tracking-[.18em] uppercase">{t('plp.filters')}</p>
        <button onClick={() => setOpenFilters(false)} aria-label={t('nav.close')} tabIndex={openFilters ? 0 : -1}><Icon name="close" size={20} /></button>
      </div>
      <div className="flex-1 overflow-y-auto px-8">
        <FilterGroup title={t('plp.category')}>
          <div className="flex flex-col gap-3">
            {categories.map(c => <label key={c.id} className="flex items-center gap-3 text-[13px]">
              <input type="checkbox" checked={cats.includes(c.id)} onChange={() => setCats(toggle(cats, c.id))} tabIndex={openFilters ? 0 : -1} className="h-4 w-4 accent-obsidian" />{c[lang]}
            </label>)}
          </div>
        </FilterGroup>
        <FilterGroup title={t('plp.color')}>
          <div className="flex flex-wrap gap-3">
            {colors.map(c => <button key={c.id} onClick={() => setCols(toggle(cols, c.id))} aria-pressed={cols.includes(c.id)} tabIndex={openFilters ? 0 : -1} className={`flex items-center gap-2 border px-3 py-2 text-[11px] ${cols.includes(c.id) ? 'border-obsidian' : 'border-feather'}`}>
              <span className="h-3.5 w-3.5 rounded-full border border-obsidian/15" style={{ background: c.hex }} />{c[lang]}
            </button>)}
          </div>
        </FilterGroup>
        {sizes.length > 0 && <FilterGroup title={t('plp.size')}>
          <div className="flex flex-wrap gap-2">
            {sizes.map(s => <button key={s} onClick={() => setSzs(toggle(szs, s))} aria-pressed={szs.includes(s)} tabIndex={openFilters ? 0 : -1} className={`h-10 w-12 border text-[12px] ${szs.includes(s) ? 'border-obsidian bg-obsidian text-white' : 'border-feather'}`}>{s}</button>)}
          </div>
        </FilterGroup>}
      </div>
      <div className="flex items-center gap-4 border-t border-feather px-8 py-5">
        <button onClick={() => { setCats([]); setCols([]); setSzs([]) }} tabIndex={openFilters ? 0 : -1} className="text-[11px] tracking-[.15em] text-stone underline underline-offset-4 uppercase">{t('plp.clear')}</button>
        <button onClick={() => {
          setAppliedFilters({ cats, cols, szs })
          setOpenFilters(false)
        }} tabIndex={openFilters ? 0 : -1} className="button button--sm ml-auto">{t('plp.apply')}</button>
      </div>
    </aside>
  </main>
}
