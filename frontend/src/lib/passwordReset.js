// Auth is injected so the real API flow can be tested without sending customer mail.
export function sessionId(session) {
  try {
    const payload = session.access_token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(atob(payload)).session_id ?? null
  } catch { return null }
}

export async function requestReset(auth, email, origin) {
  if (!auth) return { ok: false, error: 'supabase-off' }
  try {
    const { error } = await auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${origin}/reset-password`,
    })
    return error ? { ok: false, error: error.message } : { ok: true }
  } catch { return { ok: false, error: 'network-error' } }
}

export async function saveReset(auth, password, recovery, onSaved) {
  if (!auth) return { ok: false, error: 'supabase-off' }
  if (!recovery) return { ok: false, error: 'invalid-recovery' }
  try {
    const { data, error } = await auth.getUser()
    if (error || !data.user) return { ok: false, error: 'invalid-recovery' }
    const { error: updateError } = await auth.updateUser({ password })
    if (updateError) return { ok: false, error: updateError.message }
    onSaved()
  } catch { return { ok: false, error: 'network-error' } }
  // Do not misreport a saved password as failed if session revocation is unavailable.
  try {
    const { error } = await auth.signOut({ scope: 'global' })
    return { ok: true, signOutFailed: Boolean(error) }
  } catch { return { ok: true, signOutFailed: true } }
}
