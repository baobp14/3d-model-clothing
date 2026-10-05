import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { LanguageProvider } from '../i18n'
import { productRequestKey } from '../lib/productRequest'
import Inventory from './Inventory'

const { request } = vi.hoisted(() => ({ request: vi.fn() }))
vi.mock('../lib/api', () => ({ shopApi: { request } }))
vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'admin-a' } }) }))
vi.mock('../lib/supabase', () => ({ isSupabaseReady: true }))
afterEach(() => { cleanup(); localStorage.clear(); request.mockReset() })
it('unconfirmed product creation survives reload and retries the same ID without duplicating the catalog row', async () => {
  localStorage.setItem('lang', 'en')
  const payload = { name: 'New shirt', name_en: 'New shirt', category: 'm-tshirts', price: 100, stock: 5, image: '/img/test.webp' }
  localStorage.setItem(productRequestKey('admin-a'), JSON.stringify({ id: 'original-request', payload }))
  const product = { id: 3, name_vi: 'New shirt', name_en: 'New shirt', category: 'm-tshirts', price: 100, stock: 5, colors: [], sizes: [], images: ['/img/test.webp'] }
  let attempts = 0
  request.mockImplementation(async path => {
    if (path.startsWith('/product-page?')) return { total: 1, pages: 1, page: 1, stock_units: 5, products: [product], categories: [{ id: 'm-tshirts', department: 'men', name_vi: 'Áo', name_en: 'Shirts' }] }
    if (++attempts === 1) throw Error('offline')
    return product
  })
  const mount = () => render(<MemoryRouter><LanguageProvider><Inventory /></LanguageProvider></MemoryRouter>)
  const view = mount()
  fireEvent.click(await screen.findByRole('button', { name: 'Check previous product' }))
  await screen.findByText(/Product not confirmed/)
  view.unmount(); mount()
  fireEvent.click(await screen.findByRole('button', { name: 'Check previous product' }))
  await screen.findByText('Product added to inventory and storefront.')
  const requests = request.mock.calls.filter(([path]) => path === '/admin/products')
  expect(requests).toHaveLength(2)
  expect(requests.every(([, options]) => options.body.request_id === 'original-request')).toBe(true)
  expect(screen.getAllByRole('link', { name: /New shirt/ })).toHaveLength(1)
  expect(localStorage.getItem(productRequestKey('admin-a'))).toBe(null)
})
