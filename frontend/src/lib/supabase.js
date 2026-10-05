import { createClient } from '@supabase/supabase-js'
import { sessionId } from './passwordReset'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Chưa cấu hình .env.local thì client là null, app tự fallback về dữ liệu tĩnh.
export const isSupabaseReady = Boolean(url && anonKey)

export const supabase = isSupabaseReady ? createClient(url, anonKey) : null

// Capture recovery before React mounts, including very fast callback initialization.
let recoverySessionId = null
try { recoverySessionId = sessionStorage.getItem('nb-recovery') } catch { /* optional */ }
export function getRecoverySessionId() { return recoverySessionId }
export function clearRecoveryMarker() {
  recoverySessionId = null
  try { sessionStorage.removeItem('nb-recovery') } catch { /* optional */ }
}
supabase?.auth.onAuthStateChange((event, session) => {
  if (event === 'PASSWORD_RECOVERY' && session) {
    recoverySessionId = sessionId(session)
    try { if (recoverySessionId) sessionStorage.setItem('nb-recovery', recoverySessionId) } catch { /* optional */ }
  } else if (event === 'SIGNED_OUT' || (event === 'SIGNED_IN' && sessionId(session) !== recoverySessionId)) {
    clearRecoveryMarker()
  }
})
