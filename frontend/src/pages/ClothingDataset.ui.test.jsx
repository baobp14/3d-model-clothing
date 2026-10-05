import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { LanguageProvider } from '../i18n'
import ProductDetail from './ProductDetail'

const { state, add } = vi.hoisted(() => ({ state: {}, add: vi.fn(() => true) }))
vi.mock('../hooks/useProduct', () => ({ useProduct: () => state }))
vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'customer', is_anonymous: false }, loading: false, recovery: false }) }))
vi.mock('../hooks/useCart', () => ({ useCart: () => ({ ready: true, pending: null, add }) }))
vi.mock('../components/WishlistButton', () => ({ default: () => null }))

function mount(archived = false) {
  localStorage.setItem('lang', 'en')
  const product = { id: 3000, vi: 'Dataset shirt', en: 'Dataset shirt', department: 'men', category: 'm-tshirts', colors: ['black', 'white'], sizes: ['S', 'M', 'XL'], price: 100000, stock: 1556, variants: [{ color: 'black', size: 'S', stock: 260 }, { color: 'white', size: 'S', stock: 259 }], images: ['/black-front.jpg', '/white-front.jpg'], colorImages: { black: ['/black-front.jpg', '/black-back.jpg', '/black-detail.jpg'], white: ['/white-front.jpg', '/white-back.jpg'] }, archived }
  Object.assign(state, { product, colors: [{ id: 'black', en: 'Black' }, { id: 'white', en: 'White' }], loading: false })
  render(<MemoryRouter initialEntries={['/product/3000']}><LanguageProvider><Routes><Route path="/product/:id" element={<ProductDetail />} /></Routes></LanguageProvider></MemoryRouter>)
}
afterEach(() => { cleanup(); localStorage.clear(); add.mockClear() })

it('switches own-color front/back photos and buys the reviewed color and size', () => {
  mount()
  const photo = screen.getByAltText('Dataset shirt')
  fireEvent.click(screen.getByRole('button', { name: 'View image 2' }))
  expect(photo.getAttribute('src')).toBe('/black-back.jpg')
  fireEvent.click(screen.getAllByRole('button', { name: 'White', exact: true })[0])
  expect(photo.getAttribute('src')).toBe('/white-front.jpg')
  fireEvent.click(screen.getByRole('button', { name: 'View image 2' }))
  expect(photo.getAttribute('src')).toBe('/white-back.jpg')
  expect(screen.queryByRole('button', { name: 'View image 3' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'S', exact: true }))
  fireEvent.click(screen.getByRole('button', { name: 'Add to bag' }))
  expect(add).toHaveBeenCalledWith(state.product, 'white', 'S', 1)
})

it('keeps an archived product readable while blocking purchase', () => {
  mount(true)
  expect(screen.getByRole('heading', { name: 'Dataset shirt' })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Product from the previous collection' }).disabled).toBe(true)
  expect(add).not.toHaveBeenCalled()
})
