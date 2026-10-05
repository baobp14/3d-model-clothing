import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { LanguageProvider } from '../i18n'
import StockAlerts from './StockAlerts'
import StockHistory from '../components/StockHistory'
import AdminNotifications from '../components/AdminNotifications'
import ExportButton from '../components/ExportButton'
import Orders from './Orders'

const { request } = vi.hoisted(() => ({ request: vi.fn() }))
vi.mock('../lib/api', () => ({ shopApi: { request } }))
vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'admin' } }) }))
afterEach(() => { cleanup(); request.mockReset(); localStorage.clear(); vi.unstubAllGlobals(); vi.restoreAllMocks() })
function mount(component, path = '/') {
  localStorage.setItem('lang', 'en')
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
  return render(<MemoryRouter initialEntries={[path]}><LanguageProvider>{component}</LanguageProvider></MemoryRouter>)
}

it('a low-stock variant links to its actual product stock editor', async () => {
  request.mockResolvedValue({ alerts: [{ product_id: 7, name_vi: 'Áo', name_en: 'Shirt', color: 'black', color_names: { en: 'Midnight black' }, size: 'M', stock: 0, href: '/admin/inventory/products/7#variant-stock' }], total: 1, pages: 1 })
  mount(<StockAlerts />)
  const link = await screen.findByRole('link', { name: /Shirt/ })
  expect(link.getAttribute('href')).toBe('/admin/inventory/products/7#variant-stock')
  expect(screen.getByText('Out of stock')).toBeTruthy()
  expect(screen.getByText(/Midnight black/)).toBeTruthy()
})

it('history connects recorded quantity changes to the order and actor', async () => {
  request.mockResolvedValue({ movements: [{ id: 'movement', before_stock: 5, after_stock: 4, actor_id: 'customer', kind: 'order', reason: '', created_at: '2026-10-05T00:00:00Z', order_id: 'order', changes: [{ color: 'black', size: 'M', before: 1, after: 0 }] }], total: 1, pages: 1 })
  mount(<StockHistory product={{ id: 7, stock: 4, stockRevision: 1, colors: ['black'], sizes: ['M'] }} colors={[{ id: 'black', en: 'Midnight black' }]} />)
  expect(await screen.findByText('Order placed: 5 → 4')).toBeTruthy()
  expect(screen.getByText(/Actor ID: customer/)).toBeTruthy()
  expect(screen.getByRole('link', { name: /View order/ }).getAttribute('href')).toBe('/admin/orders?q=order')
})

it('notification read state persists through its API and links to pending orders', async () => {
  let read = false
  request.mockImplementation(async (path, options) => {
    if (options?.method === 'POST') { read = true; expect(options.body.keys).toEqual(['order:abc']) }
    return { unread: read ? 0 : 1, notifications: [{ key: 'order:abc', kind: 'order', id: 'abc', href: '/admin/orders?q=abc', read }] }
  })
  mount(<AdminNotifications />)
  fireEvent.click(screen.getByRole('button', { name: 'Notifications' }))
  await screen.findByRole('link', { name: /New order awaiting confirmation/ })
  fireEvent.click(screen.getByRole('button', { name: 'Read all displayed items' }))
  await waitFor(() => expect(screen.getByRole('button', { name: 'Read all displayed items' }).disabled).toBe(true))
  expect(request.mock.calls.some(([path]) => path === '/admin/notifications/read')).toBe(true)
})

it('marking an order as test refreshes the applied real-order filter', async () => {
  vi.stubGlobal('confirm', vi.fn(() => true))
  let marked = false
  request.mockImplementation(async (_, options) => {
    if (options?.method === 'PATCH') { marked = true; expect(options.body).toEqual({ is_test: true, expected_is_test: false }); return { id: 'abc', is_test: true } }
    return { orders: marked ? [] : [{ id: 'abc', status: 'pending', payment: 'cod', total: 1, created_at: '2026-10-05T00:00:00Z', items: [], delivery: { name: 'Customer', phone: '000', address: 'Street', city: 'City' } }], total: marked ? 0 : 1, page: 1, pages: 1 }
  })
  mount(<Orders admin />, '/admin/orders?scope=real')
  fireEvent.click(await screen.findByRole('button', { name: 'Mark as test order' }))
  await screen.findByText('No matching orders.')
  expect(request.mock.calls.filter(([path]) => path.includes('scope=real')).length).toBe(2)
})

it('CSV download uses applied filters and handles a too-large export clearly', async () => {
  const create = vi.fn(() => 'blob:test'), revoke = vi.fn()
  vi.stubGlobal('URL', class extends URL { static createObjectURL = create; static revokeObjectURL = revoke })
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
  request.mockResolvedValueOnce({ csv: 'a,b\r\n1,2', filename: 'orders.csv' }).mockRejectedValueOnce({ code: 'NB_EXPORT_TOO_LARGE' })
  mount(<ExportButton endpoint="/admin/orders/export?scope=real&status=pending" />)
  fireEvent.click(screen.getByRole('button', { name: 'Export CSV' }))
  await waitFor(() => expect(click).toHaveBeenCalled())
  expect(request.mock.calls[0][0]).toContain('scope=real&status=pending')
  fireEvent.click(screen.getByRole('button', { name: 'Export CSV' }))
  await screen.findByText(/Too much data/)
})
