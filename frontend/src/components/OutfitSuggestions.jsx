import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { recommend } from '@/lib/outfit/recommend'
import { shopApi } from '../lib/api'
import { useLang } from '../i18n'
import { folderOf, outfitLink, tryOnSlot } from '../tryon/links'
import Price from './Price'

// Outfit tags (colours, pattern, style, formality, season) were generated once by AI
// per garment colour; scoring is rule-based so every suggestion carries its reasons.
let sources = null
function loadSources() {
  sources ??= Promise.all([
    fetch('/outfit/catalog.json').then(r => (r.ok ? r.json() : [])),
    shopApi.request('/products?limit=100'),
  ]).then(([catalog, page]) => {
    const shop = new Map()
    for (const product of page.items || []) {
      if (product.archived) continue
      product.colors.forEach((color, index) => {
        const folder = folderOf(product.images[index])
        if (folder) shop.set(folder, { product, color, image: product.images[index] })
      })
    }
    return { catalog: catalog.filter(item => shop.has(item.id)), shop }
  }).catch(error => { sources = null; throw error })
  return sources
}

export default function OutfitSuggestions({ product, color }) {
  const { lang } = useLang()
  const vi = lang === 'vi'
  const [state, setState] = useState(null)
  const folder = folderOf(product.images[product.colors.indexOf(color)] || product.images[0])

  useEffect(() => {
    let live = true
    loadSources().then(({ catalog, shop }) => {
      if (!live) return
      const item = catalog.find(entry => entry.id === folder)
      if (!item) { setState(null); return }
      // Suggest from the same department (men's shirt → men's trousers), unless it has too few.
      const sameDepartment = catalog.filter(entry => entry.id === item.id || shop.get(entry.id).product.department === product.department)
      const pool = sameDepartment.filter(entry => entry.category !== item.category).length >= 2 ? sameDepartment : catalog
      const seen = new Set()
      const matches = recommend(item, pool, { limit: 20 })
        .map(match => ({ ...match, shop: shop.get(match.item.id) }))
        .filter(match => !seen.has(match.shop.product.id) && seen.add(match.shop.product.id))
        .slice(0, 4)
      setState({ item, matches })
    }).catch(() => { if (live) setState(null) })
    return () => { live = false }
  }, [folder])

  if (!state?.matches.length) return null
  const { item, matches } = state
  const wantsBottom = item.category === 'top'
  return <section aria-labelledby="outfit-title" className="mt-16 border-t border-line pt-10">
    <h2 id="outfit-title" className="font-display text-title-sm">{vi ? 'Gợi ý phối đồ' : 'Complete the look'}</h2>
    <p className="mt-2 text-body-sm text-ink-muted">{vi
      ? `${wantsBottom ? 'Quần, váy' : 'Áo'} hợp với món này, chấm điểm theo màu sắc, họa tiết, phong cách và độ trang trọng.`
      : `${wantsBottom ? 'Bottoms' : 'Tops'} that go with this piece, scored on colour, pattern, style and formality.`}</p>
    <ul className="mt-6 grid grid-cols-2 gap-x-4 gap-y-8 lg:grid-cols-4">
      {matches.map(({ item: match, shop, score, reasons }) => {
        const [top, bottom] = wantsBottom ? [item.id, match.id] : [match.id, item.id]
        const canTry = tryOnSlot[product.category] && tryOnSlot[shop.product.category]
        const why = reasons.filter(reason => reason.points > 0).sort((a, b) => b.points - a.points).slice(0, 2)
        return <li key={match.id} className="min-w-0">
          <Link to={`/product/${shop.product.id}`} state={{ shoppingSelection: { productId: shop.product.id, color: shop.color } }} className="group block">
            <div className="product-image-surface relative aspect-product overflow-hidden rounded-[var(--radius-card)]">
              <img src={shop.image} alt="" loading="lazy" className="h-full w-full object-contain product-image-blend transition-transform group-hover:scale-[1.03]" />
              <span className={`badge absolute left-2 top-2 ${score >= 8 ? 'badge--success' : 'badge--info'}`}>{score >= 8 ? (vi ? 'Rất hợp' : 'Great match') : score >= 5 ? (vi ? 'Hợp' : 'Good match') : (vi ? 'Có thể phối' : 'Works')}</span>
            </div>
            <p className="mt-3 line-clamp-2 text-body leading-snug group-hover:underline">{shop.product[`name_${lang}`] || shop.product.name_vi}</p>
          </Link>
          <p className="mt-1 text-body font-semibold"><Price value={shop.product.price} /></p>
          {lang === 'vi' && why.length > 0 && <ul className="mt-2 space-y-1">{why.map(reason => <li key={reason.text} className="text-caption text-ink-muted">✓ {reason.text}</li>)}</ul>}
          {canTry && <Link to={outfitLink(top, bottom)} className="button button--sm mt-3 w-full border-accent text-accent">{vi ? 'Mặc thử cả bộ 3D' : 'Try the outfit in 3D'}</Link>}
        </li>
      })}
    </ul>
  </section>
}
