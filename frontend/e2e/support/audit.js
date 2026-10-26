// Kiểm tra bố cục và trợ năng có thể đo tự động (không thay thế kiểm tra thủ công / trình đọc màn hình).
// Trả về danh sách vấn đề { type, detail } cho trang hiện tại.

export async function audit(page) {
  return page.evaluate(() => {
    const issues = []
    const add = (type, el, extra = '') => issues.push({ type, detail: `${describe(el)}${extra ? ' ' + extra : ''}` })
    const vw = document.documentElement.clientWidth
    const describe = el => {
      if (!el || el === document) return 'document'
      const name = (el.getAttribute('aria-label') || el.textContent || el.getAttribute('alt') || '').trim().replace(/\s+/g, ' ').slice(0, 40)
      return `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${name ? ` "${name}"` : ''}`
    }
    const hiddenByAncestor = el => !!el.closest('[inert], [aria-hidden="true"], [hidden], details:not([open]) > :not(summary)')
    const visible = el => {
      if (hiddenByAncestor(el)) return false
      const s = getComputedStyle(el), r = el.getBoundingClientRect()
      return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) > 0.01
    }
    const srOnly = el => { const s = getComputedStyle(el); return s.position === 'absolute' && (s.clip === 'rect(0px, 0px, 0px, 0px)' || s.clipPath === 'inset(50%)' || (parseFloat(s.width) <= 1 && parseFloat(s.height) <= 1)) }
    const inScroller = el => { for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) { const o = getComputedStyle(p).overflowX; if (o === 'auto' || o === 'scroll' || o === 'hidden' || o === 'clip') return true } return false }
    const ownText = el => [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())

    // 1. Tràn ngang
    if (document.documentElement.scrollWidth > vw + 1) issues.push({ type: 'overflow', detail: `scrollWidth ${document.documentElement.scrollWidth} > ${vw}` })
    for (const el of document.body.querySelectorAll('*')) {
      if (!visible(el) || srOnly(el) || inScroller(el)) continue
      const r = el.getBoundingClientRect()
      if (r.right > vw + 1 || r.left < -1) { add('offscreen', el, `[${Math.round(r.left)}→${Math.round(r.right)} / ${vw}]`); if (issues.filter(i => i.type === 'offscreen').length > 4) break }
    }

    // 2. Chữ bị cắt (overflow ẩn nhưng nội dung dài hơn khung), bỏ qua line-clamp/ellipsis có chủ đích
    for (const el of document.body.querySelectorAll('*')) {
      if (!ownText(el) || !visible(el) || srOnly(el)) continue
      const s = getComputedStyle(el)
      if (s.webkitLineClamp !== 'none' && s.webkitLineClamp) continue
      if (s.textOverflow === 'ellipsis') continue
      const hides = ['hidden', 'clip'].includes(s.overflowX) || ['hidden', 'clip'].includes(s.overflowY)
      if (hides && (el.scrollWidth > el.clientWidth + 2 || el.scrollHeight > el.clientHeight + 2)) add('clipped-text', el)
    }

    // 3. Ảnh: thiếu alt, hỏng, méo tỉ lệ
    for (const img of document.images) {
      if (!visible(img)) continue
      if (!img.hasAttribute('alt')) add('img-no-alt', img, img.getAttribute('src'))
      if (img.complete && img.naturalWidth === 0) add('img-broken', img, img.getAttribute('src'))
      const fit = getComputedStyle(img).objectFit, r = img.getBoundingClientRect()
      if (img.naturalWidth && fit === 'fill') {
        const a = img.naturalWidth / img.naturalHeight, b = r.width / r.height
        if (Math.abs(a - b) / a > 0.03) add('img-distorted', img, `${a.toFixed(2)} vs ${b.toFixed(2)}`)
      }
    }

    // 4. Tên truy cập và vùng bấm
    const accName = el => {
      const by = el.getAttribute('aria-labelledby')
      if (by) return by.split(/\s+/).map(id => document.getElementById(id)?.textContent || '').join(' ').trim()
      if (el.getAttribute('aria-label')) return el.getAttribute('aria-label').trim()
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName)) {
        const label = (el.id && document.querySelector(`label[for="${CSS.escape(el.id)}"]`)) || el.closest('label')
        return (label?.textContent || el.getAttribute('title') || '').trim()
      }
      const clone = el.cloneNode(true)
      clone.querySelectorAll('[aria-hidden="true"]').forEach(n => n.remove())
      return (clone.textContent || [...el.querySelectorAll('img[alt]')].map(i => i.alt).join(' ') || el.getAttribute('title') || '').trim()
    }
    const controls = [...document.querySelectorAll('a[href], button, input:not([type="hidden"]), select, textarea, summary, [role="button"]')].filter(visible)
    for (const el of controls) {
      if (el.tabIndex < 0 && el.closest('[aria-hidden="true"]')) continue
      if (!accName(el)) add('no-name', el, el.outerHTML.slice(0, 80))
      const r = el.getBoundingClientRect()
      const inline = el.tagName === 'A' && ['P', 'LI', 'SPAN', 'LABEL'].includes(el.parentElement?.tagName) && el.parentElement.textContent.trim().length > el.textContent.trim().length + 2
      if (!inline && !srOnly(el) && (r.width < 24 || r.height < 24) && !(el.type === 'checkbox' || el.type === 'radio')) add('target<24', el, `${Math.round(r.width)}×${Math.round(r.height)}`)
    }
    for (const el of document.querySelectorAll('input:not([type="hidden"]), select, textarea')) {
      if (visible(el) && !accName(el)) add('input-no-label', el)
    }

    // 5. Tương phản chữ (bỏ qua chữ trên ảnh/gradient vì không tính được nền)
    const parse = c => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const [r, g, b, a = 1] = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r, g, b, a } }
    const lum = ({ r, g, b }) => [r, g, b].map(v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4 }).reduce((s, v, i) => s + v * [.2126, .7152, .0722][i], 0)
    const blend = (top, bottom) => ({ r: top.r * top.a + bottom.r * (1 - top.a), g: top.g * top.a + bottom.g * (1 - top.a), b: top.b * top.a + bottom.b * (1 - top.a), a: 1 })
    const background = el => {
      const layers = []
      for (let p = el; p; p = p.parentElement) {
        const s = getComputedStyle(p)
        if (s.backgroundImage !== 'none') return null
        const c = parse(s.backgroundColor)
        if (c && c.a > 0) { layers.push(c); if (c.a >= 1) break }
      }
      return layers.reduceRight((acc, c) => blend(c, acc), { r: 255, g: 255, b: 255, a: 1 })
    }
    // Header trong suốt trên ảnh hero: nền là ảnh, không tính được bằng màu nền CSS
    const overImage = el => { if (el.closest('[data-overlay="true"]')) return true; for (let p = el; p && p !== document.body; p = p.parentElement) { if (p.parentElement?.querySelector(':scope > img, :scope > video') && getComputedStyle(p).position === 'absolute') return true } return false }
    let contrastCount = 0
    for (const el of document.body.querySelectorAll('*')) {
      if (!ownText(el) || !visible(el) || srOnly(el) || overImage(el)) continue
      if (el.closest('button:disabled, [aria-disabled="true"], :disabled')) continue
      const s = getComputedStyle(el), bg = background(el), fg = parse(s.color)
      if (!bg || !fg) continue
      const color = blend({ ...fg, a: fg.a * Number(s.opacity) }, bg)
      const [L1, L2] = [lum(color), lum(bg)].sort((a, b) => b - a)
      const ratio = (L1 + .05) / (L2 + .05), size = parseFloat(s.fontSize), bold = Number(s.fontWeight) >= 700
      const need = size >= 24 || (bold && size >= 18.66) ? 3 : 4.5
      if (ratio < need - 0.01) { add('contrast', el, `${ratio.toFixed(2)}:1 < ${need} (${s.color} on rgb(${Math.round(bg.r)},${Math.round(bg.g)},${Math.round(bg.b)}))`); if (++contrastCount > 6) break }
    }

    // 6. Cấu trúc
    const h1 = [...document.querySelectorAll('h1')].filter(visible)
    if (h1.length !== 1) issues.push({ type: 'h1-count', detail: String(h1.length) })
    let last = 0
    for (const h of [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].filter(visible)) {
      const level = Number(h.tagName[1])
      if (last && level > last + 1) add('heading-skip', h, `h${last}→h${level}`)
      last = level
    }
    const ids = {}
    for (const el of document.querySelectorAll('[id]')) ids[el.id] = (ids[el.id] || 0) + 1
    for (const [id, n] of Object.entries(ids)) if (n > 1) issues.push({ type: 'duplicate-id', detail: `#${id} ×${n}` })
    if (!document.documentElement.lang) issues.push({ type: 'no-lang', detail: '' })
    if (document.querySelectorAll('main').length !== 1) issues.push({ type: 'main-count', detail: String(document.querySelectorAll('main').length) })
    if (!document.title || document.title === 'N&B — Thời trang') issues.push({ type: 'generic-title', detail: document.title })
    return issues
  })
}

