import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useLang } from '../../i18n'
import { EMAIL, Field, Submit, useForm } from './fields'

export function authError(t, error) {
  const keys = { 'supabase-off': 'auth.supabaseOff', 'network-error': 'auth.networkError', 'invalid-recovery': 'auth.invalidRecovery' }
  if (keys[error]) return t(keys[error])
  if (/invalid login credentials/i.test(error || '')) return t('auth.invalidCredentials')
  if (/email not confirmed/i.test(error || '')) return t('auth.emailUnconfirmed')
  if (/banned/i.test(error || '')) return t('auth.locked')
  if (/rate|too many|security purposes/i.test(error || '')) return t('auth.rateLimited')
  if (/already registered/i.test(error || '')) return t('auth.alreadyRegistered')
  return t('auth.requestFailed')
}

export default function PasswordResetRequest({ prefix = 'reset', onSent }) {
  const { t } = useLang()
  const { requestPasswordReset } = useAuth()
  const [sent, setSent] = useState(false)
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  const [wait, setWait] = useState(0)
  const inFlight = useRef(false)
  const form = useForm({ email: '' }, v => ({ email: !EMAIL.test(v.email.trim()) && t('auth.errEmail') }))
  useEffect(() => {
    if (!wait) return
    const timer = setTimeout(() => setWait(n => n - 1), 1000)
    return () => clearTimeout(timer)
  }, [wait])
  async function send(e) {
    e.preventDefault()
    if (inFlight.current || wait || !form.check()) return
    inFlight.current = true
    setBusy(true)
    setStatus('')
    try {
      const res = await requestPasswordReset(form.values.email)
      if (!res.ok) return setStatus(authError(t, res.error))
      setSent(true)
      setWait(60)
      onSent?.()
    } finally { inFlight.current = false; setBusy(false) }
  }
  return <form onSubmit={send} noValidate>
    {sent ? <p role="status" className="mb-6 text-sm leading-7 text-ink-muted">{t('auth.sentDesc').replace('{email}', form.values.email.trim())}</p>
      : <Field id={`${prefix}-email`} type="email" autoComplete="email" disabled={busy} label={t('auth.email')} {...form.bind('email')} />}
    {status && <p role="alert" className="mb-4 text-sm text-danger">{status}</p>}
    <Submit disabled={busy || wait > 0}>{busy ? t('auth.processing') : wait ? `${t('auth.resend')} (${wait}s)` : t(sent ? 'auth.resend' : 'auth.sendLink')}</Submit>
  </form>
}
