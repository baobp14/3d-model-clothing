import { useEffect, useState } from 'react'
import { products, colors } from '../data/products'
import { shopApi } from '../lib/api'
import { mapProduct } from './useCatalog'

export function useProduct(id) {
  const [state, setState] = useState({ product: null, colors, loading: true })
  useEffect(() => {
    const controller = new AbortController()
    const local = products.find(p => String(p.id) === id)
    const fallback = local ? { ...local, stock: null } : null
    setState({ product: fallback, colors, loading: true })
    shopApi.request(`/products/${id}`, { signal: controller.signal }).then(data => {
      if (!controller.signal.aborted) setState({ product: mapProduct(data.product),
        colors: data.colors.map(r => ({ id: r.id, vi: r.name_vi, en: r.name_en, hex: r.hex })), loading: false })
    }).catch(error => {
      if (!controller.signal.aborted) setState({ product: error.status === 404 ? null : fallback, colors, loading: false })
    })
    return () => controller.abort()
  }, [id])
  return state
}
