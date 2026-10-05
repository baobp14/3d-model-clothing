import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { usePagedProducts } from '../hooks/usePagedProducts'
import { formatPrice } from '../data/products'
import Icon from './Icon'
import { useLang } from '../i18n'



export default function ProductShowcase() {
  const rail = useRef(null)
  const { lang, t } = useLang()
  const { products: catalog } = usePagedProducts({ department: 'women', page: 1, limit: 10 })
  const products = catalog.slice(0, 10)
  const loopProducts = products.length ? Array.from({ length: Math.max(1, Math.ceil(5 / products.length)) }, () => products).flat() : []
  const paused = useRef(false)
  const scroll = dir => {
    const element = rail.current
    if (!element) return
    const card = element.querySelector('article')
    const step = (card?.getBoundingClientRect().width || 340) + parseFloat(getComputedStyle(element).columnGap || 0)
    const first = element.querySelector('article')
    const duplicate = element.querySelector('[data-loop-start]')
    const loopWidth = duplicate && first ? duplicate.offsetLeft - first.offsetLeft : 0
    if (!loopWidth) return
    element.scrollLeft = ((element.scrollLeft + dir * step) % loopWidth + loopWidth) % loopWidth
  }
  useEffect(() => {
    const element = rail.current
    if (!element || !loopProducts.length) return
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    let frame
    let previousTime
    let position = element.scrollLeft
    const animate = time => {
      const elapsed = previousTime == null ? 0 : Math.min(time - previousTime, 64)
      previousTime = time
      const first = element.querySelector('article')
      const duplicate = element.querySelector('[data-loop-start]')
      const loopWidth = duplicate && first ? duplicate.offsetLeft - first.offsetLeft : 0
      if (!paused.current && !document.hidden && !reducedMotion.matches && loopWidth > 0) {
        // Retain fractional pixels so slow movement stays smooth on every display.
        if (Math.abs(element.scrollLeft - position) > 1) position = element.scrollLeft
        position = (position + elapsed * 0.035) % loopWidth
        element.scrollLeft = position
      } else {
        position = element.scrollLeft
      }
      frame = window.requestAnimationFrame(animate)
    }
    frame = window.requestAnimationFrame(animate)
    return () => window.cancelAnimationFrame(frame)
  }, [catalog])
  return <section id="products" className="border-y border-feather bg-alabaster py-12 sm:py-16">
    <div className="shell mb-8 flex flex-wrap items-end justify-between gap-4 px-4 sm:mb-10 sm:px-5 md:px-8"><div><h2 className="display-title">{t('ps.title')}</h2></div>
      <div className="flex gap-3"><button onClick={() => scroll(-1)} className="flex h-11 w-11 items-center justify-center border border-feather bg-white" aria-label={t('ps.prev')}><Icon name="arrowLeft" size={18} /></button><button onClick={() => scroll(1)} className="flex h-11 w-11 items-center justify-center bg-obsidian text-white" aria-label={t('ps.next')}><Icon name="arrowRight" size={18} /></button></div>
    </div>
    <div ref={rail} onMouseEnter={() => { paused.current = true }} onMouseLeave={() => { paused.current = false }} onFocusCapture={() => { paused.current = true }} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) paused.current = false }} onTouchStart={() => { paused.current = true }} onTouchEnd={() => { paused.current = false }} className="product-showcase-rail shell grid auto-cols-[78%] grid-flow-col gap-4 overflow-x-auto px-4 sm:auto-cols-[46%] sm:gap-5 sm:px-5 md:px-8 lg:auto-cols-[calc((100%-60px)/4)]">
      {[...loopProducts, ...loopProducts].map((p, index) => <article key={`${p.id}-${index}`} data-loop-start={index === loopProducts.length ? true : undefined} className="bg-white"><Link to={`/product/${p.id}`} className="product-image-surface image-zoom relative block aspect-[4/5]"><img className="h-full w-full object-contain product-image-blend" src={p.images[0]} alt={p[lang]} loading="lazy" />{p.badge && <span className="absolute left-4 top-4 border border-obsidian/20 bg-white/90 px-3 py-1 text-[9px] tracking-[.2em] uppercase">{t(p.badge)}</span>}</Link><div className="px-3 pb-6 pt-5 text-center"><p className="text-[9px] tracking-[.22em] text-stone uppercase">{t('cat.rtw')}</p><h3 className="font-display mt-2 text-[17px]">{p[lang]}</h3><p className="mt-1.5 text-[12px] tracking-[.05em]">{formatPrice(p.price)}</p><Link to={`/product/${p.id}`} className="mt-3 text-[10px] tracking-[.2em] underline decoration-feather underline-offset-4 uppercase">{t('ps.discover')}</Link></div></article>)}
    </div>
  </section>
}
