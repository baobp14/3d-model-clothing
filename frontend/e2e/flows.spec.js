import { test, expect } from '@playwright/test'
import { mkdir } from 'node:fs/promises'

const owner = '11111111-1111-4111-8111-111111111111'
const orderId = '22222222-2222-4222-8222-222222222222'
async function setup(page, { role = 'admin', signedIn = true } = {}) {
  const user = { id: owner, email: 'qa@example.invalid', email_confirmed_at: '2026-01-01T00:00:00Z', is_anonymous: false, app_metadata: { role }, user_metadata: { name: 'QA customer' } }
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url')
  const session = { access_token: `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: owner, role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600, session_id: owner })}.test`, refresh_token: 'isolated-qa-refresh', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: 'bearer', user }
  await page.addInitScript(({ session, signedIn }) => { localStorage.setItem('lang', 'en'); if (signedIn) localStorage.setItem('sb-127-auth-token', JSON.stringify(session)) }, { session, signedIn })
  const colors = [{ id: 'black', name_vi: 'Đen', name_en: 'Midnight black', hex: '#111111' }]
  const categories = [{ id: 'm-tshirts', name_vi: 'Áo thun', name_en: 'T-shirts', department: 'men' }]
  const product = { id: 7, name_vi: 'Áo kiểm tra', name_en: 'QA shirt', category: 'm-tshirts', department: 'men', price: 100000, stock: 5, colors: ['black'], sizes: ['M', 'L'], images: ['/img/products/hm-0685814001.webp'], description: 'QA product', description_en: 'QA product', created_at: '2026-10-05T00:00:00Z', color_names: { black: { vi: 'Đen', en: 'Midnight black' } }, stock_revision: 0, variants: [{ color: 'black', size: 'M', stock: 3 }, { color: 'black', size: 'L', stock: 2 }] }
  const address = { id: owner, name: 'QA customer', email: 'qa@example.invalid', phone: '0901234567', city: 'City', address: 'QA street', notes: '' }
  let order = { id: orderId, user_id: owner, created_at: '2026-10-05T00:00:00Z', status: 'pending', payment: 'cod', total: 100000, payment_status: 'unpaid', is_test: false, delivery: address, items: [{ product_id: 7, name: 'QA shirt', name_en: 'QA shirt', name_vi: 'Áo kiểm tra', color: 'black', color_en: 'Midnight black', color_vi: 'Đen', size: 'M', quantity: 1, price: 100000 }] }
  let read = false
  let holdReport = false, resumeReport
  await page.route('**/*', async route => {
    const url = new URL(route.request().url()), path = url.pathname, method = route.request().method()
    if (url.port === '9999') return route.fulfill({ json: path.endsWith('/user') ? user : session })
    if (url.origin !== 'http://127.0.0.1:5174') return route.abort()
    if (!path.startsWith('/api/')) return route.continue()
    let data
    if (path === '/api/products/7') data = { product, colors, categories }
    else if (path === '/api/products/by-ids') data = { products: [product] }
    else if (path === '/api/product-page') data = { products: [product], colors, categories, sizes: ['M', 'L'], page: 1, pages: 1, total: 1, stock_units: 5 }
    else if (path === '/api/wishlist') data = { product_ids: [] }
    else if (path === '/api/addresses') data = { addresses: [address], default_address_id: address.id, revision: 0 }
    else if (path === '/api/admin/overview') data = { orders: 1, pending: 1, received: 0, revenue: 0, delivered: 0, products: 1, stock_units: product.stock, low_stock: 1 }
    else if (path === '/api/admin/report') { if (holdReport) await new Promise(resolve => { resumeReport = resolve }); data = { series: [{ date: url.searchParams.get('period') === 'month' ? '2026-10' : '2026-10-05', orders: 1, order_value: 100000, received: 0 }], order_value: 100000, received: 0 } }
    else if (path === '/api/admin/stock-alerts') data = { alerts: [{ ...product, product_id: 7, color: 'black', color_names: { en: 'Midnight black', vi: 'Đen' }, size: 'M', stock: 3, href: '/admin/inventory/products/7#variant-stock' }], page: 1, pages: 1, total: 1 }
    else if (path === '/api/admin/notifications' || path === '/api/admin/notifications/read') { if (method === 'POST') read = true; data = { notifications: [{ key: 'order:' + orderId, kind: 'order', id: orderId, href: '/admin/orders?q=' + orderId, read }], unread: read ? 0 : 1 } }
    else if (path === '/api/admin/products/7/history') data = { movements: [{ id: owner, product_id: 7, before_stock: 6, after_stock: 5, actor_id: owner, kind: 'order', reason: '', order_id: orderId, created_at: '2026-10-05T00:00:00Z', changes: [{ color: 'black', size: 'M', before: 4, after: 3 }] }], page: 1, pages: 1, total: 1 }
    else if (path.endsWith('/export')) data = { filename: 'qa.csv', csv: '\ufeffID,Name\r\n7,QA shirt', total: 1 }
    else if (path.endsWith('/test') && method === 'PATCH') { order = { ...order, is_test: route.request().postDataJSON().is_test }; data = { id: orderId, is_test: order.is_test } }
    else if (path === '/api/orders' && method === 'POST') data = order
    else if ((path === '/api/orders/' + orderId || path === '/api/admin/orders/' + orderId) && method === 'PATCH') { order = { ...order, status: route.request().postDataJSON().status }; data = order }
    else if (path === '/api/orders' || path === '/api/admin/orders') data = { orders: [order], page: 1, pages: 1, total: 1 }
    else return route.fulfill({ status: 500, json: { code: 'UNEXPECTED_QA_ENDPOINT', path } })
    return route.fulfill({ json: data })
  })
  return { hold: () => { holdReport = true }, resume: () => { holdReport = false; resumeReport?.() } }
}

