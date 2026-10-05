import { useEffect, useState } from 'react'
import { shopApi } from '../lib/api'
import { searchProducts } from '../lib/productSearch'
import { categories as localCategories, colors as localColors, products as localProducts } from '../data/products'

export const mapProduct = r => ({
  id: r.id, department: r.department, vi: r.name_vi, en: r.name_en, category: r.category,
  price: Number(r.price), colors: r.colors ?? [], sizes: r.sizes ?? [],
  images: r.images ?? [], isNew: r.is_new, stock: r.stock == null ? null : Number(r.stock),
  description: r.description, descriptionEn: r.description_en, createdAt: r.created_at,
  variants: r.variants ?? null, stockRevision: r.stock_revision ?? null,
  colorNames: r.color_names ?? {},
  colorImages: r.color_images ?? {}, archived: !!r.archived,
})

const sortSizes = list => [...list].sort((a, b) => Number(a) - Number(b) || a.localeCompare(b))

/** Chỉ giữ màu/size thực sự có trong danh sách sản phẩm đang xem. */
function derive(products, categories, colors) {
  const usedColors = new Set(products.flatMap(p => p.colors))
  return {
    products,
    categories,
    colors: colors.filter(c => usedColors.has(c.id)),
    sizes: sortSizes([...new Set(products.flatMap(p => p.sizes ?? []))]),
  }
}

export function localCatalog(department, query) {
  return derive(
    searchProducts(localProducts.filter(p => !department || p.department === department), localCategories, localColors, query || '').map(p => ({ ...p, stock: null })),
    localCategories.filter(c => !department || c.department === department),
    localColors,
  )
}

/** Python is authoritative; static data remains available for offline browsing. */
export function useCatalog(department, query) {
  const [state, setState] = useState(() => ({
    ...localCatalog(department, query), loading: true, error: null, source: 'local',
  }))

  useEffect(() => {
    const offline = { ...localCatalog(department, query), loading: false, source: 'local' }
    setState({ ...offline, loading: true, error: null })
    const controller = new AbortController()
    const params = new URLSearchParams()
    if (department) params.set('department', department)
    if (query) params.set('q', query)
    shopApi.request(`/catalog?${params}`, { signal: controller.signal }).then(catalog => {
      if (controller.signal.aborted) return
      setState({
        loading: false, error: null, source: 'api',
        ...derive(
          catalog.products.map(mapProduct),
          catalog.categories.map(r => ({ id: r.id, department: r.department, vi: r.name_vi, en: r.name_en })),
          catalog.colors.map(r => ({ id: r.id, vi: r.name_vi, en: r.name_en, hex: r.hex })),
        ),
      })
    }).catch(error => {
      if (!controller.signal.aborted) setState({ ...offline, error: error.message })
    })
    return () => controller.abort()
  }, [department, query])

  return state
}
