import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { LanguageProvider } from '../i18n'
import { CartProvider, useCart } from '../hooks/useCart'
import { cartKey, lineKey } from '../lib/cartStorage'
import { checkoutKey } from '../lib/checkoutRequest'
import Checkout from './Checkout'

const { request, user, address } = vi.hoisted(() => ({
  request: vi.fn(), user: { id: 'customer', is_anonymous: false },
  address: { id: 'address', name: 'Customer', email: 'test@example.com', phone: '0912345678', city: 'City', address: 'Street', notes: '' },
}))
vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ user, loading: false, recovery: false }) }))
vi.mock('../lib/api', () => ({ shopApi: { request } }))
vi.mock('../lib/supabase', () => ({ supabase: { auth: { getUser: async () => ({ data: { user } }) } } }))
vi.mock('../lib/addressBook', () => ({ loadAddressBook: async () => ({ addresses: [address] }) }))
const { methods } = vi.hoisted(() => ({ methods: { current: ['cod'] } }))
vi.mock('../lib/paymentMethods', () => ({ loadPaymentMethods: async () => methods.current }))
vi.mock('../components/AddressBook', async () => {
  const { useEffect } = await import('react')
  return { default: ({ onSelect, onReady }) => {
    useEffect(() => { onSelect(address); onReady(true) }, [onSelect, onReady])
    return <p>Delivery address</p>
  } }
})

const product = { id: 1, vi: 'Áo', en: 'Shirt', price: 100, stock: 2, images: ['/img/test.webp'], colors: ['black'], colorNames: { black: { vi: 'Đen', en: 'Black' } }, sizes: ['M'] }
const payload = { items: [{ product_id: 1, quantity: 2, color: 'black', size: 'M' }], address_id: address.id, payment: 'cod' }
const placed = { id: 'order', delivery: address, total: 200, payment: 'cod' }
const mount = () => render(<MemoryRouter><LanguageProvider><CartProvider><Checkout /></CartProvider></LanguageProvider></MemoryRouter>)
beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('lang', 'en')
  localStorage.setItem(cartKey(user.id), JSON.stringify([{ key: lineKey(product, 'black', 'M'), product, color: 'black', size: 'M', quantity: 2 }]))
  request.mockReset()
  vi.stubGlobal('scrollTo', vi.fn())
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

it('an applied promotion is connected to the reviewed price and final order payload', async () => {
  request.mockImplementation(async path => {
    if (path === '/promotions/SAVE10') return { code: 'SAVE10', percent: 10 }
    if (path === '/products/by-ids?ids=1') return { products: [{ id: 1, name_vi: 'Áo', name_en: 'Shirt', price: 100, stock: 2, colors: ['black'], sizes: ['M'], images: ['/img/test.webp'] }] }
    if (path === '/orders') return { ...placed, total: 180, discount: 20, promotion_code: 'SAVE10' }
    throw Error('unexpected endpoint')
  })
  mount()
  expect(await screen.findByText(/Shirt · Black/)).toBeTruthy()
  fireEvent.change(await screen.findByLabelText('Promotion code'), { target: { value: 'save10' } })
  fireEvent.click(screen.getByRole('button', { name: 'Apply' }))
  await screen.findByText(/Discount.*SAVE10/)
  fireEvent.click(screen.getByRole('button', { name: 'Choose payment method' }))
  fireEvent.click(screen.getByRole('button', { name: 'Confirm' }))
  fireEvent.click(screen.getByRole('button', { name: 'Place order' }))
  await screen.findByRole('heading', { name: 'Order placed' })
  const orderRequest = request.mock.calls.find(([path]) => path === '/orders')[1].body
  expect(orderRequest.promotion_code).toBe('SAVE10')
  expect(orderRequest.expected_discount).toBe(20)
  expect(orderRequest.items[0].expected_price).toBe(100)
  expect(screen.getByRole('link', { name: 'View orders' }).getAttribute('href')).toBe('/account/orders')
})

it.each([
  ['NB_ADDRESS_NOT_FOUND', 'The delivery address no longer exists'],
  ['NB_PRODUCT_NOT_FOUND', 'A product is no longer available'],
  ['NB_INVALID_ORDER', 'Order details are invalid'],
  ['NB_INVALID_INPUT', 'Order details are invalid'],
])('checkout explains %s and releases the rejected request without clearing the bag', async (code, message) => {
  request.mockImplementation(async path => {
    if (path === '/products/by-ids?ids=1') return { products: [{ id: 1, name_vi: 'Shirt', name_en: 'Shirt', price: 100, stock: 2, colors: ['black'], sizes: ['M'], images: ['/img/test.webp'] }] }
    if (path === '/orders') throw Object.assign(Error(code), { code })
    throw Error('unexpected endpoint')
  })
  mount()
  fireEvent.click(await screen.findByRole('button', { name: 'Choose payment method' }))
  fireEvent.click(screen.getByRole('button', { name: 'Confirm' }))
  fireEvent.click(screen.getByRole('button', { name: 'Place order' }))
  await screen.findByText(new RegExp(message))
  expect(localStorage.getItem(checkoutKey(user.id))).toBe(null)
  expect(JSON.parse(localStorage.getItem(cartKey(user.id)))[0].quantity).toBe(2)
  expect(screen.queryByRole('heading', { name: 'Order placed' })).toBe(null)
})

