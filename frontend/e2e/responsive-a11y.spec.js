// Responsive + accessibility audit: mọi trang storefront × 7 chiều rộng. API/Auth giả lập.
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import { setup, seedCart, line, tee, skirt } from './support/storefront-mock.js'
import { audit, focusAudit } from './support/audit.js'

const widths = [320, 375, 390, 768, 1024, 1280, 1440]
const pages = [
  { path: '/', name: 'home' },
  { path: '/men/ready-to-wear', name: 'plp-men' },
  { path: '/women/ready-to-wear', name: 'plp-women' },
  { path: '/search?q=qa', name: 'search' },
  { path: '/search?q=khong-co', name: 'search-empty' },
  { path: '/product/11', name: 'pdp' },
  { path: '/cart', name: 'cart', signedIn: true, cart: true },
  { path: '/cart', name: 'cart-empty', signedIn: true },
  { path: '/checkout', name: 'checkout', signedIn: true, cart: true },
  { path: '/account/wishlist', name: 'wishlist', signedIn: true },
  { path: '/account/orders', name: 'orders', signedIn: true },
  { path: '/account/addresses', name: 'addresses', signedIn: true },
  { path: '/login', name: 'login' },
  { path: '/register', name: 'register' },
  { path: '/forgot-password', name: 'forgot' },
  { path: '/terms', name: 'terms' },
  { path: '/khong-ton-tai', name: '404' },
]
const STRICT = process.env.A11Y_COLLECT !== '1'

// Một project là đủ: chiều rộng được đặt trực tiếp cho từng lượt
test.beforeEach(({}, info) => { test.skip(info.project.name !== 'desktop', 'viewport do test tự đặt') })

for (const target of pages) {
  test(`layout and a11y: ${target.name}`, async ({ page }) => {
    if (target.cart) await seedCart(page, [line(tee, 'white', 'S', 1), line(skirt, 'navy', 'M', 2)])
    const state = await setup(page, { signedIn: !!target.signedIn })
    const found = []
    for (const width of widths) {
      await page.setViewportSize({ width, height: 800 })
      await page.goto(target.path)
      await page.waitForLoadState('networkidle')
      // Cuộn hết trang để ảnh lazy tải (phát hiện ảnh hỏng), rồi về đầu trang
      await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) { scrollTo(0, y); await new Promise(r => setTimeout(r, 40)) } scrollTo(0, 0) })
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(250)
      for (const issue of await audit(page)) found.push({ width, ...issue })
      if (width === 390 || width === 1440 || process.env.A11Y_SHOTS === 'all') {
        await page.screenshot({ path: `.qa/a11y/${target.name}-${width}.png`, fullPage: true })
        for (const issue of await focusAudit(page)) found.push({ width, ...issue })
      }
    }
    fs.mkdirSync('.qa/a11y', { recursive: true })
    fs.writeFileSync(`.qa/a11y/${target.name}.json`, JSON.stringify(found, null, 2))
    expect(state.unexpected).toEqual([])
    expect(state.errors).toEqual([])
    if (STRICT) expect(found, `layout/a11y issues on ${target.path}`).toEqual([])
  })
}

