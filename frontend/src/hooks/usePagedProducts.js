import { useEffect, useState } from 'react'
import { shopApi } from '../lib/api'
import { localCatalog, mapProduct } from './useCatalog'

export function usePagedProducts(options = {}, { endpoint = '/product-page', auth = false, offline = true, refreshKey = '' } = {}) {
  const query = new URLSearchParams(Object.entries(options).filter(([, value]) => value !== undefined && value !== '')).toString()
  const [state, setState] = useState({ products: [], categories: [], colors: [], sizes: [], page: 1, pages: 1, total: 0, loading: true, error: null })
  useEffect(() => {
    const controller = new AbortController()
    setState(s => ({ ...s, loading: true, error: null }))
    shopApi.request(`${endpoint}?${query}`, { auth, signal: controller.signal }).then(data => {
      if (!controller.signal.aborted) setState({ ...data, loading: false, error: null,
        products: data.products.map(mapProduct), categories: data.categories.map(c => ({ ...c, vi: c.name_vi, en: c.name_en })),
        colors: data.colors.map(c => ({ ...c, vi: c.name_vi, en: c.name_en })) })
    }).catch(error => {
      if (controller.signal.aborted) return
      if (!offline) { setState(s => ({ ...s, products: [], loading: false, error })); return }
      const params = new URLSearchParams(query)
      const local = localCatalog(params.get('department'), params.get('q'))
      const choices = key => (params.get(key) || '').split(',').filter(Boolean)
      const cats = choices('categories'), colors = choices('colors'), sizes = choices('sizes')
      const rows = local.products.filter(p => (!cats.length || cats.includes(p.category)) && (!colors.length || p.colors.some(c => colors.includes(c))) && (!sizes.length || p.sizes.some(s => sizes.includes(s))))
      const sort = params.get('sort')
      if (sort === 'priceAsc') rows.sort((a, b) => a.price - b.price)
      if (sort === 'priceDesc') rows.sort((a, b) => b.price - a.price)
      if (sort === 'new') rows.sort((a, b) => Date.parse(b.createdAt || 0) - Date.parse(a.createdAt || 0) || b.id - a.id)
      const limit = Number(params.get('limit') || 12), page = Number(params.get('page') || 1)
      setState({ ...local, products: rows.slice((page - 1) * limit, page * limit), total: rows.length, page, pages: Math.max(1, Math.ceil(rows.length / limit)), loading: false, error })
    })
    return () => controller.abort()
  }, [query, endpoint, auth, offline, refreshKey])
  return state
}
