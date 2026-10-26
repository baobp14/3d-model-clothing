// Smoke test với backend thật — CHỈ ĐỌC (GET), không đăng nhập, không ghi dữ liệu.
// Chạy khi có dev server + API: LIVE_BASE_URL=http://127.0.0.1:5173 npx playwright test e2e/live-smoke.spec.js
import { test, expect } from '@playwright/test'

const base = process.env.LIVE_BASE_URL
test.skip(!base, 'Đặt LIVE_BASE_URL để chạy smoke test với backend thật')

async function watch(page) {
  const problems = []
  await page.addInitScript(() => localStorage.setItem('lang', 'en'))
  page.on('pageerror', e => problems.push(`pageerror: ${e.message}`))
  page.on('response', r => { if (r.url().includes('/api/') && r.status() >= 400) problems.push(`${r.status()} ${r.url()}`) })
  page.on('console', m => { if (m.type() === 'error') problems.push(`console: ${m.text()} @ ${m.location().url}`) })
  return problems
}
const vnd = value => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value)

test('live: listing, product detail and search match the API', async ({ page, request }) => {
  const problems = await watch(page)
  const api = await (await request.get(`${base}/api/product-page?department=men&page=1&limit=12&sort=featured`)).json()
  expect(api.total).toBeGreaterThan(0)

  await page.goto(`${base}/`)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

  await page.goto(`${base}/men/ready-to-wear`)
  await expect(page.getByRole('article')).toHaveCount(api.products.length)
  await expect(page.getByText(new RegExp(`^${api.total} results`))).toBeVisible() // dòng phân trang, hiện ở mọi kích thước
  await expect(page.getByRole('article').first()).toContainText(api.products[0].name_en)

  const first = api.products[0]
  const detail = (await (await request.get(`${base}/api/products/${first.id}`)).json()).product
  await page.goto(`${base}/product/${first.id}`)
  await expect(page.getByRole('heading', { level: 1, name: detail.name_en })).toBeVisible()
  await expect(page.locator('main').getByText(vnd(detail.price)).first()).toBeVisible()
  await expect(page.getByRole('img', { name: detail.name_en, exact: true })).toHaveAttribute('src', detail.images[0])

  const word = first.name_en.split(' ')[0]
  const found = await (await request.get(`${base}/api/product-page?q=${encodeURIComponent(word)}&page=1&limit=12&sort=featured`)).json()
  await page.goto(`${base}/search?q=${encodeURIComponent(word)}`)
  await expect(page.getByRole('article')).toHaveCount(found.products.length)

  await page.goto(`${base}/cart`)
  await expect(page).toHaveURL(/\/login\?next=%2Fcart$/)
  expect(problems).toEqual([])
})