// Trạng thái mở: drawer, ô tìm kiếm, modal — ở màn hình nhỏ và thấp
const insideViewport = locator => locator.evaluate(el => { const r = el.getBoundingClientRect(); return r.left >= -1 && r.top >= -1 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1 })
for (const size of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 1024, height: 700 }]) {
  test(`overlays fit and stay usable at ${size.width}×${size.height}`, async ({ page }) => {
    const state = await setup(page)
    await page.setViewportSize(size)
    const found = []
    const check = async label => { for (const issue of await audit(page)) if (!['h1-count', 'heading-skip'].includes(issue.type)) found.push({ label, ...issue }) }
    await page.goto('/men/ready-to-wear')
    await expect(page.getByRole('article').first()).toBeVisible() // route lazy đã tải xong
    await page.getByRole('button', { name: 'Open menu' }).click()
    const menu = page.getByRole('dialog', { name: 'Menu' })
    await expect(menu).toBeVisible()
    await expect.poll(() => insideViewport(menu)).toBe(true)
    await check('menu'); await page.keyboard.press('Escape')
    await page.getByRole('button', { name: 'Search', exact: true }).click()
    await expect(page.getByRole('searchbox', { name: 'Search' })).toBeFocused()
    await check('search'); await page.keyboard.press('Escape')
    await page.getByRole('button', { name: 'Filter', exact: true }).click()
    const filters = page.getByRole('dialog', { name: 'Filters' })
    await expect.poll(() => insideViewport(filters)).toBe(true)
    await expect(filters.getByRole('button', { name: 'View results' })).toBeInViewport()
    await check('filters'); await page.keyboard.press('Escape')
    await page.getByRole('button', { name: 'Account' }).click()
    const account = page.getByRole('dialog', { name: 'Account' })
    await expect.poll(() => insideViewport(account)).toBe(true)
    await check('account')
    expect(state.errors).toEqual([])
    expect(found).toEqual([])
  })
}

test('checkout modals fit a 320×568 screen and their actions are reachable', async ({ page }) => {
  await seedCart(page, [line(tee, 'white', 'S', 1)])
  const state = await setup(page, { signedIn: true, addresses: [] })
  await page.setViewportSize({ width: 320, height: 568 })
  await page.goto('/checkout')
  await page.getByRole('button', { name: 'Choose payment method' }).click()
  const payment = page.getByRole('dialog', { name: 'Choose payment method' })
  await expect.poll(() => insideViewport(payment)).toBe(true)
  await payment.getByRole('button', { name: 'Confirm' }).scrollIntoViewIfNeeded()
  await expect(payment.getByRole('button', { name: 'Confirm' })).toBeInViewport()
  await payment.getByRole('button', { name: 'Confirm' }).click()
  await page.getByRole('button', { name: 'Choose address' }).click()
  await page.getByRole('button', { name: '+ Add new address' }).click()
  const editor = page.getByRole('dialog', { name: 'Add new address' })
  await expect.poll(() => insideViewport(editor)).toBe(true)
  await editor.getByRole('button', { name: 'Save address' }).scrollIntoViewIfNeeded()
  await expect(editor.getByRole('button', { name: 'Save address' })).toBeInViewport()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  expect(state.errors).toEqual([])
})

test('reduced motion: no autoplaying video, no running animations or transitions', async ({ page }) => {
  const state = await setup(page)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  expect(await page.locator('video').evaluateAll(videos => videos.every(v => v.paused))).toBe(true)
  const moving = await page.evaluate(() => [...document.querySelectorAll('body *')].filter(el => {
    const s = getComputedStyle(el)
    const longest = v => Math.max(...v.split(',').map(x => parseFloat(x) * (x.includes('ms') ? 1 : 1000)))
    return longest(s.transitionDuration) > 1 || (s.animationName !== 'none' && longest(s.animationDuration) > 1)
  }).length)
  expect(moving).toBe(0)
  expect(state.errors).toEqual([])
})

test('product page: the add-to-bag button is on screen at load and never hides the footer', async ({ page }) => {
  const state = await setup(page, { signedIn: true })
  for (const [width, height] of [[320, 568], [375, 667], [390, 844], [768, 1024], [1024, 768], [1440, 900]]) {
    await page.setViewportSize({ width, height })
    await page.goto('/product/11')
    const add = page.getByRole('button', { name: 'Add to bag' })
    await expect(add, `${width}×${height}`).toBeInViewport({ ratio: 1 })
    await page.evaluate(() => scrollTo(0, document.body.scrollHeight))
    // Dòng cuối của footer (bản quyền) không bị thanh mua cố định che
    const footerCovered = await page.evaluate(() => { const c = [...document.querySelectorAll('footer p')].pop(); const r = c.getBoundingClientRect(); return !c.contains(document.elementFromPoint(r.left + 4, r.top + r.height / 2)) })
    expect(footerCovered, `footer covered at ${width}×${height}`).toBe(false)
  }
  expect(state.errors).toEqual([])
})
