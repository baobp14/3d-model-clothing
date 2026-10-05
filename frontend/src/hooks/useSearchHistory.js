import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const HOUR = 3600 * 1000
const TTL = { guest: 24 * HOUR, user: 72 * HOUR }
const MAX = 8

const keyFor = userId => `searchHistory:${userId || 'guest'}`

function load(userId) {
  try {
    const ttl = userId ? TTL.user : TTL.guest
    const items = JSON.parse(localStorage.getItem(keyFor(userId)) || '[]')
    return items.filter(i => Date.now() - i.at < ttl)
  } catch { return [] }
}

function save(userId, items) {
  try { localStorage.setItem(keyFor(userId), JSON.stringify(items)) } catch { /* private mode */ }
}

// Lịch sử tìm kiếm: khách giữ 24h, người đã đăng nhập giữ 3 ngày (tách theo user id).
export default function useSearchHistory() {
  const [userId, setUserId] = useState(null)
  const [items, setItems] = useState(() => load(null))

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => setUserId(data.session?.user.id ?? null))
    const { data } = supabase.auth.onAuthStateChange((_e, session) => setUserId(session?.user.id ?? null))
    return () => data.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    const fresh = load(userId)
    save(userId, fresh)
    setItems(fresh)
  }, [userId])

  const add = useCallback(q => {
    q = q.trim()
    if (!q) return
    setItems(prev => {
      const next = [{ q, at: Date.now() }, ...prev.filter(i => i.q.toLowerCase() !== q.toLowerCase())].slice(0, MAX)
      save(userId, next)
      return next
    })
  }, [userId])

  const remove = useCallback(q => setItems(prev => {
    const next = prev.filter(i => i.q !== q)
    save(userId, next)
    return next
  }), [userId])

  const clear = useCallback(() => { save(userId, []); setItems([]) }, [userId])

  return { items, add, remove, clear }
}