it('checkout refresh displays the current database color name', async () => {
  request.mockImplementation(async path => {
    if (path === '/products/by-ids?ids=1') return { products: [{ id: 1, name_vi: 'Shirt', name_en: 'Shirt', price: 101, stock: 2, colors: ['black'], color_names: { black: { vi: 'Đen mới', en: 'Midnight black' } }, sizes: ['M'], images: ['/img/test.webp'] }] }
    throw Error('must review changed price before ordering')
  })
  mount()
  fireEvent.click(await screen.findByRole('button', { name: 'Choose payment method' }))
  fireEvent.click(screen.getByRole('button', { name: 'Confirm' }))
  fireEvent.click(screen.getByRole('button', { name: 'Place order' }))
  await screen.findByText(/Shirt · Midnight black/)
  expect(request.mock.calls.map(([path]) => path)).toEqual(['/products/by-ids?ids=1'])
})

it('a legacy cart hydrates color names without changing quantity, price or unresolved order state', async () => {
  const stored = JSON.parse(localStorage.getItem(cartKey(user.id)))
  delete stored[0].product.colorNames
  localStorage.setItem(cartKey(user.id), JSON.stringify(stored))
  request.mockResolvedValue({ products: [{ id: 1, color_names: { black: { vi: 'Đen mới', en: 'Midnight black' } } }] })
  mount()
  await screen.findByText(/Shirt · Midnight black/)
  const updated = JSON.parse(localStorage.getItem(cartKey(user.id)))[0]
  expect(updated.quantity).toBe(2)
  expect(updated.product.price).toBe(100)
  expect(request.mock.calls.map(([path]) => path)).toEqual(['/products/by-ids?ids=1'])
})

it('a cart cleared by another tab cannot create an order from stale screen contents', async () => {
  mount()
  fireEvent.click(await screen.findByRole('button', { name: 'Choose payment method' }))
  fireEvent.click(screen.getByRole('button', { name: 'Confirm' }))
  localStorage.setItem(cartKey(user.id), '[]')
  fireEvent.click(screen.getByRole('button', { name: 'Place order' }))
  await screen.findByText(/Your bag changed in another tab/)
  expect(request).not.toHaveBeenCalled()
})

it('a cart edited in another tab while checking stock cannot submit the earlier quantity', async () => {
  let finishCatalog
  request.mockImplementation(path => {
    if (path === '/products/by-ids?ids=1') return new Promise(resolve => { finishCatalog = resolve })
    throw Error('must not place an order')
  })
  mount()
  fireEvent.click(await screen.findByRole('button', { name: 'Choose payment method' }))
  fireEvent.click(screen.getByRole('button', { name: 'Confirm' }))
  fireEvent.click(screen.getByRole('button', { name: 'Place order' }))
  await waitFor(() => expect(finishCatalog).toBeTypeOf('function'))
  localStorage.setItem(cartKey(user.id), JSON.stringify([{ key: lineKey(product, 'black', 'M'), product, color: 'black', size: 'M', quantity: 1 }]))
  finishCatalog({ products: [{ id: 1, name_vi: 'Áo', name_en: 'Shirt', price: 100, stock: 2, colors: ['black'], sizes: ['M'], images: ['/img/test.webp'] }] })
  await screen.findByText(/Your bag changed in another tab/)
  expect(request.mock.calls.map(([path]) => path)).toEqual(['/products/by-ids?ids=1'])
  expect(localStorage.getItem(checkoutKey(user.id))).toBe(null)
})

it('stock refresh blocks an unavailable size even though total product stock is sufficient', async () => {
  request.mockResolvedValue({ products: [{ id: 1, name_vi: 'Áo', name_en: 'Shirt', price: 100, stock: 5, colors: ['black'], sizes: ['M', 'L'], images: ['/img/test.webp'], variants: [{ color: 'black', size: 'M', stock: 1 }, { color: 'black', size: 'L', stock: 4 }], stock_revision: 0 }] })
  mount()
  fireEvent.click(await screen.findByRole('button', { name: 'Choose payment method' }))
  fireEvent.click(screen.getByRole('button', { name: 'Confirm' }))
  fireEvent.click(screen.getByRole('button', { name: 'Place order' }))
  await screen.findByText(/Some quantities or options are no longer available/)
  expect(request.mock.calls.map(([path]) => path)).toEqual(['/products/by-ids?ids=1'])
  expect(localStorage.getItem(checkoutKey(user.id))).toBe(null)
})

