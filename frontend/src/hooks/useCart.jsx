import { shopApi } from '../lib/api'
import { loadCartProducts } from '../lib/cartProducts'
import { mapProduct } from './useCatalog'
import { updateCartQuantity, reconcileCart, cartHasUnavailableItems } from '../lib/cartInventory'
import { checkoutKey, readOrderRequest, saveOrderRequest } from '../lib/checkoutRequest'
import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { useAuth } from './useAuth'
import { canShop } from '../lib/customerSession'
import { cartKey, lineKey, readCart } from '../lib/cartStorage'

const CartContext = createContext(null)
export { lineKey } from '../lib/cartStorage'

export function CartProvider({ children }) {
  const { user, loading, recovery } = useAuth()
  const ownerId = canShop(user, loading, recovery) ? user.id : null
  const ownerRef = useRef(ownerId)
  ownerRef.current = ownerId
  const [pending, setPending] = useState(null)
  const [inventoryError, setInventoryError] = useState(false)
  const [checking, setChecking] = useState(false)
  const [cart, setCart] = useState({ ownerId: null, items: [] })
  const cartRef = useRef(cart)
  cartRef.current = cart
  const ready = Boolean(ownerId && cart.ownerId === ownerId)
  const items = ready ? cart.items : []
  useEffect(() => {
    let saved = []
    try { saved = readCart(localStorage, ownerId) } catch { /* Storage unavailable */ }
    setCart({ ownerId, items: saved })
    try { setPending(ownerId ? readOrderRequest(localStorage, ownerId) : null) } catch { setPending(null) }
    setInventoryError(false)
  }, [ownerId])
  useEffect(() => {
    if (!ready || !items.some(line => line.color && !line.product.colorNames?.[line.color])) return
    let active = true
    const owner = ownerId
    async function hydrateNames() {
      try {
        const rows = await loadCartProducts(shopApi, items)
        if (!active || ownerRef.current !== owner) return
        const names = new Map(rows.map(row => [row.id, row.color_names || {}]))
        const merge = lines => lines.map(line => names.has(line.product.id) ? { ...line, product: { ...line.product, colorNames: names.get(line.product.id) } } : line)
        const latest = readCart(localStorage, owner)
        localStorage.setItem(cartKey(owner), JSON.stringify(merge(latest)))
        setCart(current => current.ownerId === owner ? { ...current, items: merge(current.items) } : current)
      } catch { /* Quantity and order state remain intact; normal refresh offers retry. */ }
    }
    hydrateNames(); return () => { active = false }
  }, [ownerId, ready])
  useEffect(() => {
    if (!ownerId) return
    const sync = event => {
      if (event.key !== cartKey(ownerId) && event.key !== checkoutKey(ownerId)) return
      const next = { ownerId, items: readCart(localStorage, ownerId) }
      cartRef.current = next; setCart(next)
      try { setPending(readOrderRequest(localStorage, ownerId)) } catch { setInventoryError(true) }
    }
    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
  }, [ownerId])
  const setItems = fn => {
    if (!ready || pending) return false
    try { if (readOrderRequest(localStorage, ownerId)) return false } catch { return false }
    const current = cartRef.current
    if (current.ownerId !== ownerId) return false
    let latest
    try { latest = readCart(localStorage, ownerId) } catch { return false }
    const nextItems = fn(latest)
    if (!nextItems) return false
    const next = { ...current, items: nextItems }
    try { localStorage.setItem(cartKey(ownerId), JSON.stringify(nextItems)) } catch { return false }
    cartRef.current = next
    setCart(next)
    return true
  }
  const add = (product, color, size, quantity = 1, extra = {}) => {
    const requested = Number(quantity)
    if (!Number.isInteger(requested) || requested < 1 || requested > 99 || product.stock == null) return false
    const key = lineKey(product, color, size)
    return setItems(current => {
      const variant = product.variants?.find(row => row.color === (color || '') && row.size === (size || ''))
      const selected = current.filter(i => i.product.id === product.id && i.color === color && i.size === size).reduce((sum, i) => sum + i.quantity, 0)
      if (product.variants && selected + requested > (variant?.stock ?? 0)) return null
      const existing = current.filter(i => i.product.id === product.id).reduce((n, i) => n + i.quantity, 0)
      if (existing + requested > product.stock || (current.find(i => i.key === key)?.quantity || 0) + requested > 99) return null
      return current.some(i => i.key === key)
        ? current.map(i => i.key === key ? { ...i, quantity: i.quantity + requested, ...extra } : i)
        : [...current, { key, product, color, size, quantity: requested, ...extra }]
    })
  }
  const update = (key, quantity) => setItems(current => updateCartQuantity(current, key, quantity))
  const remove = key => setItems(current => current.filter(i => i.key !== key))
  async function refresh() {
    const owner = ownerId
    setChecking(true)
    try {
      const saved = readCart(localStorage, owner)
      const products = (await loadCartProducts(shopApi, [...items, ...saved])).map(mapProduct)
      if (ownerRef.current !== owner) throw new Error('NB_AUTH_REQUIRED')
      const latest = readCart(localStorage, owner)
      const loaded = new Set([...items, ...saved].map(line => line.product.id))
      if (latest.some(line => !loaded.has(line.product.id))) throw new Error('NB_CART_CHANGED')
      const updated = reconcileCart(items, products)
      localStorage.setItem(cartKey(owner), JSON.stringify(reconcileCart(latest, products)))
      setCart(current => current.ownerId === owner ? { ...current, items: reconcileCart(current.items, products) } : current)
      setInventoryError(false)
      return updated
    } catch (error) { if (ownerRef.current === owner) setInventoryError(true); throw error }
    finally { if (ownerRef.current === owner) setChecking(false) }
  }
  function beginOrder(payload) {
    if (ownerRef.current !== ownerId) throw new Error('NB_AUTH_REQUIRED')
    if (!readOrderRequest(localStorage, ownerId)) {
      const counts = lines => JSON.stringify(lines.map(i => [i.product_id, i.color || '', i.size || '', i.quantity]).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))))
      const current = readCart(localStorage, ownerId).map(i => ({ product_id: i.product.id, quantity: i.quantity, color: i.color, size: i.size }))
      if (counts(current) !== counts(payload.items)) throw new Error('NB_CART_CHANGED')
    }
    const request = saveOrderRequest(localStorage, ownerId, payload)
    setPending(request)
    return request
  }
  function releaseOrder() {
    localStorage.removeItem(checkoutKey(ownerId))
    if (ownerRef.current === ownerId) setPending(null)
  }
  function clear() {
    // Persist the cleared cart before dropping the retry ID, including reloads immediately after success.
    localStorage.setItem(cartKey(ownerId), '[]')
    if (ownerRef.current === ownerId) setCart({ ownerId, items: [] })
    releaseOrder()
  }
  return <CartContext.Provider value={{ items, ready, add, update, remove, clear, refresh, checking, inventoryError, pending, beginOrder, releaseOrder, unavailable: cartHasUnavailableItems(items), count: items.reduce((n, i) => n + i.quantity, 0), total: items.reduce((n, i) => n + i.product.price * i.quantity, 0) }}>{children}</CartContext.Provider>
}
export const useCart = () => useContext(CartContext)
