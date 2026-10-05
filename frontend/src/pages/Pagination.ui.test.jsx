import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { LanguageProvider } from '../i18n'
import Inventory from './Inventory'
import ProductList from './ProductList'
import Wishlist from './Wishlist'
import Promotions from './Promotions'

const { request, saved } = vi.hoisted(() => ({ request: vi.fn(), saved: { ids: [1, 2], owner: 'customer', loading: false, busy: false, error: false, reload: vi.fn() } }))
vi.mock('../lib/api', () => ({ shopApi: { request } }))
vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'admin' } }) }))
vi.mock('../hooks/useWishlist', () => ({ useWishlist: () => saved }))
vi.mock('../components/WishlistButton', () => ({ default: () => null }))
vi.mock('../lib/supabase', () => ({ isSupabaseReady: true }))

const product = id => ({ id, name_vi: `Mẫu ${id}`, name_en: `Sample ${id}`, category: 'shirts', department: 'men', colors: [], sizes: [], images: [], stock: 5, price: 100 })
const pageData = page => ({ products: [product(page)], categories: [{ id: 'shirts', name_vi: 'Áo', name_en: 'Shirts' }], colors: [], sizes: [], page, pages: 2, total: 21, stock_units: 105 })
const mount = component => { localStorage.setItem('lang', 'en'); return render(<MemoryRouter><LanguageProvider>{component}</LanguageProvider></MemoryRouter>) }
afterEach(() => { cleanup(); request.mockReset(); localStorage.clear(); vi.unstubAllGlobals() })

it.each([false, true])('inventory/pricing fetch a bounded next page and reset page when searching (pricing=%s)', async pricing => {
  request.mockImplementation(async path => { const p = new URLSearchParams(path.split('?')[1]); return pageData(Number(p.get('page'))) })
  mount(<Inventory pricing={pricing} />)
  await screen.findByRole('link', { name: /Sample 1/ })
  expect(screen.getByText(/105 units in stock/)).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Next page' }))
  await screen.findByRole('link', { name: /Sample 2/ })
  expect(screen.queryByRole('link', { name: /Sample 1/ })).toBeNull()
  fireEvent.change(screen.getByLabelText('Search products'), { target: { value: 'shirt' } })
  await screen.findByRole('link', { name: /Sample 1/ })
  expect(request.mock.calls.some(([path]) => path.includes('page=1') && path.includes('q=shirt') && path.includes('limit=20'))).toBe(true)
})

it('product lists fetch 12 per page and changing sort resets to page 1', async () => {
  vi.stubGlobal('scrollTo', vi.fn())
  request.mockImplementation(async path => pageData(Number(new URLSearchParams(path.split('?')[1]).get('page'))))
  mount(<ProductList />)
  await screen.findAllByRole('link', { name: 'Sample 1' })
  fireEvent.click(screen.getByRole('button', { name: 'Next page' }))
  await screen.findAllByRole('link', { name: 'Sample 2' })
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'priceDesc' } })
  await screen.findAllByRole('link', { name: 'Sample 1' })
  expect(request.mock.calls.some(([path]) => path.includes('limit=12') && path.includes('page=1') && path.includes('sort=priceDesc'))).toBe(true)
})

it('wishlist uses its protected product page rather than loading the full catalog', async () => {
  request.mockImplementation(async path => pageData(Number(new URLSearchParams(path.split('?')[1]).get('page'))))
  mount(<Wishlist />)
  await screen.findByRole('link', { name: /Sample 1/ })
  fireEvent.click(screen.getByRole('button', { name: 'Next page' }))
  await screen.findByRole('link', { name: /Sample 2/ })
  expect(request.mock.calls.every(([path, options]) => path.startsWith('/wishlist/products?') && options.auth)).toBe(true)
})

it('promotions show only the requested page', async () => {
  request.mockImplementation(async path => { const page = Number(new URLSearchParams(path.split('?')[1]).get('page')); return { promotions: [{ code: `CODE${page}`, percent: 10, active: true }], total: 21, pages: 2, page } })
  mount(<Promotions />)
  await screen.findByText('CODE1')
  fireEvent.click(screen.getByRole('button', { name: 'Next page' }))
  await screen.findByText('CODE2')
  expect(screen.queryByText('CODE1')).toBeNull()
  await waitFor(() => expect(request.mock.calls.some(([path]) => path.includes('page=2&limit=20'))).toBe(true))
})