it('a lost order response survives remount and retries the same ID even when the stock is now gone', async () => {
  localStorage.setItem(checkoutKey(user.id), JSON.stringify({ id: 'original-request', payload }))
  request.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(placed)
  const view = mount()
  fireEvent.click(await screen.findByRole('button', { name: 'Check previous order' }))
  await screen.findByText(/Could not confirm your order/)
  expect(localStorage.getItem(checkoutKey(user.id))).toContain('original-request')
  view.unmount()
  mount()
  fireEvent.click(await screen.findByRole('button', { name: 'Check previous order' }))
  await screen.findByRole('heading', { name: 'Order placed' })
  expect(request.mock.calls).toHaveLength(2)
  for (const [path, options] of request.mock.calls) {
    expect(path).toBe('/orders')
    expect(options.body).toEqual({ ...payload, request_id: 'original-request' })
  }
  expect(localStorage.getItem(cartKey(user.id))).toBe('[]')
  expect(localStorage.getItem(checkoutKey(user.id))).toBe(null)
})

it('a changed price is shown for review before any order is sent', async () => {
  request.mockResolvedValue({ products: [{ id: 1, name_vi: 'Áo', name_en: 'Shirt', price: 150, stock: 2, colors: ['black'], sizes: ['M'], images: ['/img/test.webp'] }] })
  mount()
  fireEvent.click(await screen.findByRole('button', { name: 'Choose payment method' }))
  fireEvent.click(screen.getByRole('button', { name: 'Confirm' }))
  await waitFor(() => expect(screen.getByRole('button', { name: 'Place order' }).disabled).toBe(false))
  fireEvent.click(screen.getByRole('button', { name: 'Place order' }))
  await screen.findByText(/Product prices changed/)
  expect(request.mock.calls.map(c => c[0])).toEqual(['/products/by-ids?ids=1'])
  expect(localStorage.getItem(checkoutKey(user.id))).toBe(null)
})

it('expired authentication retains the earlier order ID for a safe retry after signing in', async () => {
  localStorage.setItem(checkoutKey(user.id), JSON.stringify({ id: 'original-request', payload }))
  request.mockRejectedValueOnce(Object.assign(new Error('NB_AUTH_REQUIRED'), { status: 401, code: 'NB_AUTH_REQUIRED' }))
  mount()
  fireEvent.click(await screen.findByRole('button', { name: 'Check previous order' }))
  await screen.findByText('Your session has expired. Please sign in again.')
  expect(localStorage.getItem(checkoutKey(user.id))).toContain('original-request')
  expect(localStorage.getItem(cartKey(user.id))).not.toBe('[]')
})

it('two additions in one event cannot exceed stock before React renders the updated cart', async () => {
  localStorage.setItem(cartKey(user.id), '[]')
  const results = []
  function Probe() {
    const { add, ready, count } = useCart()
    return <><output>{count}</output><button disabled={!ready} onClick={() => {
      results.push(add({ ...product, stock: 1 }, 'black', 'M', 1))
      results.push(add({ ...product, stock: 1 }, 'black', 'M', 1))
    }}>Add twice</button></>
  }
  render(<CartProvider><Probe /></CartProvider>)
  await waitFor(() => expect(screen.getByRole('button', { name: 'Add twice' }).disabled).toBe(false))
  fireEvent.click(screen.getByRole('button', { name: 'Add twice' }))
  expect(results).toEqual([true, false])
  expect(screen.getByRole('status').textContent).toBe('1')
})

it('QR is offered only when the gateway is configured and its code appears after ordering', async () => {
  const products = { products: [{ id: 1, name_vi: 'Áo', name_en: 'Shirt', price: 100, stock: 2, colors: ['black'], sizes: ['M'], images: ['/img/test.webp'] }] }
  request.mockImplementation(async path => {
    if (path === '/products/by-ids?ids=1') return products
    if (path === '/orders') return { ...placed, payment: 'qr', status: 'pending', payment_status: 'unpaid' }
    if (path === '/orders/order/qr') return { order: { ...placed, payment: 'qr', status: 'pending', payment_status: 'unpaid' }, qr: { reference: 'NBORDER', amount: 200, qr_content: 'x', image_png_base64: 'AAAA' } }
    throw Error('unexpected endpoint ' + path)
  })
  mount()
  fireEvent.click(await screen.findByRole('button', { name: 'Choose payment method' }))
  expect(screen.queryByLabelText('Bank transfer by QR code')).toBe(null)
  cleanup()
  methods.current = ['cod', 'qr']
  try {
    mount()
    expect(await screen.findByText(/Shirt · Black/)).toBeTruthy()
    fireEvent.click(await screen.findByRole('button', { name: 'Choose payment method' }))
    fireEvent.click(await screen.findByLabelText('Bank transfer by QR code'))
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }))
    fireEvent.click(screen.getByRole('button', { name: 'Place order' }))
    expect((await screen.findByAltText('Payment QR code')).getAttribute('src')).toBe('data:image/png;base64,AAAA')
    expect(request.mock.calls.find(([path]) => path === '/orders')[1].body.payment).toBe('qr')
  } finally { methods.current = ['cod'] }
})
