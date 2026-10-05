import useSubmission from '../hooks/useSubmission'
import { TitleField } from '../components/auth/fields'
import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { canShop, safeReturnPath } from '../lib/customerSession'
import { EMAIL, Field, MIN_PASSWORD, Submit, useForm, validateRegistration } from '../components/auth/fields'
import { useAuth } from '../hooks/useAuth'
import { useLang } from '../i18n'
import PasswordResetRequest, { authError } from '../components/auth/PasswordResetRequest'

function Shell({ title, desc, children, footer, registration = false }) {
  const { t } = useLang()
  useEffect(() => { window.scrollTo(0, 0) }, [])
  return <main className="bg-alabaster px-5 py-16 md:py-24">
    <div className={`mx-auto w-full max-w-md bg-white px-6 py-10 md:px-10 md:py-12 ${registration ? 'registration-panel registration-card' : ''}`}>
      <nav className="eyebrow mb-8 text-[10px] text-stone" aria-label="Breadcrumb"><Link to="/" className="hover:text-obsidian">{t('plp.home')}</Link> / <span className="text-obsidian">{title}</span></nav>
      <h1 className="font-display text-3xl tracking-[.06em] uppercase">{title}</h1>
      {desc && <p className="mt-3 text-sm leading-6 text-taupe">{desc}</p>}
      <div className="mt-8">{children}</div>
      {footer && <p className="mt-8 border-t border-feather pt-6 text-center text-xs text-charcoal">{footer}</p>}
    </div>
  </main>
}

export function Login() {
  const { t } = useLang()
  const { signIn, user, isAdmin, loading, recovery } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [params] = useSearchParams()
  const next = safeReturnPath(params.get('next'), isAdmin ? '/admin' : '/')
  const [status, setStatus] = useState('')
  const submission = useSubmission(() => setStatus(t('auth.networkError')))
  useEffect(() => {
    if (!loading && !recovery && isAdmin) navigate('/admin', { replace: true })
    else if (canShop(user, loading, recovery)) navigate(next, { replace: true, state: location.state })
  }, [loading, user, recovery, isAdmin, navigate, next, location.state])
  const form = useForm({ email: '', password: '' }, v => ({
    email: !EMAIL.test(v.email.trim()) && t('auth.errEmail'),
    password: !v.password && t('auth.errRequired'),
  }))
  const onSubmit = submission.wrap(async e => {
    e.preventDefault()
    setStatus('')
    const res = await signIn(form.values.email.trim(), form.values.password)
    if (res.ok) return navigate(res.role === 'admin' ? '/admin' : safeReturnPath(params.get('next')), { replace: true, state: location.state })
    setStatus(authError(t, res.error))
  }, () => form.check())
  return <Shell title={t('auth.login')} desc={t('auth.loginDesc')} footer={<>{t('auth.noAccount')} <Link to={`/register${location.search}`} state={location.state} className="font-medium underline underline-offset-4">{t('auth.register')}</Link></>}>
    <form onSubmit={onSubmit} noValidate>
      <Field disabled={submission.busy} id="email" type="email" autoComplete="email" label={t('auth.email')} {...form.bind('email')} />
      <Field disabled={submission.busy} id="password" type="password" autoComplete="current-password" label={t('auth.password')} {...form.bind('password')} />
      <div className="-mt-2 mb-6 text-right"><Link to="/forgot-password" className="text-xs text-taupe underline underline-offset-4 hover:text-obsidian">{t('auth.forgot')}</Link></div>
      {status && <p role="alert" className="mb-4 text-[13px] text-red-700">{status}</p>}
      <Submit disabled={submission.busy}>{t(submission.busy ? 'auth.processing' : 'auth.login')}</Submit>
    </form>
  </Shell>
}

