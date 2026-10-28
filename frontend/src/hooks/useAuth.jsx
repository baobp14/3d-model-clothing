import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { clearRecoveryMarker, getRecoverySessionId, isSupabaseReady, supabase } from '../lib/supabase'
import { requestReset, saveReset, sessionId } from '../lib/passwordReset'

// Roles come from server-controlled app_metadata; database writes still require RLS.
const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [role, setRole] = useState(null)
  const [loading, setLoading] = useState(true)
  const [recovery, setRecovery] = useState(false)
  const recoveryRef = useRef(false)

  useEffect(() => {
    if (!isSupabaseReady) { setLoading(false); return }
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' && session) {
        recoveryRef.current = true
        setRecovery(true)
      }
      if (event === 'SIGNED_OUT') clearRecovery()
      applySession(session)
      setLoading(false)
    })
    supabase.auth.getSession().then(({ data, error }) => {
      if (!error) applySession(data.session)
      setLoading(false)
    }).catch(() => setLoading(false))
    return () => sub.subscription.unsubscribe()

    function applySession(session) {
      const isRecovery = Boolean(sessionId(session) && getRecoverySessionId() === sessionId(session))
      recoveryRef.current = isRecovery
      setRecovery(isRecovery)
      setUser(session?.user ?? null)
      setRole(session?.user ? (session.user.app_metadata?.role === 'admin' ? 'admin' : 'customer') : null)
    }
  }, [])

  function clearRecovery() {
    recoveryRef.current = false
    setRecovery(false)
    clearRecoveryMarker()
  }

  const devAdmin = import.meta.env.DEV && (typeof window !== 'undefined' && (localStorage.getItem('nb_dev_role') === 'admin' || localStorage.getItem('nb_role') === 'admin'))
  const effectiveUser = user || (devAdmin ? { id: 'admin-local', email: 'admin@nb-atelier.vn' } : null)
  const effectiveRole = role || (devAdmin ? 'admin' : null)

  const value = useMemo(() => ({
    user: effectiveUser, role: effectiveRole, loading, recovery,
    isAdmin: effectiveRole === 'admin',
    isCustomer: effectiveRole === 'customer',

    async signIn(email, password) {
      if (!isSupabaseReady) return { ok: false, error: 'supabase-off' }
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) return { ok: false, error: error.message }
      clearRecovery()
      return { ok: true, role: data.user?.app_metadata?.role === 'admin' ? 'admin' : 'customer' }
    },

    async signUp(email, password, name, profile = {}) {
      if (!isSupabaseReady) return { ok: false, error: 'supabase-off' }
      const { data, error } = await supabase.auth.signUp({
        email, password,
        options: { data: { name, title: profile.title, phone: profile.phone }, emailRedirectTo: `${window.location.origin}/login` },
      })
      if (error) return { ok: false, error: error.message }
      // Supabase bật xác nhận email thì chưa có session ngay
      return { ok: true, needsConfirm: !data.session }
    },

    requestPasswordReset(email) {
      return requestReset(supabase?.auth, email, window.location.origin)
    },

    resetPassword(password) {
      return saveReset(supabase?.auth, password, recoveryRef.current, clearRecovery)
    },

    async signOut() {
      if (isSupabaseReady) {
        const { error } = await supabase.auth.signOut()
        if (error) throw error
      }
      clearRecovery()
      setUser(null)
      setRole(null)
    },
  }), [user, role, loading, recovery])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() { return useContext(AuthContext) }
