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

it('allows creating product with front/back photos and generates 3 AI studio models before adding', async () => {
  localStorage.setItem('lang', 'vi')
  request.mockImplementation(async path => {
    if (path.startsWith('/product-page?')) {
      return { total: 0, pages: 1, page: 1, stock_units: 0, products: [], categories: [{ id: 'm-shirts', department: 'men', name_vi: 'Áo sơ mi', name_en: 'Shirts' }] }
    }
    if (path === '/admin/products') {
      return { id: 99, name_vi: 'Áo Polo Classic Pique Navy', name_en: 'Classic Navy Pique Polo Shirt', category: 'm-shirts', price: 350000, stock: 500, images: ['/img/ai_tryon/polo_front.jpg'] }
    }
    return {}
  })

  render(<MemoryRouter><LanguageProvider><Inventory /></LanguageProvider></MemoryRouter>)

  // Click '+ Thêm sản phẩm'
  const addBtn = await screen.findByRole('button', { name: /Thêm sản phẩm/i })
  fireEvent.click(addBtn)

  // Verify modal header
  expect(await screen.findByText(/Thêm sản phẩm mới vào kho/i)).toBeTruthy()
  expect(screen.getByText(/1\. Thông tin sản phẩm/i)).toBeTruthy()
  expect(screen.getByText(/2\. Hình ảnh sản phẩm & Người mẫu AI Studio/i)).toBeTruthy()

  // Enter product names
  const nameInput = screen.getByPlaceholderText(/VD: Áo Polo Classic Pique Navy/i)
  fireEvent.change(nameInput, { target: { value: 'Áo Polo Classic Pique Navy' } })
  const nameEnInput = screen.getByPlaceholderText(/VD: Classic Navy Pique Polo Shirt/i)
  fireEvent.change(nameEnInput, { target: { value: 'Classic Navy Pique Polo Shirt' } })

  // Upload front and back photos using simulated files
  const fileInputs = document.querySelectorAll('input[type="file"]')
  expect(fileInputs.length).toBeGreaterThanOrEqual(2)

  const frontFile = new File(['front-img-bytes'], '1_Ao_Polo_Navy_Mat_Truoc.jpg', { type: 'image/jpeg' })
  const backFile = new File(['back-img-bytes'], '1_Ao_Polo_Navy_Mat_Sau.jpg', { type: 'image/jpeg' })

  fireEvent.change(fileInputs[0], { target: { files: [frontFile] } })
  fireEvent.change(fileInputs[1], { target: { files: [backFile] } })

  // Wait for front image to render
  const frontImg = await screen.findByAltText('Mặt trước')
  expect(frontImg).toBeTruthy()

  // Click Generate 3 AI Studio Models button
  const generateBtn = screen.getByRole('button', { name: /Tạo 3 ảnh người mẫu AI Studio/i })
  fireEvent.click(generateBtn)

  // Wait for 3 AI model photos preview to display
  const aiResult = await screen.findByText(/3 Ảnh Người Mẫu AI Studio \(Xem trước\)/i, {}, { timeout: 5000 })
  expect(aiResult).toBeTruthy()
  expect(screen.getByAltText('Mẫu 1 - Mặt trước')).toBeTruthy()
  expect(screen.getByAltText('Mẫu 2 - Mặt sau')).toBeTruthy()
  expect(screen.getByAltText('Mẫu 3 - Cận cảnh')).toBeTruthy()

  // Submit product creation
  const form = screen.getByRole('button', { name: /Tạo 3 ảnh người mẫu AI Studio/i }).closest('form')
  fireEvent.submit(form)

  // Verify API was called with front image as primary avatar and full images list
  await screen.findByText(/Đã thêm sản phẩm vào kho và cửa hàng thành công/i)
  const productCalls = request.mock.calls.filter(([path]) => path === '/admin/products')
  expect(productCalls).toHaveLength(1)
  expect(productCalls[0][1].body.name).toBe('Áo Polo Classic Pique Navy')
  expect(productCalls[0][1].body.image).toMatch(/^data:image\/jpeg;base64,/)
  expect(productCalls[0][1].body.images).toHaveLength(5)
})
