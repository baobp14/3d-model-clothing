import { useEffect, useMemo, useState } from 'react'
import { useListParams } from '../hooks/useListParams'
import { Link } from 'react-router-dom'
import Icon from '../components/Icon'
import { useLang } from '../i18n'
import { usePagedProducts } from '../hooks/usePagedProducts'
import Pagination from '../components/Pagination'
import ProductGrid from '../components/ProductGrid'
import FilterDrawer from '../components/FilterDrawer'
import EmptyState from '../components/ui/EmptyState'
import { categories as localCategories } from '../data/products'

const PAGE = 12
const sorts = ['featured', 'new', 'priceAsc', 'priceDesc']
const sortLabel = { featured: 'plp.sortFeatured', new: 'plp.sortNew', priceAsc: 'plp.sortPriceAsc', priceDesc: 'plp.sortPriceDesc' }
// Số cột ở laptop/desktop; điện thoại luôn 2 cột, tablet 3 cột
const densityColumns = { 2: 'md:grid-cols-3 lg:grid-cols-2', 3: 'md:grid-cols-3', 4: 'md:grid-cols-3 xl:grid-cols-4' }
const empty = { cats: [], cols: [], szs: [] }

export default function ProductList({ department, searchQuery }) {
  const { lang, t } = useLang()
  const searching = searchQuery !== undefined
  const departmentLabel = department || 'products'
  const [openFilters, setOpenFilters] = useState(false)
  const [draft, setDraft] = useState(empty)
  const { params, page, setPage, update } = useListParams()
  const queryString = params.toString()
  const applied = useMemo(() => ({ cats: (params.get('categories') || '').split(',').filter(Boolean), cols: (params.get('colors') || '').split(',').filter(Boolean), szs: (params.get('sizes') || '').split(',').filter(Boolean) }), [queryString])
  const apply = values => update({ categories: values.cats.join(','), colors: values.cols.join(','), sizes: values.szs.join(',') })
  const sort = params.get('sort') || 'featured'
  const result = usePagedProducts({ department, q: searchQuery, page, limit: PAGE, sort, categories: applied.cats.join(','), colors: applied.cols.join(','), sizes: applied.szs.join(',') })
  const { products, categories, colors, sizes, loading, error, total, pages } = result
  // Chỉ hiện màu có sản phẩm trong khu vực đang xem (audit H6). API cũ chưa có color_options thì giữ danh sách cũ.
  const filterColors = Array.isArray(result.color_options) ? colors.filter(c => result.color_options.includes(c.id) || applied.cols.includes(c.id)) : colors
  useEffect(() => { if (!loading && page > pages) setPage(pages) }, [loading, page, pages])
  const [density, setDensity] = useState(4)

  useEffect(() => { window.scrollTo(0, 0) }, [department, searchQuery])
  useEffect(() => { setDraft(empty); setOpenFilters(false) }, [department, searchQuery])

  const active = applied.cats.length + applied.cols.length + applied.szs.length
  const chips = [
    ...applied.cats.map(id => ({ key: 'cats', id, name: categories.find(c => c.id === id)?.[lang] || id })),
    ...applied.cols.map(id => ({ key: 'cols', id, name: colors.find(c => c.id === id)?.[lang] || id })),
    ...applied.szs.map(id => ({ key: 'szs', id, name: id })),
  ]
  const title = searching ? t('search.title') : t(`plp.title.${departmentLabel}`)
  // Trong lúc chờ API dùng danh mục tĩnh (sinh từ cùng database) để hàng nút không chèn vào sau gây layout shift
  const navCategories = categories.length ? categories : localCategories.filter(c => !department || c.department === department)
  const showCategoryNav = !searching && navCategories.length > 1

  return <main className="pb-(--section-y)">
    <title>{`${searching && searchQuery ? `${searchQuery} – ` : ''}${title} – N&B`}</title>
    <div className="shell pt-8 lg:pt-12">
      <nav aria-label="Breadcrumb">
        <ol className="flex flex-wrap items-center gap-2 text-caption text-ink-muted">
          <li><Link to="/" className="inline-flex min-h-6 items-center hover:text-ink">{t('plp.home')}</Link></li>
          <li aria-hidden="true">/</li>
          <li aria-current="page" className="text-ink">{searching ? t('search.title') : t(`nav.${departmentLabel}`)}</li>
        </ol>
      </nav>
      <h1 className="mt-5 font-display text-title">{title}</h1>
      <p className="mt-3 max-w-reading text-body text-ink-muted">{searching ? (searchQuery ? t('search.for').replace('{query}', searchQuery) : t('search.all')) : t(`plp.intro.${departmentLabel}`)}</p>
      {showCategoryNav && <ul className="scroll-rail -mx-(--gutter) mt-6 flex gap-2 overflow-x-auto px-(--gutter)" aria-label={t('plp.category')}>
        <li className="shrink-0"><button type="button" aria-pressed={!applied.cats.length} onClick={() => apply({ ...applied, cats: [] })}
          className={`min-h-10 border px-4 text-body-sm ${!applied.cats.length ? 'border-ink bg-ink text-on-ink' : 'border-line-strong hover:border-ink'}`}>{t('plp.allCategories')}</button></li>
        {navCategories.map(c => { const on = applied.cats.length === 1 && applied.cats[0] === c.id
          return <li key={c.id} className="shrink-0"><button type="button" aria-pressed={on} onClick={() => apply({ ...applied, cats: on ? [] : [c.id] })}
            className={`min-h-10 border px-4 text-body-sm ${on ? 'border-ink bg-ink text-on-ink' : 'border-line-strong hover:border-ink'}`}>{c[lang]}</button></li> })}
      </ul>}
    </div>

    <div data-sticky-bar className="sticky top-(--header-h) z-(--z-sticky) mt-8 border-y border-line bg-paper/95 backdrop-blur">
      <div className="shell flex min-h-14 items-center justify-between gap-4">
        <button type="button" onClick={() => { setDraft(applied); setOpenFilters(true) }} aria-expanded={openFilters} className="flex min-h-11 items-center gap-2 text-caption font-medium tracking-[.08em] uppercase">
          <Icon name="sliders" size={18} />{t('plp.filter')}{active > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-ink px-1.5 text-micro text-on-ink">{active}</span>}
        </button>
        <p className="hidden text-caption text-ink-muted sm:block" aria-live="polite">{loading ? '' : `${total} ${t('plp.count')}`}</p>
        <div className="flex items-center gap-6">
          <div className="hidden items-center gap-1 lg:flex" role="group" aria-label={t('plp.density')}>
            {[2, 3, 4].map(n => <button key={n} type="button" onClick={() => setDensity(n)} aria-pressed={density === n} aria-label={`${n} ${t('plp.density').toLowerCase()}`}
              className={`grid size-9 place-items-center text-caption ${density === n ? 'text-ink underline underline-offset-4' : 'text-ink-muted hover:text-ink'}`}>{n}</button>)}
          </div>
          <label className="flex items-center gap-2 text-caption">
            <span className="hidden text-ink-muted sm:inline">{t('plp.sort')}</span>
            <select value={sort} onChange={e => update({ sort: e.target.value })} className="min-h-11 cursor-pointer bg-transparent pr-1 text-body-sm font-medium">
              {sorts.map(s => <option key={s} value={s}>{t(sortLabel[s])}</option>)}
            </select>
          </label>
        </div>
      </div>
    </div>

    <div className="shell">
      {chips.length > 0 && <ul className="flex flex-wrap items-center gap-2 pt-5">
        {chips.map(chip => <li key={`${chip.key}-${chip.id}`}>
          <button type="button" onClick={() => apply({ ...applied, [chip.key]: applied[chip.key].filter(x => x !== chip.id) })} aria-label={t('plp.removeFilter').replace('{name}', chip.name)}
            className="flex min-h-9 items-center gap-2 border border-line-strong pl-3 pr-2 text-caption hover:border-ink">{chip.name}<Icon name="close" size={12} /></button>
        </li>)}
        <li><button type="button" onClick={() => apply(empty)} className="min-h-9 px-2 text-caption text-link">{t('plp.clearApplied')}</button></li>
      </ul>}
      {error && <p role="status" className="mt-5 border border-warning/30 bg-warning-soft px-4 py-3 text-body-sm text-warning">{t('plp.offline')}</p>}

      <div className="pt-8">
        {loading
          ? <ProductGrid loading label={t('ui.loading')} columns={densityColumns[density]} />
          : products.length === 0
          ? <EmptyState title={t('plp.empty')} description={searching ? t('search.emptyHint') : t('plp.emptyHint')}>
              {active > 0 && <button type="button" onClick={() => apply(empty)} className="button">{t('plp.clearApplied')}</button>}
              <Link to="/products" className="button button--primary">{t('nav.all')}</Link>
            </EmptyState>
          : <>
            <ProductGrid products={products} columns={densityColumns[density]} />
            <Pagination page={page} pages={pages} total={total} busy={loading} onPage={value => { setPage(value); window.scrollTo(0, 0) }} />
          </>}
      </div>
    </div>

    <FilterDrawer open={openFilters} onClose={() => setOpenFilters(false)} draft={draft} setDraft={setDraft}
      onApply={() => { apply(draft); setOpenFilters(false) }} categories={categories} colors={filterColors} sizes={sizes} />
  </main>
}
