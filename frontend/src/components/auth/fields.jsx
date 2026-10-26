import { useState } from 'react'
import Icon from '../Icon'
import { normalizeSpacingEvent } from '../../lib/inputSpacing'
import { useLang } from '../../i18n'

// Dùng chung cho trang /login và cho drawer tài khoản, để hai nơi không lệch
// nhau về quy tắc kiểm tra dữ liệu.
export const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
export const MIN_PASSWORD = 8

export function Field({ id, label, error, type = 'text', required = true, registration = false, ...props }) {
  const { t } = useLang()
  const [show, setShow] = useState(false)
  const isPassword = type === 'password'
  return <div className="mb-5">
    <label htmlFor={id} className="mb-2 block text-body-sm font-medium text-ink">{label.replace(/\s*\*$/, '')}{required && <span aria-hidden="true" className="text-danger"> *</span>}</label>
    <div className="relative">
      <input required={required} maxLength={isPassword ? 128 : type === 'email' ? 254 : 120} minLength={isPassword && props.autoComplete === 'new-password' ? MIN_PASSWORD : undefined} id={id} name={id} type={isPassword && show ? 'text' : type} aria-invalid={!!error} aria-describedby={error ? `${id}-err` : undefined} {...props}
        onChange={e => { if (registration) normalizeRegistrationEvent(e, type); else if (!isPassword) normalizeSpacingEvent(e); props.onChange?.(e) }}
        className={`min-h-(--control-h) w-full border bg-paper px-4 py-3 text-body text-ink transition-colors duration-(--duration-fast) placeholder:text-ink-muted focus:border-ink disabled:bg-cream disabled:text-ink-muted ${isPassword ? 'pr-12' : ''} ${error ? 'border-danger' : 'border-line-strong'}`} />
      {isPassword && <button type="button" onClick={() => setShow(!show)} aria-label={show ? t('auth.hide') : t('auth.show')} aria-pressed={show}
        className="absolute inset-y-0 right-0 grid w-12 place-items-center text-ink-muted hover:text-ink"><Icon name={show ? 'eyeOff' : 'eye'} size={18} /></button>}
    </div>
    {error && <p id={`${id}-err`} className="mt-2 flex items-start gap-1.5 text-caption text-danger"><span aria-hidden="true" className="mt-px font-medium">!</span><span>{error}</span></p>}
  </div>
}

function normalizeRegistrationEvent(event, type) {
  const input = event.currentTarget
  const before = input.value
  const normalize = value => type === 'tel'
    ? value.replace(/[^0-9]/g, '').slice(0, 10)
    : value.replace(/^\s+/u, '').replace(/\s/gu, ' ').replace(/ {3,}/g, '  ')
  const after = normalize(before)
  if (after === before) return
  const start = input.selectionStart
  const end = input.selectionEnd
  input.value = after
  if (start !== null && end !== null) input.setSelectionRange(normalize(before.slice(0, start)).length, normalize(before.slice(0, end)).length)
}

export function validateRegistration(v, t) {
  const spacingError = value => /^\s|\s{3,}/u.test(value) && t('auth.errSpacing')
  const passwordErrors = []
  if (v.password.length < MIN_PASSWORD) passwordErrors.push(t('auth.passwordLength'))
  if (!/\p{Lu}/u.test(v.password)) passwordErrors.push(t('auth.passwordUppercase'))
  if (!/[0-9]/.test(v.password)) passwordErrors.push(t('auth.passwordNumber'))
  if (!/[^\p{L}\p{M}\p{N}\s]/u.test(v.password)) passwordErrors.push(t('auth.passwordSpecial'))
  return {
    title: !['mr', 'ms', 'other'].includes(v.title) && t('auth.errTitleRequired'),
    name: !v.name.trim() ? t('auth.errNameRequired') : spacingError(v.name) || (!/^[\p{L}\p{M} ]+$/u.test(v.name) ? t('auth.errNameCharacters') : [...v.name.trim()].length < 3 && t('auth.errNameLength')),
    phone: !v.phone ? t('auth.errPhoneRequired') : !/^[0-9]{10}$/.test(v.phone) ? t('auth.errPhoneLength') : !/^0[35789][0-9]{8}$/.test(v.phone) && t('auth.errPhonePrefix'),
    email: !v.email.trim() ? t('auth.errEmailRequired') : !EMAIL.test(v.email) && t('auth.errEmail'),
    password: !v.password ? t('auth.errPasswordRequired') : spacingError(v.password) || (passwordErrors.length > 0 && `${t('auth.passwordMissing')} ${passwordErrors.join(', ')}.`),
    confirm: !v.confirm ? t('auth.errConfirmRequired') : spacingError(v.confirm) || (v.confirm !== v.password && t('auth.errConfirm')),
    terms: !v.terms && t('auth.errTerms'),
  }
}

export function useForm(initial, validate) {
  const [values, setValues] = useState(initial)
  const [errors, setErrors] = useState({})
  const bind = key => ({
    value: values[key],
    error: errors[key],
    onChange: e => { setValues(v => ({ ...v, [key]: e.target.value })); setErrors(er => ({ ...er, [key]: undefined })) },
  })
  const check = () => { const next = validate(values); setErrors(next); return !Object.values(next).some(Boolean) }
  return { values, setValues, errors, bind, check }
}

export const Submit = ({ children, ...props }) =>
  <button type="submit" {...props} className="button button--primary mt-2 w-full">{children}</button>

export function TitleField({ id, error, ...props }) {
  const { t } = useLang()
  return <div className="mb-5">
    <label htmlFor={id} className="mb-2 block text-body-sm font-medium text-ink">{t('auth.title')} <span className="text-danger" aria-hidden="true">*</span></label>
    <select id={id} name={id} required aria-invalid={!!error} aria-describedby={error ? `${id}-err` : undefined} {...props} className={`min-h-(--control-h) w-full border bg-paper px-4 py-3 text-body text-ink focus:border-ink ${error ? 'border-danger' : 'border-line-strong'}`}>
      <option value="" disabled>{t('auth.titlePlaceholder')}</option>
      <option value="mr">{t('auth.mr')}</option><option value="ms">{t('auth.ms')}</option><option value="other">{t('auth.other')}</option>
    </select>
    {error && <p id={`${id}-err`} role="alert" className="mt-2 text-caption text-danger">{error}</p>}
  </div>
}
