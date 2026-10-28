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
HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
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

it('allows creating product using AI Model Try-On with 2 photos (front and back)', async () => {
  localStorage.setItem('lang', 'vi')
  request.mockImplementation(async path => {
    if (path.startsWith('/product-page?')) {
      return { total: 0, pages: 1, page: 1, stock_units: 0, products: [], categories: [{ id: 'm-shirts', department: 'men', name_vi: 'Áo sơ mi', name_en: 'Shirts' }] }
    }
    if (path === '/admin/products') {
      return { id: 99, name_vi: 'Áo Sơ Mi Oxford Cotton Light Blue', name_en: 'Oxford Cotton Shirt Light Blue', category: 'm-shirts', price: 350000, stock: 500, images: ['/img/ai_tryon/oxford_ai_model.jpg'] }
    }
    return {}
  })

  render(<MemoryRouter><LanguageProvider><Inventory /></LanguageProvider></MemoryRouter>)

  // Click '+ Thêm sản phẩm'
  const addBtn = await screen.findByRole('button', { name: /Thêm sản phẩm/i })
  fireEvent.click(addBtn)

  // Verify modal is opened with AI preset option
  expect(await screen.findByText(/AI Model Try-On/i)).toBeTruthy()
  expect(screen.getByText(/Chọn nhanh bộ quần áo mẫu demo/i)).toBeTruthy()

  // Select Oxford preset
  const presetBtn = screen.getByText(/Sơ Mi Oxford Light Blue/i)
  fireEvent.click(presetBtn)

  // Verify front & back images are loaded
  expect(screen.getByAltText('Front View')).toBeTruthy()
  expect(screen.getByAltText('Back View')).toBeTruthy()

  // Click Generate AI Model button
  const generateBtn = screen.getByRole('button', { name: /KẾT HỢP API & TẠO ẢNH NGƯỜI MẪU AI/i })
  fireEvent.click(generateBtn)

  // Wait for AI generation result to show
  const aiResult = await screen.findByText(/Đã tạo ảnh người mẫu AI Studio thành công/i, {}, { timeout: 5000 })
  expect(aiResult).toBeTruthy()
  expect(screen.getByAltText('AI Studio Model')).toBeTruthy()

  // Submit product creation
  const form = screen.getByRole('button', { name: /KẾT HỢP API & TẠO ẢNH NGƯỜI MẪU AI/i }).closest('form')
  fireEvent.submit(form)
  const submitBtn = screen.getAllByRole('button', { name: /Thêm sản phẩm/i }).find(b => b.classList.contains('bg-[#303a9f]'))
  fireEvent.click(submitBtn)

  // Verify API was called with AI model image
  await screen.findByText(/Đã thêm sản phẩm vào kho và cửa hàng thành công/i)
  const productCalls = request.mock.calls.filter(([path]) => path === '/admin/products')
  expect(productCalls).toHaveLength(1)
  expect(productCalls[0][1].body.image).toBe('/img/ai_tryon/oxford_ai_model.jpg')
  expect(productCalls[0][1].body.name).toBe('Áo Sơ Mi Oxford Cotton Light Blue')
})
