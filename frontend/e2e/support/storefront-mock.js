// Giả lập API Python + Supabase Auth bằng page.route cho test e2e storefront.
// Không chạm backend thật, không có thanh toán thật.
import { expect } from '@playwright/test'

export const owner = '33333333-3333-4333-8333-333333333333'
const img = path => `/img/clothing/${path}`
const colors = [
  { id: 'black', name_vi: 'Đen', name_en: 'Midnight black', hex: '#111111' },
  { id: 'white', name_vi: 'Trắng', name_en: 'Pearl white', hex: '#f5f5f5' },
  { id: 'navy', name_vi: 'Xanh navy', name_en: 'Navy', hex: '#1f2a44' },
  { id: 'red', name_vi: 'Đỏ', name_en: 'Unused red', hex: '#b00000' }, // không sản phẩm nào dùng
]
const categories = [
  { id: 'm-tshirts', name_vi: 'Áo thun', name_en: 'T-shirts', department: 'men' },
  { id: 'm-shirts', name_vi: 'Áo sơ mi', name_en: 'Shirts', department: 'men' },
  { id: 'w-skirts', name_vi: 'Chân váy', name_en: 'Skirts', department: 'women' },
]
export const tee = {
  id: 11, name_vi: 'Áo thun kiểm thử', name_en: 'QA tee', category: 'm-tshirts', department: 'men', price: 250000, stock: 9,
  colors: ['black', 'white'], sizes: ['S', 'M', 'L'], is_new: true, created_at: '2026-10-20T00:00:00Z',
  images: [img('ascolour_5027_classic_pocket_tee_black/front.jpg'), img('ascolour_5027_classic_pocket_tee_white/front.jpg')],
  color_images: {
    black: [img('ascolour_5027_classic_pocket_tee_black/front.jpg'), img('ascolour_5027_classic_pocket_tee_black/back.jpg')],
    white: [img('ascolour_5027_classic_pocket_tee_white/front.jpg'), img('ascolour_5027_classic_pocket_tee_white/back.jpg')],
  },
  color_names: { black: { vi: 'Đen', en: 'Midnight black' }, white: { vi: 'Trắng', en: 'Pearl white' } },
  description: 'Mô tả từ backend', description_en: 'Description from the backend API', stock_revision: 1,
  variants: [{ color: 'black', size: 'S', stock: 4 }, { color: 'black', size: 'M', stock: 0 }, { color: 'black', size: 'L', stock: 2 }, { color: 'white', size: 'S', stock: 3 }],
}
export const shirt = { ...tee, id: 12, name_vi: 'Sơ mi kiểm thử', name_en: 'QA shirt', category: 'm-shirts', price: 600000, stock: 5, colors: ['black'], sizes: ['M'], is_new: false,
  created_at: '2026-09-01T00:00:00Z', images: [img('ascolour_5401_oxford_shirt_black/front.jpg')], color_images: {}, variants: [{ color: 'black', size: 'M', stock: 5 }] }
export const skirt = { ...tee, id: 13, name_vi: 'Chân váy kiểm thử', name_en: 'QA skirt', category: 'w-skirts', department: 'women', price: 400000, stock: 6, colors: ['navy'], sizes: ['S', 'M'],
  created_at: '2026-10-10T00:00:00Z', images: [img('everlane_circle_mini_skirt_navy/front.jpg')], color_images: {}, color_names: { navy: { vi: 'Xanh navy', en: 'Navy' } },
  variants: [{ color: 'navy', size: 'S', stock: 3 }, { color: 'navy', size: 'M', stock: 3 }] }
export const catalog = [tee, shirt, skirt]
export const address = { id: owner, name: 'QA buyer', email: 'buyer@example.invalid', phone: '0901234567', city: 'Hà Nội', address: '1 QA street', notes: '' }
const fold = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').toLowerCase()

