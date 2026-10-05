import useSubmission from '../hooks/useSubmission'
import { TitleField } from './auth/fields'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Icon from './Icon'
import { EMAIL, Field, Submit, useForm, validateRegistration } from './auth/fields'
import GoogleButton from './auth/GoogleButton'
import PasswordResetRequest, { authError } from './auth/PasswordResetRequest'
import { useAuth } from '../hooks/useAuth'
import { useLang } from '../i18n'

/**
 * Drawer tài khoản trượt từ phải.
 *
 * Kiểu chữ và màu bám theo hệ sẵn có của trang: tiêu đề PT Serif chữ hoa,
 * gạch champagne mảnh bên dưới như ở hero, nhãn ô nhập chữ hoa nhỏ giãn cách,
 * nút vuông như mọi nút khác — không bê nguyên kiểu bo tròn của mẫu tham
 * khảo, vì đặt cạnh các trang còn lại sẽ lạc tông.
 *
 * Route /login, /register vẫn giữ cho link trực tiếp và cho /reset-password
 * mở từ email.
 */

const Heading = ({ children }) => <>
  <h2 className="font-display text-[clamp(1.35rem,2.4vw,1.6rem)] leading-tight tracking-[.06em] text-obsidian uppercase">{children}</h2>
  <div className="mt-4 h-px w-10 bg-champagne" />
</>

const Ghost = props =>
  <button type="button" {...props} className="button w-full border-obsidian/30 text-obsidian hover:bg-obsidian hover:text-white" />

const Switch = ({ children }) =>
  <p className="mt-10 border-t border-feather pt-6 text-center text-[13px] text-slate">{children}</p>

function LoginView({ go, t, onDone }) {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [status, setStatus] = useState('')
  const submission = useSubmission(() => setStatus(t('auth.networkError')))
  const form = useForm({ email: '', password: '' }, v => ({
    email: !EMAIL.test(v.email.trim()) && t('auth.errEmail'),
    password: !v.password && t('auth.errRequired'),
  }))
  const onSubmit = submission.wrap(async e => {
    e.preventDefault()
    setStatus('')
    const res = await signIn(form.values.email.trim(), form.values.password)
    if (res.ok) {
      onDone()
      navigate(res.role === 'admin' ? '/admin' : '/')
      return
    }
    setStatus(authError(t, res.error))
  }, () => form.check())
  return <>
    <section>
      <Heading>{t('auth.haveAccount')}</Heading>
      <form onSubmit={onSubmit} noValidate className="mt-8">
        <Field disabled={submission.busy} id="dw-email" type="email" autoComplete="email" label={`${t('auth.email')} *`} {...form.bind('email')} />
        <Field disabled={submission.busy} id="dw-password" type="password" autoComplete="current-password" label={`${t('auth.password')} *`} {...form.bind('password')} />
        <button type="button" onClick={() => go('forgot')}
          className="-mt-2 mb-8 block text-[13px] text-charcoal underline underline-offset-4 hover:text-champagne">{t('auth.forgotQ')}</button>
        {status && <p role="alert" className="mb-4 text-[13px] text-red-700">{status}</p>}
        <div className="login-actions">
          <Submit disabled={submission.busy}>{t(submission.busy ? 'auth.processing' : 'auth.login')}</Submit>
          <Ghost onClick={() => go('register')}>{t('auth.createAccount')}</Ghost>
        </div>
      </form>
    </section>

    <section className="mt-7">
      <div className="mb-6 flex items-center gap-4">
        <span className="h-px flex-1 bg-feather" />
        <span className="text-[11px] tracking-[.16em] text-slate uppercase">{t('auth.or')}</span>
        <span className="h-px flex-1 bg-feather" />
      </div>
      <div className="login-google"><GoogleButton /></div>
    </section>
  </>
}

function RegisterView({ go, t }) {
  const { signUp } = useAuth()
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
  return <section className="registration-panel">
    <Heading>{t('auth.register')}</Heading>
    <form onSubmit={onSubmit} noValidate className="mt-3">
      <div className="registration-fields">
      <TitleField disabled={submission.busy} id="dw-title" {...form.bind('title')} />
      <Field disabled={submission.busy} registration id="dw-name" autoComplete="name" label={`${t('auth.name')} *`} {...form.bind('name')} />
      <Field disabled={submission.busy} registration id="dw-remail" type="email" autoComplete="email" label={`${t('auth.email')} *`} {...form.bind('email')} />
      <Field disabled={submission.busy} registration id="dw-phone" type="tel" autoComplete="tel" label={t('auth.phone')} maxLength={10} inputMode="numeric" placeholder="0912345678" {...form.bind('phone')} />
      <Field disabled={submission.busy} registration id="dw-rpassword" type="password" autoComplete="new-password" label={`${t('auth.password')} *`} placeholder={t('auth.registrationPasswordHint')} {...form.bind('password')} />
      <Field disabled={submission.busy} registration id="dw-confirm" type="password" autoComplete="new-password" label={`${t('auth.confirm')} *`} {...form.bind('confirm')} />
      </div>
      <label className="mb-8 flex items-start gap-3 text-[13px] leading-6 text-charcoal">
        <input type="checkbox" disabled={submission.busy} required checked={form.values.terms} onChange={e => form.setValues(v => ({ ...v, terms: e.target.checked }))} aria-invalid={!!form.errors.terms} className="mt-0.5 h-4 w-4 accent-obsidian" />
        <span>{t('auth.terms')} <span aria-hidden="true" className="text-red-700">*</span>{form.errors.terms && <span className="mt-1 block text-red-700">{form.errors.terms}</span>}</span>
      </label>
      {status && <p role="alert" className="mb-4 text-[13px] text-charcoal">{status}</p>}
      <Submit disabled={submission.busy}>{t(submission.busy ? 'auth.processing' : 'auth.createAccount')}</Submit>
    </form>
    <Switch>{t('auth.hasAccount')} <button type="button" onClick={() => go('login')} className="text-obsidian underline underline-offset-4">{t('auth.login')}</button></Switch>
  </section>
}