export function Register() {
  const { t } = useLang()
  const { signUp } = useAuth()
  const location = useLocation()
  const [status, setStatus] = useState('')
  const submission = useSubmission(() => setStatus(t('auth.networkError')))
  const form = useForm({ title: '', name: '', email: '', phone: '', password: '', confirm: '', terms: false }, v => validateRegistration(v, t))
  const onSubmit = submission.wrap(async e => {
    e.preventDefault()
    setStatus('')
    const res = await signUp(form.values.email.trim(), form.values.password, form.values.name.trim(), { title: form.values.title, phone: form.values.phone.replace(/[\s().-]/g, '') })
    if (!res.ok) return setStatus(authError(t, res.error))
    setStatus(res.needsConfirm ? t('auth.needsConfirm') : t('auth.loginOk'))
  }, () => form.check())
  return <Shell registration title={t('auth.register')} footer={<>{t('auth.hasAccount')} <Link to={`/login${location.search}`} state={location.state} className="font-medium underline underline-offset-4">{t('auth.login')}</Link></>}>
    <form onSubmit={onSubmit} noValidate>
      <div className="registration-fields">
      <TitleField disabled={submission.busy} id="title" {...form.bind('title')} />
      <Field disabled={submission.busy} registration id="name" autoComplete="name" label={t('auth.name')} {...form.bind('name')} />
      <Field disabled={submission.busy} registration id="email" type="email" autoComplete="email" label={t('auth.email')} {...form.bind('email')} />
      <Field disabled={submission.busy} registration id="phone" type="tel" autoComplete="tel" label={t('auth.phone')} maxLength={10} inputMode="numeric" placeholder="0912345678" {...form.bind('phone')} />
      <Field disabled={submission.busy} registration id="password" type="password" autoComplete="new-password" label={t('auth.password')} placeholder={t('auth.registrationPasswordHint')} {...form.bind('password')} />
      <Field disabled={submission.busy} registration id="confirm" type="password" autoComplete="new-password" label={t('auth.confirm')} {...form.bind('confirm')} />
      </div>
      <label className="mb-6 flex items-start gap-3 text-xs leading-5 text-charcoal">
        <input type="checkbox" disabled={submission.busy} required checked={form.values.terms} onChange={e => form.setValues(v => ({ ...v, terms: e.target.checked }))} aria-invalid={!!form.errors.terms} className="mt-0.5 h-4 w-4 accent-obsidian" />
        <span>{t('auth.terms')} <span aria-hidden="true" className="text-red-700">*</span>{form.errors.terms && <span className="mt-1 block text-red-700">{form.errors.terms}</span>}</span>
      </label>
      {status && <p role="alert" className="mb-4 text-[13px] text-charcoal">{status}</p>}
      <Submit disabled={submission.busy}>{t(submission.busy ? 'auth.processing' : 'auth.createAccount')}</Submit>
    </form>
  </Shell>
}

export function ForgotPassword() {
  const { t } = useLang()
  return <Shell title={t('auth.forgotTitle')} desc={t('auth.forgotDesc')} footer={<Link to="/login" className="underline">{t('auth.backLogin')}</Link>}>
    <PasswordResetRequest />
  </Shell>
}

export function ResetPassword() {
  const { t } = useLang()
  const { loading, recovery, resetPassword } = useAuth()
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [saved, setSaved] = useState(false)
  const inFlight = useRef(false)
  const callbackError = new URLSearchParams(window.location.hash.slice(1)).has('error') || new URLSearchParams(window.location.search).has('error')
  const form = useForm({ password: '', confirm: '' }, v => ({
    password: v.password.length < MIN_PASSWORD && t('auth.errPassword'),
    confirm: (!v.confirm || v.confirm !== v.password) && t('auth.errConfirm'),
  }))
  const onSubmit = async e => {
    e.preventDefault()
    if (inFlight.current || !recovery || !form.check()) return
    inFlight.current = true
    setBusy(true)
    setStatus('')
    try {
      const res = await resetPassword(form.values.password)
      if (!res.ok) return setStatus(authError(t, res.error))
      form.setValues({ password: '', confirm: '' })
      setSaved(true)
      if (res.signOutFailed) setStatus(t('auth.signOutFailed'))
    } finally { inFlight.current = false; setBusy(false) }
  }
  if (loading) return <Shell title={t('auth.resetTitle')}><p role="status">{t('auth.processing')}</p></Shell>
  if (saved) return <Shell title={t('auth.resetTitle')}>
    <p role="status">{t('auth.passwordSaved')}</p>
    {status && <p role="alert" className="mt-4">{status}</p>}
    <Link to="/login" className="button mt-6 w-full">{t('auth.backLogin')}</Link>
  </Shell>
  if (!recovery || callbackError) return <Shell title={t('auth.resetTitle')}>
    <p role="alert">{t('auth.invalidRecovery')}</p>
    <Link to="/forgot-password" className="button mt-6 w-full">{t('auth.sendLink')}</Link>
  </Shell>
  return <Shell title={t('auth.resetTitle')} desc={t('auth.resetDesc')} footer={<Link to="/login" className="font-medium underline underline-offset-4">{t('auth.backLogin')}</Link>}>
    <form onSubmit={onSubmit} noValidate>
      <Field id="password" type="password" autoComplete="new-password" label={t('auth.newPassword')} placeholder={t('auth.passwordHint')} {...form.bind('password')} />
      <Field id="confirm" type="password" autoComplete="new-password" label={t('auth.confirm')} {...form.bind('confirm')} />
      {status && <p role="alert" className="mb-4 text-sm text-red-700">{status}</p>}
      <Submit disabled={busy}>{t(busy ? 'auth.processing' : 'auth.savePassword')}</Submit>
    </form>
  </Shell>
}