function productPage(url) {
  const p = url.searchParams, list = key => (p.get(key) || '').split(',').filter(Boolean)
  const department = p.get('department'), q = fold(p.get('q') || '')
  const scope = catalog.filter(x => !department || x.department === department)
  let rows = scope.filter(x => (!q || q.split(' ').every(word => fold(`${x.name_vi} ${x.name_en}`).includes(word)))
    && (!list('categories').length || list('categories').includes(x.category))
    && (!list('colors').length || x.colors.some(c => list('colors').includes(c)))
    && (!list('sizes').length || x.sizes.some(s => list('sizes').includes(s))))
  const sort = p.get('sort')
  if (sort === 'priceAsc') rows = [...rows].sort((a, b) => a.price - b.price)
  if (sort === 'priceDesc') rows = [...rows].sort((a, b) => b.price - a.price)
  if (sort === 'new') rows = [...rows].sort((a, b) => b.created_at.localeCompare(a.created_at))
  const limit = Number(p.get('limit') || 12), page = Number(p.get('page') || 1)
  return { products: rows.slice((page - 1) * limit, page * limit), total: rows.length, page, limit, pages: Math.max(1, Math.ceil(rows.length / limit)), stock_units: 0,
    categories: categories.filter(c => !department || c.department === department), colors,
    color_options: [...new Set(scope.flatMap(x => x.colors))].sort(), sizes: [...new Set(scope.flatMap(x => x.sizes))].sort() }
}

