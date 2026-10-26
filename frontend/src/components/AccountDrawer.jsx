import useSubmission from '../hooks/useSubmission'
import { TitleField } from './auth/fields'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Drawer, { DrawerHeader } from './ui/Drawer'
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
  <h3 className="font-display text-title-sm">{children}</h3>
  <div className="mt-4 h-px w-10 bg-accent" />
</>

const Ghost = props =>
  <button type="button" {...props} className="button w-full" />

const Switch = ({ children }) =>
  <p className="mt-10 border-t border-line pt-6 text-center text-body-sm text-ink-muted">{children}</p>

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
          className="-mt-2 mb-8 block min-h-11 text-body-sm text-link">{t('auth.forgotQ')}</button>
        {status && <p role="alert" className="mb-4 text-body-sm text-danger">{status}</p>}
        <div className="login-actions">
          <Submit disabled={submission.busy}>{t(submission.busy ? 'auth.processing' : 'auth.login')}</Submit>
          <Ghost onClick={() => go('register')}>{t('auth.createAccount')}</Ghost>
        </div>
      </form>
    </section>

    <section className="mt-7">
      <div className="mb-6 flex items-center gap-4">
        <span className="h-px flex-1 bg-line" />
        <span className="eyebrow text-ink-muted">{t('auth.or')}</span>
        <span className="h-px flex-1 bg-line" />
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
      <label className="mb-8 flex min-h-11 items-start gap-3 text-body-sm text-ink">
        <input type="checkbox" disabled={submission.busy} required checked={form.values.terms} onChange={e => form.setValues(v => ({ ...v, terms: e.target.checked }))} aria-invalid={!!form.errors.terms} className="mt-0.5 size-5 shrink-0 accent-ink" />
        <span>{t('auth.terms')} <span aria-hidden="true" className="text-danger">*</span>{form.errors.terms && <span className="mt-1 block text-danger">{form.errors.terms}</span>}</span>
      </label>
      {status && <p role="alert" className="mb-4 text-body-sm text-ink">{status}</p>}
      <Submit disabled={submission.busy}>{t(submission.busy ? 'auth.processing' : 'auth.createAccount')}</Submit>
    </form>
    <Switch>{t('auth.hasAccount')} <button type="button" onClick={() => go('login')} className="min-h-11 text-ink text-link">{t('auth.login')}</button></Switch>
  </section>
}

function ForgotView({ go, t }) {
  return <section>
    <Heading>{t('auth.forgotTitle')}</Heading>
    <p className="mt-5 mb-8 text-body text-ink-muted">{t('auth.forgotDesc')}</p>
    <PasswordResetRequest prefix="drawer-reset" />
    <Switch><button type="button" onClick={() => go('login')} className="min-h-11 text-link">{t('auth.backLogin')}</button></Switch>
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
    <p className="mt-5 text-body text-ink">{user?.user_metadata?.name || user?.email}</p>
    <p className={`mt-2 inline-block border px-3 py-1 text-micro tracking-[.14em] uppercase ${isAdmin ? 'border-accent text-accent' : 'border-line-strong text-ink-muted'}`}>
      {isAdmin ? t('auth.roleAdmin') : t('auth.roleCustomer')}
    </p>
    {isAdmin && <Link to="/admin" onClick={onDone}
      className="button button--primary mt-10 w-full">{t('admin.open')}</Link>}
    {!isAdmin && <Link to="/account/wishlist" onClick={onDone} className="button mt-6 w-full">{lang === 'vi' ? 'Sản phẩm yêu thích' : 'Wishlist'}</Link>}
    {!isAdmin && <Link to="/account/orders" onClick={onDone} className="button mt-6 w-full">{lang === 'vi' ? 'Đơn hàng của tôi' : 'My orders'}</Link>}
    <Link to="/account/addresses" onClick={onDone} className="button mt-6 w-full">{lang === 'vi' ? 'Sổ địa chỉ của tôi' : 'My address book'}</Link>
    <Link to="/forgot-password" onClick={onDone} className="mt-6 inline-flex min-h-11 items-center text-body-sm text-link">{t('auth.resetTitle')}</Link>
    {error && <p role="alert" className="mt-4 text-body-sm text-danger">{error}</p>}
    <div className="mt-4"><Ghost disabled={submission.busy} onClick={submission.wrap(async () => { setError(''); await signOut(); onDone() })}>{t('auth.signOut')}</Ghost></div>
  </section>
}

const VIEWS = { login: LoginView, register: RegisterView, forgot: ForgotView }

export default function AccountDrawer({ open, onClose }) {
  const { t } = useLang()
  const [view, setView] = useState('login')
  useEffect(() => { if (open) setView('login') }, [open])
  const { user } = useAuth()
  const View = user ? AccountView : VIEWS[view]

  return <Drawer open={open} onClose={onClose} side="right" labelledBy="account-drawer-title" surface="bg-cream" width="sm:w-105 lg:w-1/2">
    <DrawerHeader id="account-drawer-title" title={t('auth.drawerTitle')} onClose={onClose} closeLabel={t('nav.close')} />
    {/* Nửa màn hình 2K vẫn ~1280px — giới hạn bề rộng form để ô nhập không dài lê thê */}
    <div className="flex-1 overflow-y-auto px-(--gutter) py-10 sm:px-10">
      <div key={user ? 'account' : view} className={`mx-auto w-full ${!user && view === 'register' ? 'max-w-[640px]' : 'max-w-md'} motion-safe:animate-[fade-up_.4s_var(--ease-soft)]`}>
        <View go={setView} t={t} onDone={onClose} />
      </div>
    </div>
  </Drawer>
}
