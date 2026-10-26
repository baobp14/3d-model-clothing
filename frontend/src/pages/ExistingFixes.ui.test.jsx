import { afterEach, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { LanguageProvider } from '../i18n'
import Admin from './Admin'
import Inventory from './Inventory'
import InventoryDetail from './InventoryDetail'
import ProductList from './ProductList'
import ProductDetail from './ProductDetail'
import Orders from './Orders'

const { request, signOut } = vi.hoisted(() => ({ request: vi.fn(), signOut: vi.fn() }))
vi.mock('../lib/api', () => ({ shopApi: { request } }))
vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'admin', email: 'admin@example.invalid' }, isAdmin: true, loading: false, signOut }) }))
vi.mock('../hooks/useCart', () => ({ useCart: () => ({ ready: true, add: vi.fn(), pending: null }) }))
vi.mock('../components/WishlistButton', () => ({ default: () => null }))
vi.mock('../lib/supabase', () => ({ isSupabaseReady: true }))
const product = { id: 2, name_vi: 'Tên tiếng Việt', name_en: 'English shirt', category: 'shirts', department: 'men', colors: [], sizes: ['M'], images: [], stock: 5, price: 100, description: '', description_en: '' }
vi.mock('../hooks/useProduct', () => ({ useProduct: () => ({ product: { id: 2, vi: 'Tên tiếng Việt', en: 'English shirt', department: 'men', colors: [], sizes: ['M'], images: [], stock: 5, price: 100 }, colors: [], loading: false }) }))
const categories = [{ id: 'shirts', name_vi: 'Áo', name_en: 'Shirts' }]
function Controls() {
  const location = useLocation(), navigate = useNavigate()
  return <><output data-testid="url">{location.pathname + location.search}</output><button onClick={() => navigate('/admin/pricing/products')}>Go pricing</button></>
}
const mount = (path, routes) => {
  localStorage.setItem('lang', 'en')
  vi.stubGlobal('scrollTo', vi.fn())
  return render(<MemoryRouter initialEntries={[path]}><LanguageProvider><Controls /><Routes>{routes}</Routes></LanguageProvider></MemoryRouter>)
}
afterEach(() => { cleanup(); vi.useRealTimers(); request.mockReset(); signOut.mockReset(); localStorage.clear(); vi.unstubAllGlobals(); vi.restoreAllMocks() })

it('inventory waits for typing to settle, resets the page and only requests the latest query', async () => {
  request.mockResolvedValue({ products: [product], categories, colors: [], sizes: ['M'], total: 21, pages: 2, page: 2, stock_units: 100 })
  const view = mount('/admin/inventory/products?page=2', <Route path="/admin/inventory/products" element={<Inventory />} />)
  await screen.findByRole('link', { name: /English shirt/ })
  request.mockClear()
  vi.useFakeTimers()
  const input = screen.getByLabelText('Search products')
  for (const value of ['s', 'sh', 'shirt']) fireEvent.change(input, { target: { value } })
  fireEvent(window, new Event('focus'))
  expect(screen.getByTestId('url').textContent).toContain('q=shirt')
  expect(screen.getByTestId('url').textContent).not.toContain('page=2')
  expect(request).not.toHaveBeenCalled()
  await act(async () => { await vi.advanceTimersByTimeAsync(299) })
  expect(request).not.toHaveBeenCalled()
  await act(async () => { await vi.advanceTimersByTimeAsync(1) })
  expect(request).toHaveBeenCalledTimes(1)
  expect(request.mock.calls[0][0]).toContain('q=shirt')
  expect(request.mock.calls[0][0]).toContain('page=1')
  fireEvent.change(input, { target: { value: 'dress' } })
  view.unmount()
  await act(async () => { await vi.advanceTimersByTimeAsync(300) })
  expect(request).toHaveBeenCalledTimes(1)
})

it('inventory details preserve page and filters and load only product metadata, with an English heading', async () => {
  request.mockImplementation(async path => path === '/products/2' ? { product, categories, colors: [] } : { products: [product], categories, colors: [], sizes: ['M'], total: 21, pages: 2, page: 2, stock_units: 100 })
  const original = '/admin/inventory/products?page=2&q=shirt&stock=low_or_out&sort=price'
  mount(original, <><Route path="/admin/inventory/products" element={<Inventory />} /><Route path="/admin/inventory/products/:id" element={<InventoryDetail />} /></>)
  fireEvent.click(await screen.findByRole('link', { name: /English shirt/ }))
  await screen.findByText('English shirt · #2')
  expect(request.mock.calls.some(([path]) => path === '/catalog')).toBe(false)
  fireEvent.click(screen.getByRole('link', { name: '← Back to product list' }))
  await screen.findByRole('link', { name: /English shirt/ })
  expect(screen.getByTestId('url').textContent).toBe(original)
  expect(screen.getByLabelText('Search products').value).toBe('shirt')
  expect(screen.getByLabelText('Stock').value).toBe('low_or_out')
})

