import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import Header from '../components/Header'
import { LanguageProvider } from '../i18n'
import Search from './Search'

const { request } = vi.hoisted(() => ({ request: vi.fn() }))
vi.mock('../lib/api', () => ({ shopApi: { request } }))
vi.mock('../lib/supabase', () => ({ supabase: null, isSupabaseReady: false }))
vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ user: null, isAdmin: false }) }))
vi.mock('../hooks/useCart', () => ({ useCart: () => ({ count: 0 }) }))

const catalog = {
  products: [
    { id: 1, department: 'men', name_vi: 'Áo thun cổ điển', name_en: 'Classic T-shirt', category: 'm-tshirts',
      price: 200000, stock: 5, colors: ['black'], sizes: ['M'], images: ['/img/a.webp'] },
    { id: 2, department: 'men', name_vi: 'Áo thun mềm', name_en: 'Soft T-shirt', category: 'm-tshirts',
      price: 100000, stock: 3, colors: ['white'], sizes: ['L'], images: ['/img/b.webp'] },
  ],
  categories: [{ id: 'm-tshirts', department: 'men', name_vi: 'Áo thun', name_en: 'T-shirts' }],
  colors: [{ id: 'black', name_vi: 'Đen', name_en: 'Black', hex: '#000000' },
    { id: 'white', name_vi: 'Trắng', name_en: 'White', hex: '#ffffff' }],
}

function Location() {
  const location = useLocation()
  return <output data-testid="location">{location.pathname + location.search}</output>
}

function mount(path = '/') {
  return render(<MemoryRouter initialEntries={[path]}><LanguageProvider>
    <Header /><Location /><Routes>
      <Route path="/" element={<p>Trang chủ</p>} />
      <Route path="/search" element={<Search />} />
      <Route path="/product/:id" element={<p>Chi tiết sản phẩm</p>} />
    </Routes>
  </LanguageProvider></MemoryRouter>)
}

beforeEach(() => {
  localStorage.clear()
  vi.stubGlobal('scrollTo', vi.fn())
  request.mockReset()
  request.mockImplementation(async path => {
    const params = new URLSearchParams(path.split('?')[1])
    const sizes = (params.get('sizes') || '').split(',').filter(Boolean)
    let products = params.get('q') === 'zzunknown' ? [] : catalog.products.filter(p => !sizes.length || p.sizes.some(size => sizes.includes(size)))
    if (params.get('sort') === 'priceAsc') products = [...products].sort((a, b) => a.price - b.price)
    return { ...catalog, products, sizes: ['M', 'L'], total: products.length, page: Number(params.get('page') || 1), pages: 1 }
  })
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe('Search navigation and results', () => {
  it('submitting header search opens the URL, calls Python API and preserves search history', async () => {
    mount()
    fireEvent.click(screen.getByRole('button', { name: 'Tìm kiếm', exact: true }))
    const input = screen.getByRole('searchbox', { name: 'Tìm kiếm' })
    fireEvent.change(input, { target: { value: '  ao   thun ' } })
    fireEvent.submit(input.closest('form'))
    await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(2))
    expect(screen.getByTestId('location').textContent).toBe('/search?q=ao+thun')
    expect(request.mock.calls.some(([path]) => path.startsWith('/product-page?') && path.includes('q=ao+thun'))).toBe(true)
    expect(screen.getByText('Sản phẩm phù hợp với “ao thun”')).toBeTruthy()
    expect(JSON.parse(localStorage.getItem('searchHistory:guest'))[0].q).toBe('ao thun')
    expect(screen.getByRole('button', { name: 'Tìm kiếm', exact: true }).getAttribute('aria-expanded')).toBe('false')
  })

  it('results support price sorting, size filters and product navigation', async () => {
    mount('/search?q=ao+thun')
    await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(2))
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'priceAsc' } })
    await waitFor(() => expect(screen.getAllByRole('article')[0].textContent).toContain('Áo thun mềm'))
    fireEvent.click(screen.getByRole('button', { name: 'Bộ lọc', exact: true }))
    fireEvent.click(screen.getByRole('button', { name: 'M', exact: true }))
    expect(screen.getAllByRole('article')).toHaveLength(2)
    fireEvent.click(screen.getByRole('button', { name: 'Xem kết quả' }))
    await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(1))
    fireEvent.click(screen.getAllByRole('link', { name: 'Áo thun cổ điển', exact: true })[0])
    expect(screen.getByTestId('location').textContent).toBe('/product/1')
  })

  it('discards unconfirmed selections and only clears results after applying', async () => {
    mount('/search?q=ao+thun')
    await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(2))
    fireEvent.click(screen.getByRole('button', { name: 'Bộ lọc', exact: true }))
    fireEvent.click(screen.getByRole('button', { name: 'M', exact: true }))
    fireEvent.keyDown(document, { key: 'Escape' })
    fireEvent.click(screen.getByRole('button', { name: 'Bộ lọc', exact: true }))
    expect(screen.getByRole('button', { name: 'M', exact: true }).getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(screen.getByRole('button', { name: 'M', exact: true }))
    fireEvent.click(screen.getByRole('button', { name: 'Xem kết quả' }))
    await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(1))
    fireEvent.click(screen.getByRole('button', { name: /Bộ lọc/ }))
    expect(screen.getByRole('button', { name: 'M', exact: true }).getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: 'Xóa tất cả' }))
    await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(1))
    fireEvent.click(screen.getByRole('button', { name: 'Xem kết quả' }))
    await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(2))
  })

  it('a direct URL with no matches displays the empty state', async () => {
    mount('/search?q=zzunknown')
    await screen.findByText('Không có sản phẩm nào khớp bộ lọc.')
    expect(screen.queryAllByRole('article')).toHaveLength(0)
  })

  it('recent searches navigate and an API outage explicitly shows the offline catalog', async () => {
    localStorage.setItem('searchHistory:guest', JSON.stringify([{ q: 'ao thun', at: Date.now() }]))
    request.mockRejectedValue(new Error('offline'))
    mount()
    fireEvent.click(screen.getByRole('button', { name: 'Tìm kiếm', exact: true }))
    fireEvent.click(screen.getByRole('button', { name: 'ao thun', exact: true }))
    await screen.findByText('Không tải được dữ liệu từ máy chủ — đang hiển thị danh mục ngoại tuyến.')
    expect(screen.getByTestId('location').textContent).toBe('/search?q=ao+thun')
    expect(screen.getAllByRole('article').length).toBeGreaterThan(0)
  })
})
