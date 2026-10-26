import { afterEach, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { LanguageProvider } from '../i18n'
import { Register } from './Auth'
import { validateRegistration } from '../components/auth/fields'
import AccountDrawer from '../components/AccountDrawer'
const { signUp } = vi.hoisted(() => ({ signUp: vi.fn() }))
vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ signUp }) }))
afterEach(() => { cleanup(); localStorage.clear(); vi.unstubAllGlobals(); signUp.mockClear() })
it('blocks duplicate registration submissions and recovers with a localized error', async () => {
  localStorage.setItem('lang', 'vi')
  vi.stubGlobal('scrollTo', vi.fn())
  let finish
  signUp.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  render(<MemoryRouter><LanguageProvider><Register /></LanguageProvider></MemoryRouter>)
  for (const [id, value] of Object.entries({ title: 'ms', name: 'Test User', email: 'test@example.com', phone: '0912345678', password: 'Password123!', confirm: 'Password123!' })) fireEvent.change(document.getElementById(id), { target: { value } })
  fireEvent.click(screen.getByRole('checkbox'))
  const form = screen.getByRole('button', { name: 'Tạo tài khoản' }).closest('form')
  fireEvent.submit(form)
  fireEvent.submit(form)
  expect(signUp).toHaveBeenCalledTimes(1)
  expect(form.querySelector('button[type="submit"]').disabled).toBe(true)
  await act(async () => finish({ ok: false, error: 'User already registered' }))
  expect(screen.getByText('Email này đã được đăng ký. Vui lòng đăng nhập.')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Tạo tài khoản' }).disabled).toBe(false)
})
it('requires registration fields and validates phone before submitting profile', async () => {
  localStorage.setItem('lang', 'en')
  vi.stubGlobal('scrollTo', vi.fn())
  signUp.mockResolvedValue({ ok: true, needsConfirm: true })
  render(<MemoryRouter><LanguageProvider><Register /></LanguageProvider></MemoryRouter>)
  const submit = screen.getByRole('button', { name: 'Create account' })
  fireEvent.click(submit)
  expect(signUp).not.toHaveBeenCalled()
  expect(document.getElementById('title').getAttribute('aria-invalid')).toBe('true')
  expect(document.getElementById('confirm').getAttribute('aria-invalid')).toBe('true')
  for (const [id, value] of Object.entries({ title: 'ms', name: 'Test User', email: 'test@example.com', phone: '123', password: 'Password123!', confirm: 'Password123!' })) fireEvent.change(document.getElementById(id), { target: { value } })
  fireEvent.click(screen.getByRole('checkbox'))
  fireEvent.click(submit)
  expect(signUp).not.toHaveBeenCalled()
  expect(document.getElementById('phone').getAttribute('aria-invalid')).toBe('true')
  fireEvent.change(document.getElementById('phone'), { target: { value: '0912345678' } })
  fireEvent.click(submit)
  await waitFor(() => expect(signUp).toHaveBeenCalledWith('test@example.com', 'Password123!', 'Test User', { title: 'ms', phone: '0912345678' }))
})

it('rejects invalid names, phone numbers and weak passwords', () => {
  const valid = { title: 'ms', name: 'Test User', email: 'test@example.com', phone: '0912345678', password: 'Password1!', confirm: 'Password1!', terms: true }
  const check = value => validateRegistration({ ...valid, ...value }, key => key)
  expect(Object.values(check({})).some(Boolean)).toBe(false)
  for (const name of ['An', 'An@', 'An123', '   An', 'An   B']) expect(check({ name }).name).toBeTruthy()
  for (const phone of ['0123456789', '+84912345678', '091234567', '09123456789', '091a345678']) expect(check({ phone }).phone).toBeTruthy()
  for (const password of ['password1!', 'Password!', 'Password1', 'Ab1!', ' Password1!', 'Password   1!']) expect(check({ password }).password).toBeTruthy()
})
it('normalizes pasted input and renders red required markers', () => {
  localStorage.setItem('lang', 'en')
  vi.stubGlobal('scrollTo', vi.fn())
  render(<MemoryRouter><LanguageProvider><Register /></LanguageProvider></MemoryRouter>)
  for (const [id, value, expected] of [['name', '  Test   User', 'Test  User'], ['phone', '091a234567890', '0912345678'], ['password', ' Password   123!', 'Password  123!']]) {
    const input = document.getElementById(id)
    fireEvent.change(input, { target: { value } })
    expect(input.value).toBe(expected)
  }
  for (const label of document.querySelectorAll('label[for]')) expect(label.querySelector('span.text-danger')?.textContent.trim()).toBe('*')
})

for (const mode of ['page', 'drawer']) {
  it(`shows accurate Vietnamese registration messages in the ${mode}`, () => {
    localStorage.setItem('lang', 'vi')
    vi.stubGlobal('scrollTo', vi.fn())
    render(<MemoryRouter><LanguageProvider>{mode === 'page' ? <Register /> : <AccountDrawer open onClose={() => {}} />}</LanguageProvider></MemoryRouter>)
    if (mode === 'drawer') fireEvent.click(screen.getByRole('button', { name: 'Tạo tài khoản' }))
    const submit = screen.getByRole('button', { name: 'Tạo tài khoản' })
    fireEvent.click(submit)
    for (const message of ['Vui lòng chọn danh xưng.', 'Vui lòng nhập họ và tên.', 'Vui lòng nhập email.', 'Vui lòng nhập số điện thoại.', 'Vui lòng nhập mật khẩu.', 'Vui lòng nhập lại mật khẩu xác nhận.']) expect(screen.getByText(message)).toBeTruthy()
    expect(screen.getByPlaceholderText('Ít nhất 8 ký tự, có chữ hoa, số và ký tự đặc biệt')).toBeTruthy()
    const name = document.getElementById(mode === 'page' ? 'name' : 'dw-name')
    const phone = document.getElementById(mode === 'page' ? 'phone' : 'dw-phone')
    const password = document.getElementById(mode === 'page' ? 'password' : 'dw-rpassword')
    fireEvent.change(name, { target: { value: 'aa' } })
    fireEvent.change(phone, { target: { value: '0123456789' } })
    fireEvent.change(password, { target: { value: 'password1!' } })
    fireEvent.click(submit)
    expect(screen.getByText('Họ và tên phải có ít nhất 3 ký tự.')).toBeTruthy()
    expect(screen.getByText('Số điện thoại Việt Nam phải bắt đầu bằng 03, 05, 07, 08 hoặc 09.')).toBeTruthy()
    expect(screen.getByText('Mật khẩu cần bổ sung: chữ hoa.')).toBeTruthy()
    fireEvent.change(name, { target: { value: 'An@' } })
    fireEvent.change(phone, { target: { value: '09123' } })
    fireEvent.click(submit)
    expect(screen.getByText('Họ và tên chỉ được chứa chữ cái và dấu cách, không chứa số hoặc ký tự đặc biệt.')).toBeTruthy()
    expect(screen.getByText('Số điện thoại phải gồm đúng 10 chữ số.')).toBeTruthy()
    expect(document.body.textContent).not.toContain('auth.err')
    expect(signUp).not.toHaveBeenCalled()
  })
}
