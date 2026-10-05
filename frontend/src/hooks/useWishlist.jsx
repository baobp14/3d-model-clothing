import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { useAuth } from './useAuth'
import { shopApi } from '../lib/api'

const Context = createContext(null)
export function WishlistProvider({ children }) {
  const { user, isAdmin, recovery } = useAuth()
  const owner = user && !user.is_anonymous && !isAdmin && !recovery ? user.id : null
  const ownerRef = useRef(owner)
  ownerRef.current = owner
  const [state, setState] = useState({ owner: null, ids: [], loading: false, error: false })
  const [busy, setBusy] = useState(false)
  const lock = useRef(false)
  const generation = useRef(0)
  async function load() {
    const id = owner
    if (!id || lock.current) return
    const revision = ++generation.current
    setState(current => ({ ...current, loading: true, error: false }))
    try {
      const result = await shopApi.request('/wishlist', { auth: true })
      if (ownerRef.current === id && revision === generation.current) setState({ owner: id, ids: result.product_ids, loading: false, error: false })
    } catch { if (ownerRef.current === id && revision === generation.current) setState(current => ({ ...current, loading: false, error: true })) }
  }
  useEffect(() => {
    setState({ owner, ids: [], loading: Boolean(owner), error: false })
    if (owner) load()
    const refresh = () => { if (owner) load() }
    window.addEventListener('focus', refresh)
    return () => window.removeEventListener('focus', refresh)
  }, [owner])
  const ids = state.owner === owner ? state.ids : []
  async function toggle(productId) {
    if (!owner || lock.current || state.loading || state.error) return false
    const id = owner
    lock.current = true; setBusy(true)
    try {
      const result = await shopApi.request('/wishlist', { method: 'POST', auth: true, body: { product_id: productId, saved: !ids.includes(productId) } })
      if (ownerRef.current === id) setState({ owner: id, ids: result.product_ids, loading: false, error: false })
      return true
    } catch { if (ownerRef.current === id) setState(current => ({ ...current, error: true })); return false }
    finally { lock.current = false; setBusy(false) }
  }
  return <Context.Provider value={{ ids, owner, busy, loading: state.loading, error: state.error, toggle, reload: load }}>{children}</Context.Provider>
}
export const useWishlist = () => useContext(Context)