/** Giả lập API + Auth; ghi lại mọi request để kiểm tra tham số và phát hiện endpoint ngoài dự kiến. */
export async function setup(page, { signedIn = false, role = 'customer', addresses = [address], failCatalog = false, holdCatalog = false } = {}) {
  const user = { id: owner, email: 'buyer@example.invalid', email_confirmed_at: '2026-01-01T00:00:00Z', is_anonymous: false, app_metadata: { role }, user_metadata: { name: 'QA buyer' } }
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url')
  const session = { access_token: `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: owner, role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600, session_id: owner })}.test`, refresh_token: 'isolated-qa-refresh', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: 'bearer', user }
  await page.addInitScript(({ session, signedIn }) => {
    if (sessionStorage.getItem('qa-init')) return // chỉ khởi tạo lần đầu, để reload giữ trạng thái thật
    sessionStorage.setItem('qa-init', '1')
    localStorage.setItem('lang', 'en')
    if (signedIn) localStorage.setItem('sb-127-auth-token', JSON.stringify(session))
  }, { session, signedIn })
  const state = { calls: [], unexpected: [], errors: [], orders: [], addressPosts: [], book: { addresses, default_address_id: addresses[0]?.id || null, revision: 0 }, released: false, waiting: [], saved: new Set(), wishlistPosts: [] }
  state.release = () => { state.released = true; state.waiting.splice(0).forEach(resolve => resolve()) }
  page.on('pageerror', error => state.errors.push(`pageerror: ${error.message}`))
  // Log 'Failed to load resource' của request /api/ là phản hồi lỗi do test cố tình giả lập (đã kiểm tra riêng);
  // lỗi tải ảnh/tài nguyên khác vẫn bị tính.
  page.on('console', message => { if (message.type() === 'error' && !(message.text().startsWith('Failed to load resource') && message.location().url.includes('/api/'))) state.errors.push(`console: ${message.text()} @ ${message.location().url}`) })
  await page.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname, method = request.method()
    if (url.hostname.endsWith('googleapis.com') || url.hostname.endsWith('gstatic.com')) return route.fulfill({ status: 200, contentType: 'text/css', body: '' })
    if (url.port === '9999') return route.fulfill({ json: path.endsWith('/user') ? user : session })
    if (url.origin !== 'http://127.0.0.1:5174') return route.abort()
    if (!path.startsWith('/api/')) return route.continue()
    state.calls.push({ method, path, search: url.search, body: request.postDataJSON?.() })
    let data, status = 200
    if (path === '/api/product-page') {
      if (holdCatalog && !state.released) await new Promise(resolve => { state.waiting.push(resolve) })
      if (failCatalog) return route.fulfill({ status: 500, json: { code: 'NB_DATABASE_UNAVAILABLE' } })
      data = productPage(url)
    } else if (/^\/api\/products\/\d+$/.test(path)) {
      const found = catalog.find(x => x.id === Number(path.split('/').pop()))
      if (found) data = { product: found, colors, categories }; else { status = 404; data = { code: 'NB_PRODUCT_NOT_FOUND' } }
    } else if (path === '/api/products/by-ids') data = { products: catalog.filter(x => (url.searchParams.get('ids') || '').split(',').map(Number).includes(x.id)) }
    else if (path === '/api/wishlist' && method === 'GET') data = { product_ids: [...state.saved] }
    else if (path === '/api/wishlist' && method === 'POST') {
      const body = request.postDataJSON(); state.wishlistPosts.push(body)
      if (body.saved) state.saved.add(body.product_id); else state.saved.delete(body.product_id)
      data = { product_ids: [...state.saved] }
    } else if (path === '/api/wishlist/products') {
      const rows = catalog.filter(x => state.saved.has(x.id))
      data = { products: rows, total: rows.length, page: 1, pages: 1, limit: 12, categories, colors, sizes: [] }
    }
    else if (path === '/api/payment-methods') data = { methods: ['cod'] }
    else if (path === '/api/addresses' && method === 'GET') data = state.book
    else if (path === '/api/addresses' && method === 'POST') {
      const body = request.postDataJSON(); state.addressPosts.push(body)
      const saved = { ...body.address, id: '44444444-4444-4444-8444-444444444444' }
      state.book = { addresses: [...state.book.addresses, saved], default_address_id: state.book.default_address_id || saved.id, revision: state.book.revision + 1 }
      data = state.book
    } else if (path.startsWith('/api/promotions/')) { status = 404; data = { code: 'NB_PROMOTION_INVALID' } }
    else if (path === '/api/orders' && method === 'POST') {
      const body = request.postDataJSON(); state.orders.push(body)
      const total = body.items.reduce((sum, i) => sum + i.expected_price * i.quantity, 0)
      data = { id: '55555555-5555-4555-8555-555555555555', status: 'pending', payment: body.payment, payment_status: 'unpaid', total, delivery: state.book.addresses.find(a => a.id === body.address_id) }
    } else if (path === '/api/orders' && method === 'GET') data = { orders: [], page: 1, pages: 1, total: 0 }
    else { state.unexpected.push(`${method} ${path}`); return route.fulfill({ status: 500, json: { code: 'UNEXPECTED_QA_ENDPOINT', path } }) }
    return route.fulfill({ status, json: data })
  })
  state.call = (path, predicate = () => true) => state.calls.filter(c => c.path === path && predicate(new URLSearchParams(c.search), c))
  // Mọi test kết thúc bằng: không gọi endpoint lạ, không lỗi JS/console, không cuộn ngang.
  state.verify = async () => {
    expect(state.unexpected, 'unexpected API calls').toEqual([])
    expect(state.errors, 'page/console errors').toEqual([])
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1), 'no horizontal overflow').toBe(true)
  }
  return state
}

export const cartLines = page => page.evaluate(owner => JSON.parse(localStorage.getItem(`nb-cart-v2:${owner}`) || '[]').map(i => ({ id: i.product.id, color: i.color, size: i.size, quantity: i.quantity })), owner)
export const seedCart = (page, lines) => page.addInitScript(({ owner, lines }) => {
  if (sessionStorage.getItem('qa-cart')) return
  sessionStorage.setItem('qa-cart', '1')
  localStorage.setItem(`nb-cart-v2:${owner}`, JSON.stringify(lines))
}, { owner, lines })
export const line = (product, color, size, quantity) => ({ key: JSON.stringify([product.id, color, size]), quantity, color, size,
  product: { id: product.id, vi: product.name_vi, en: product.name_en, price: product.price, stock: product.stock, images: product.images, colors: product.colors, sizes: product.sizes, variants: product.variants, colorNames: product.color_names } })
export const money = value => new RegExp(value.toLocaleString('vi-VN').replace(/\./g, '\\.') + '\\s₫')
