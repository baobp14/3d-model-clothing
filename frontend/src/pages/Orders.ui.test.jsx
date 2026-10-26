import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { LanguageProvider } from '../i18n'
import Orders from './Orders'

const { request } = vi.hoisted(() => ({ request: vi.fn() }))
vi.mock('../lib/api', () => ({ shopApi: { request } }))
vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'customer' } }) }))
afterEach(() => { cleanup(); vi.unstubAllGlobals(); request.mockReset() })
const order = { id: 'order-id', created_at: '2026-10-05T00:00:00Z', status: 'pending', payment: 'cod', total: 180,
  subtotal: 200, discount: 20, promotion_code: 'SAVE10', delivery: { name: 'Customer', phone: '0901234567', address: 'Street', city: 'City' },
  items: [{ product_id: 1, name: 'Shirt', quantity: 2, price: 100, color: 'black', size: 'M' }] }

it('customer history displays saved discount and replaces cancel action after confirmed cancellation', async () => {
  localStorage.setItem('lang', 'en')
  vi.stubGlobal('confirm', vi.fn(() => true))
  let current = order
  request.mockImplementation(async (_, options) => {
    if (options?.method === 'PATCH') { current = { ...order, status: 'canceled' }; return current }
    return { orders: [current], total: 1, pages: 1, page: 1 }
  })
  render(<MemoryRouter><LanguageProvider><Orders /></LanguageProvider></MemoryRouter>)
  fireEvent.click(await screen.findByRole('button', { name: 'Cancel order' }))
  await screen.findByText('Canceled', { selector: '.badge' })
  expect(screen.queryByRole('button', { name: 'Cancel order' })).toBe(null)
  expect(request.mock.calls[1]).toEqual(['/orders/order-id', { auth: true, method: 'PATCH', body: { status: 'canceled', expected_status: 'pending' } }])
  expect(screen.getByRole('link', { name: /Shirt/ }).getAttribute('href')).toBe('/product/1')
  expect(screen.getByText(/Discount.*SAVE10/)).toBeTruthy()
})

it('admin uses admin endpoints and only offers the next allowed lifecycle transitions', async () => {
  localStorage.setItem('lang', 'en')
  let current = { ...order, status: 'confirmed' }
  request.mockImplementation(async (_, options) => {
    if (options?.method === 'PATCH') { current = { ...order, status: 'shipped' }; return current }
    return { orders: [current], total: 1, pages: 1, page: 1 }
  })
  render(<MemoryRouter><LanguageProvider><Orders admin /></LanguageProvider></MemoryRouter>)
  fireEvent.click(await screen.findByRole('button', { name: 'Mark as: Shipping' }))
  await screen.findByRole('button', { name: 'Mark as: Delivered' })
  expect(screen.queryByRole('button', { name: 'Cancel order' })).toBe(null)
  expect(request.mock.calls[1][0]).toBe('/admin/orders/order-id')
})

it('pagination and filters request bounded server pages and display translated product/color snapshots', async () => {
  localStorage.setItem('lang', 'en')
  request.mockImplementation(async path => {
    const params = new URL(path, 'https://local.test').searchParams
    const page = Number(params.get('page') || 1)
    return { orders: [{ ...order, id: `page-${page}`, items: [{ ...order.items[0], name: 'Áo', name_en: 'Classic shirt', color: 'black', color_en: 'Black' }] }], total: 21, pages: 2, page }
  })
  render(<MemoryRouter><LanguageProvider><Orders /></LanguageProvider></MemoryRouter>)
  await screen.findByRole('link', { name: /Classic shirt.*Black/ })
  fireEvent.click(screen.getByRole('button', { name: 'Next page' }))
  await screen.findByText('Order: page-2')
  expect(request.mock.calls.some(([path]) => path === '/orders?page=2')).toBe(true)
  fireEvent.change(screen.getByLabelText('Order ID, recipient, phone or email'), { target: { value: '0901234567' } })
  fireEvent.change(screen.getByLabelText('Payment receipt'), { target: { value: 'received' } })
  fireEvent.click(screen.getByRole('button', { name: 'Search / filter' }))
  await screen.findByText('Order: page-1')
  const path = request.mock.calls.at(-1)[0]
  expect(path).toContain('q=0901234567')
  expect(path).toContain('paid=received')
  expect(path).not.toContain('page=2')
})

it('recording actual receipt updates payment status and keeps an admin cancel that warns about the refund', async () => {
  localStorage.setItem('lang', 'en')
  vi.stubGlobal('confirm', vi.fn(() => true))
  let current = { ...order, payment_status: 'unpaid' }
  request.mockImplementation(async (_, options) => {
    if (options?.method === 'PATCH') { current = { ...current, payment_status: 'received', received_at: '2026-10-05T01:00:00Z' }; return current }
    return { orders: [current], total: 1, pages: 1, page: 1 }
  })
  render(<MemoryRouter><LanguageProvider><Orders admin /></LanguageProvider></MemoryRouter>)
  fireEvent.click(await screen.findByRole('button', { name: 'Record payment received' }))
  await screen.findByText(/Payment received ·/, { selector: 'p' })
  expect(request.mock.calls.find(([path]) => path.endsWith('/payment'))).toEqual(['/admin/orders/order-id/payment', { method: 'PATCH', auth: true, body: { received: true } }])
  // Admins may still cancel a paid order; the confirmation says a refund will be opened.
  fireEvent.click(screen.getByRole('button', { name: 'Cancel order' }))
  expect(window.confirm).toHaveBeenLastCalledWith(expect.stringContaining('opens a refund'))
})