function ForgotView({ go, t }) {
  return <section>
    <Heading>{t('auth.forgotTitle')}</Heading>
    <p className="mt-5 mb-8 text-sm leading-7 text-slate">{t('auth.forgotDesc')}</p>
    <PasswordResetRequest prefix="drawer-reset" />
    <Switch><button type="button" onClick={() => go('login')} className="underline">{t('auth.backLogin')}</button></Switch>
  </section>
}

/** Đã đăng nhập: hiện tài khoản + vai trò, thay cho form. */
function AccountView({ t, onDone }) {
  const [error, setError] = useState('')
  const submission = useSubmission(() => setError(t('auth.logoutFailed')))
  const { user, isAdmin, signOut } = useAuth()
  const { lang } = useLang()
  return <section>
    <Heading>{t('auth.hello')}</Heading>
    <p className="mt-5 text-[15px] leading-7 text-obsidian">{user?.user_metadata?.name || user?.email}</p>
    <p className="mt-2 inline-block border px-3 py-1 text-[10px] tracking-[.18em] uppercase"
      style={{ borderColor: isAdmin ? '#9a7b2e' : '#e5e5e5', color: isAdmin ? '#9a7b2e' : '#6f665d' }}>
      {isAdmin ? t('auth.roleAdmin') : t('auth.roleCustomer')}
    </p>
    {isAdmin && <Link to="/admin" onClick={onDone}
      className="button mt-10 w-full border-champagne text-champagne hover:bg-champagne hover:text-white">{t('admin.open')}</Link>}
    {!isAdmin && <Link to="/account/wishlist" onClick={onDone} className="button mt-6 w-full">{lang === 'vi' ? 'Sản phẩm yêu thích' : 'Wishlist'}</Link>}
    {!isAdmin && <Link to="/account/orders" onClick={onDone} className="button mt-6 w-full">{lang === 'vi' ? 'Đơn hàng của tôi' : 'My orders'}</Link>}
    <Link to="/account/addresses" onClick={onDone} className="button mt-6 w-full">{lang === 'vi' ? 'Sổ địa chỉ của tôi' : 'My address book'}</Link>
    <Link to="/forgot-password" onClick={onDone} className="mt-6 block text-sm underline underline-offset-4">{t('auth.resetTitle')}</Link>
    {error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
    <div className="mt-4"><Ghost disabled={submission.busy} onClick={submission.wrap(async () => { setError(''); await signOut(); onDone() })}>{t('auth.signOut')}</Ghost></div>
  </section>
}

const VIEWS = { login: LoginView, register: RegisterView, forgot: ForgotView }

export default function AccountDrawer({ open, onClose }) {
  const { t } = useLang()
  const [view, setView] = useState('login')

  useEffect(() => {
    if (!open) return
    setView('login')
    const onKey = e => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [open, onClose])

  const { user } = useAuth()
  const View = user ? AccountView : VIEWS[view]

  return <>
    <div onClick={onClose} aria-hidden="true"
      className={`fixed inset-0 z-55 bg-obsidian/40 transition-opacity duration-500 ease-soft ${open ? 'opacity-100' : 'pointer-events-none opacity-0'}`} />
    <aside aria-hidden={!open} aria-label={t('auth.drawerTitle')}
      className={`fixed inset-y-0 right-0 z-60 flex w-full flex-col bg-alabaster shadow-2xl transition-transform duration-550 ease-soft will-change-transform lg:w-1/2 ${open ? 'translate-x-0' : 'translate-x-full'}`}>
      <div className="flex items-center justify-between border-b border-feather px-6 py-5 sm:px-10">
        <p className="eyebrow text-[10px] text-slate">{t('auth.drawerTitle')}</p>
        <button onClick={onClose} tabIndex={open ? 0 : -1} aria-label={t('nav.close')} className="-mr-2 p-2 text-charcoal hover:text-champagne"><Icon name="close" size={20} /></button>
      </div>
      {/* Nửa màn hình 2K vẫn ~1280px — để form trải hết thì các ô nhập dài lê thê */}
      <div className="flex-1 overflow-y-auto px-6 py-12 sm:px-10">
        <div key={user ? 'account' : view} className={`mx-auto w-full ${!user && view === 'register' ? 'max-w-[640px]' : 'max-w-md'} animate-[fade-up_.45s_var(--ease-soft)]`}>
          <View go={setView} t={t} onDone={onClose} />
        </div>
      </div>
    </aside>
  </>
}