/** Tab qua N phần tử đầu: mỗi phần tử phải có chỉ báo focus và không bị phần tử khác che hoàn toàn. */
export async function focusAudit(page, steps = 25) {
  const issues = []
  await page.evaluate(() => { document.activeElement?.blur(); window.scrollTo(0, 0) })
  await page.emulateMedia({ reducedMotion: 'reduce' }) // cuộn tức thì để đo đúng vị trí cuối
  for (let i = 0; i < steps; i++) {
    await page.keyboard.press('Tab')
    await page.waitForTimeout(60)
    const result = await page.evaluate(() => {
      const el = document.activeElement
      if (!el || el === document.body) return null
      const s = getComputedStyle(el), r = el.getBoundingClientRect()
      const indicator = (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0) || (s.boxShadow && s.boxShadow !== 'none')
      const cx = Math.min(Math.max(r.left + r.width / 2, 0), innerWidth - 1), cy = Math.min(Math.max(r.top + r.height / 2, 0), innerHeight - 1)
      const top = document.elementFromPoint(cx, cy)
      const onScreen = r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth
      const covered = onScreen && top && !(el === top || el.contains(top) || top.contains(el))
      const label = `${el.tagName.toLowerCase()} "${(el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 30)}"`
      return { label, indicator, covered: covered ? `${top.tagName.toLowerCase()}.${String(top.className).slice(0, 40)}` : '', hidden: !!el.closest('[inert], [aria-hidden="true"]') || r.width === 0 }
    })
    if (!result) continue
    if (!result.indicator) issues.push({ type: 'focus-no-indicator', detail: result.label })
    if (result.covered) issues.push({ type: 'focus-obscured', detail: `${result.label} under ${result.covered}` })
    if (result.hidden) issues.push({ type: 'focus-hidden-element', detail: result.label })
  }
  await page.emulateMedia({ reducedMotion: null })
  return issues
}