async function fits(page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true)
}
async function screenshot(page, name, project) {
  await mkdir('.qa/screenshots', { recursive: true })
  await page.screenshot({ path: `.qa/screenshots/${project}-${name}.png`, fullPage: true })
}

test('admin alerts, stock history, notifications, classification and CSV connect', async ({ page }, info) => {
  await setup(page)
  await page.goto('/admin/inventory/alerts')
  await page.getByRole('link', { name: /QA shirt/ }).click()
  await expect(page.getByRole('heading', { name: 'Stock movement history' })).toBeVisible()
  await expect(page.getByText('Order placed: 6 → 5')).toBeVisible()
  await fits(page)
  await screenshot(page, 'stock-history', info.project.name)
  await page.getByRole('link', { name: /Back to product list/ }).click()
  await expect(page).toHaveURL(/inventory\/alerts/)
  await page.getByRole('button', { name: 'Notifications', exact: true }).click()
  await page.getByRole('button', { name: 'Read all displayed items' }).click()
  await expect(page.getByRole('button', { name: 'Read all displayed items' })).toBeDisabled()
  await fits(page)
  await screenshot(page, 'notifications', info.project.name)
  await page.getByRole('link', { name: /New order awaiting confirmation/ }).click()
  page.once('dialog', dialog => dialog.accept())
  await page.getByRole('button', { name: 'Mark as test order' }).click()
  await expect(page.getByRole('button', { name: 'Mark as real order' })).toBeVisible()
  const downloaded = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export CSV' }).click()
  expect((await downloaded).suggestedFilename()).toBe('qa.csv')
  await fits(page)
})

test('overview loading guards work on desktop and mobile', async ({ page }, info) => {
  const report = await setup(page)
  await page.goto('/admin')
  await expect(page.getByRole('img', { name: /Order value and received/ })).toBeVisible()
  report.hold()
  await page.getByRole('button', { name: 'By month' }).click()
  await expect(page.getByRole('img', { name: /Order value and received/ })).toHaveCount(0)
  await expect(page.getByRole('link', { name: /Total payment received/ })).toHaveAttribute('aria-disabled', 'true')
  report.resume()
  await expect(page.getByRole('img', { name: /Order value and received/ })).toBeVisible()
  await page.getByLabel('Include test orders in statistics').check()
  await expect(page.getByRole('link', { name: /Total payment received/ })).toHaveAttribute('href', '/admin/orders?paid=received')
  await expect(page.getByRole('img', { name: /Order value and received/ })).toBeVisible()
  await fits(page)
  await screenshot(page, 'overview', info.project.name)
})

test('sign-in preserves a product choice through bag, checkout and cancellation', async ({ page }, info) => {
  await setup(page, { role: 'customer', signedIn: false })
  await page.goto('/product/7')
  await page.getByRole('button', { name: 'M', exact: true }).click()
  await page.getByRole('button', { name: 'Sign in to add to bag' }).click()
  await page.getByRole('textbox', { name: 'Email', exact: true }).fill('qa@example.invalid')
  await page.getByRole('textbox', { name: 'Password', exact: true }).fill('isolated-test-password')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByRole('button', { name: 'M', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Add to bag' }).click()
  await page.getByRole('link', { name: 'View bag', exact: true }).click()
  await fits(page)
  await page.getByRole('link', { name: 'Checkout', exact: true }).click()
  await page.getByRole('button', { name: 'Choose payment method' }).click()
  await page.getByRole('button', { name: 'Confirm', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Place order' })).toBeEnabled()
  await fits(page)
  await screenshot(page, 'checkout', info.project.name)
  await page.getByRole('button', { name: 'Place order' }).click()
  await expect(page.getByRole('heading', { name: 'Order placed' })).toBeVisible()
  await page.getByRole('link', { name: 'View orders' }).click()
  page.once('dialog', dialog => dialog.accept())
  await page.getByRole('button', { name: 'Cancel order' }).click()
  await expect(page.getByRole('article').getByText('Canceled', { exact: true })).toBeVisible()
  await fits(page)
})