it.each([
  ['NB_VARIANT_HAS_STOCK', 'This color/size still has stock'],
  ['NB_VARIANT_IN_USE', 'This color/size is used by pending or confirmed orders'],
])('product edit explains %s and preserves edits after a rejected save', async (code, message) => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
  request.mockImplementation(async (path, options) => {
    if (options?.method === 'PATCH') throw Object.assign(Error(code), { code })
    return { product: { ...product, sizes: ['M', 'L'] }, categories, colors: [] }
  })
  mount('/admin/inventory/products/2', <Route path="/admin/inventory/products/:id" element={<InventoryDetail />} />)
  fireEvent.click(await screen.findByRole('button', { name: 'Edit' }))
  fireEvent.change(screen.getByLabelText('Sizes, comma separated'), { target: { value: 'L' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
  await screen.findByText(new RegExp(message))
  expect(screen.getByLabelText('Sizes, comma separated').value).toBe('L')
  expect(screen.getByRole('dialog')).toBeTruthy()
})

it.each(['/account/orders', '/admin/orders'])('returns from a product to %s with its order filters and page', async path => {
  const original = `${path}?page=2&q=customer&status=pending&paid=unpaid`
  request.mockResolvedValue({ orders: [{ id: 'order', status: 'pending', created_at: '2026-10-05T00:00:00Z', payment: 'cod', total: 100, delivery: { name: 'Customer', phone: '0901234567', address: 'Street', city: 'City' }, items: [{ product_id: 2, name: 'English shirt', quantity: 1, price: 100 }] }], total: 21, pages: 2, page: 2 })
  mount(original, <><Route path={path} element={<Orders admin={path.startsWith('/admin')} />} /><Route path="/product/:id" element={<ProductDetail />} /></>)
  fireEvent.click(await screen.findByRole('link', { name: /English shirt/ }))
  fireEvent.click(await screen.findByRole('link', { name: '← Back to list' }))
  await screen.findByRole('link', { name: /English shirt/ })
  expect(screen.getByTestId('url').textContent).toBe(original)
  expect(screen.getByLabelText('Order status').value).toBe('pending')
})

it('search preserves its query, applied size, sort and page through product details', async () => {
  request.mockResolvedValue({ products: [product], categories, colors: [], sizes: ['M'], total: 13, pages: 2, page: 2 })
  const original = '/search?q=shirt&page=2&sizes=M&sort=priceAsc'
  mount(original, <><Route path="/search" element={<ProductList searchQuery="shirt" />} /><Route path="/product/:id" element={<ProductDetail />} /></>)
  fireEvent.click((await screen.findAllByRole('link', { name: 'English shirt' }))[0])
  fireEvent.click(await screen.findByRole('link', { name: '← Back to list' }))
  await screen.findAllByRole('link', { name: 'English shirt' })
  expect(screen.getByTestId('url').textContent).toBe(original)
  expect(request.mock.calls.filter(([path]) => !path.includes('/reviews') && !path.includes('/size-chart') && path !== '/products?limit=100').every(([path]) => path.includes('page=2') && path.includes('sizes=M') && path.includes('sort=priceAsc'))).toBe(true)
})

it('admin navigation opens the active group after navigation without a defaultOpen warning', async () => {
  const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
  mount('/admin/inventory/products', <Route path="/admin" element={<Admin />}><Route path="inventory/products" element={<p>Inventory content</p>} /><Route path="pricing/products" element={<p>Pricing content</p>} /></Route>)
  expect(document.querySelector('a[href="/admin/inventory/products"]').closest('details').open).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: 'Go pricing' }))
  await screen.findByText('Pricing content')
  await waitFor(() => expect(document.querySelector('a[href="/admin/pricing/products"]').closest('details').open).toBe(true))
  expect(errors.mock.calls.some(call => call.join(' ').includes('defaultOpen'))).toBe(false)
})

it('normal sign-out failure does not say that a password was changed', async () => {
  signOut.mockRejectedValue(Error('offline'))
  mount('/admin', <Route path="/admin" element={<Admin />} />)
  fireEvent.click(screen.getAllByRole('button', { name: 'Sign out' })[0])
  const error = await screen.findByRole('alert')
  expect(error.textContent).toBe('Could not sign out. Please check your connection and retry.')
  expect(error.textContent).not.toContain('Password')
})
