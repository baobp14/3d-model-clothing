/**
 * Lấp những danh mục H&M chưa lấy đủ bằng dataset Myntra (license MIT).
 *
 * Dùng hai nguồn vì mỗi dataset có hạn mức request riêng, và vì H&M không có
 * đồng hồ. Ảnh của cả hai đều đi qua cùng một bước chuẩn hoá nền nên nhìn
 * vẫn đồng bộ.
 *
 * Myntra có sẵn bản thumbnail 60x80 trên đĩa -> lọc offline trước, chỉ tải
 * full-res những ảnh đã trúng tuyển.
 *
 * Chạy: node tools/fill-myntra.mjs
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'
import { reframe } from './lib/reframe.mjs'

const CACHE = 'tools/.kaggle-cache'
const THUMBS = `${CACHE}/small/images`
const OUT_IMG = 'public/img/products'
const DATASET = 'nirmalsankalana/fashion-product-text-images-dataset'
const TARGET = 10
const MAX_SKIN = 0.02
const SCAN_LIMIT = 400
const CONCURRENCY = 2

const COLOR_MAP = {
  Black: 'black', White: 'white', 'Off White': 'white', Grey: 'grey',
  'Grey Melange': 'grey', Charcoal: 'grey', Brown: 'brown', Coffee: 'brown',
  Tan: 'brown', Beige: 'beige', Cream: 'beige', Khaki: 'beige',
  'Navy Blue': 'navy', Silver: 'silver', Gold: 'gold',
  Maroon: 'burgundy', Burgundy: 'burgundy',
}

const GROUPS = [
  { dept: 'women', cat: 'w-trousers', vi: 'Quần', en: 'Trousers', gender: ['Women'], types: ['Trousers', 'Jeans', 'Capris'], price: [20, 46] },
  { dept: 'bags', cat: 'b-bags', vi: 'Túi xách', en: 'Bags', gender: null, types: ['Handbags'], price: [28, 96] },
  { dept: 'bags', cat: 'b-wallet', vi: 'Ví & đồ da nhỏ', en: 'Wallets & small leather goods', gender: null, types: ['Wallets', 'Clutches'], price: [12, 32] },
  { dept: 'bags', cat: 'b-belt', vi: 'Thắt lưng', en: 'Belts', gender: null, types: ['Belts'], price: [10, 28] },
  { dept: 'bags', cat: 'b-scarf', vi: 'Khăn & kính', en: 'Scarves & sunglasses', gender: null, types: ['Scarves', 'Stoles', 'Sunglasses'], price: [8, 26] },

  // H&M không bán đồng hồ nên nhóm này luôn lấy từ Myntra
  { dept: 'watches', cat: 'wa-men', vi: 'Đồng hồ nam', en: "Men's watches", gender: ['Men'], types: ['Watches'], price: [142, 412] },
  { dept: 'watches', cat: 'wa-women', vi: 'Đồng hồ nữ', en: "Women's watches", gender: ['Women'], types: ['Watches'], price: [126, 368] },
]

const NAME_VI = {
  Trousers: 'Quần âu', Jeans: 'Quần jeans', Capris: 'Quần lửng',
  Handbags: 'Túi xách tay', Wallets: 'Ví da', Clutches: 'Ví cầm tay',
  Belts: 'Thắt lưng', Scarves: 'Khăn choàng', Stoles: 'Khăn lụa', Sunglasses: 'Kính mát',
  Watches: 'Đồng hồ',
}
const NAME_EN = {
  Trousers: 'Trousers', Jeans: 'Jeans', Capris: 'Cropped Trousers',
  Handbags: 'Handbag', Wallets: 'Wallet', Clutches: 'Clutch',
  Belts: 'Belt', Scarves: 'Scarf', Stoles: 'Stole', Sunglasses: 'Sunglasses',
  Watches: 'Watch',
}
const CUT_VI = ['dáng cổ điển', 'phom ôm', 'dáng suông', 'bản mềm', 'cắt may tối giản', 'phom rộng']
const CUT_EN = ['Classic', 'Tailored', 'Relaxed', 'Soft', 'Minimal', 'Oversized']
const APPAREL_SIZES = ['XS', 'S', 'M', 'L', 'XL']

const env = Object.fromEntries(
  (await readFile('.env.local', 'utf8')).split('\n').filter(l => /^[A-Z]/.test(l))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] }))
const AUTH = 'Basic ' + Buffer.from(`${env.KAGGLE_USERNAME}:${env.KAGGLE_KEY}`).toString('base64')

const sleep = ms => new Promise(r => setTimeout(r, ms))
const seeded = (id, salt) => {
  let h = 2166136261
  for (const ch of `${id}:${salt}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619)
  return ((h >>> 0) % 10000) / 10000
}
const isSkin = (r, g, b) =>
  r > 95 && g > 40 && b > 20 && Math.max(r, g, b) - Math.min(r, g, b) > 15 &&
  Math.abs(r - g) > 15 && r > g && r > b

/** Chấm điểm trên thumbnail đã có sẵn — không tốn request nào. */
async function skinOfThumb(id) {
  const f = `${THUMBS}/${id}.jpg`
  if (!existsSync(f)) return 1
  const { data, info } = await sharp(f).raw().toBuffer({ resolveWithObject: true })
  let skin = 0, n = 0
  for (let i = 0; i < data.length; i += info.channels) {
    if (isSkin(data[i], data[i + 1], data[i + 2])) skin++
    n++
  }
  return skin / n
}

async function download(id) {
  const url = `https://www.kaggle.com/api/v1/datasets/download/${DATASET}?file_name=${encodeURIComponent(`data/${id}.jpg`)}`
  const res = await fetch(url, { headers: { Authorization: AUTH }, redirect: 'follow' })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return Buffer.from(await res.arrayBuffer())
}

const rows = (await readFile(`${CACHE}/styles.csv.txt`, 'utf8')).split('\n').slice(1).filter(Boolean)
  .map(l => { const p = l.split(','); return { id: p[0], gender: p[1], type: p[4], colour: p[5], year: Number(p[7]) || 2015 } })

const catalog = JSON.parse(await readFile(`${CACHE}/catalog.json`, 'utf8'))
await mkdir(OUT_IMG, { recursive: true })

let nextId = Math.max(...catalog.products.map(p => p.id)) + 1
let added = 0

for (const g of GROUPS) {
  const have = catalog.products.filter(p => p.category === g.cat).length
  const need = TARGET - have
  if (need <= 0) { console.log(`  ${g.cat.padEnd(12)} đã đủ (${have})`); continue }

  const pool = rows
    .filter(r => g.types.includes(r.type))
    .filter(r => !g.gender || g.gender.includes(r.gender))
    .filter(r => COLOR_MAP[r.colour])
    .sort((a, b) => seeded(a.id, g.cat) - seeded(b.id, g.cat))
    .slice(0, SCAN_LIMIT)

  // Lọc offline
  const scored = []
  for (const r of pool) {
    const skin = await skinOfThumb(r.id)
    if (skin < MAX_SKIN) scored.push({ ...r, skin })
  }
  scored.sort((a, b) => a.skin - b.skin)

  // Chia đều theo màu
  const byColor = {}
  for (const r of scored) (byColor[COLOR_MAP[r.colour]] ??= []).push(r)
  const queues = Object.values(byColor)
  const picks = []
  while (picks.length < need * 2 && queues.some(q => q.length)) {
    for (const q of queues) {
      if (picks.length >= need * 2) break
      if (q.length) picks.push(q.shift())
    }
  }

  const kept = []
  for (let i = 0; i < picks.length && kept.length < need; i += CONCURRENCY) {
    const batch = picks.slice(i, i + CONCURRENCY)
    const res = await Promise.all(batch.map(async r => {
      const out = path.join(OUT_IMG, `my-${r.id}.webp`)
      if (existsSync(out)) return r
      try { await reframe(await download(r.id), out); return r } catch { return null }
    }))
    for (const r of res) if (r && kept.length < need) kept.push(r)
    await sleep(250)
  }

  for (const r of kept) {
    const cut = Math.floor(seeded(r.id, 'cut') * CUT_VI.length)
    const [lo, hi] = g.price
    catalog.products.push({
      id: nextId++,
      department: g.dept,
      category: g.cat,
      vi: `${NAME_VI[r.type]} ${CUT_VI[cut]}`,
      en: `${CUT_EN[cut]} ${NAME_EN[r.type]}`,
      price: Math.round((lo + seeded(r.id, 'price') * (hi - lo)) * 10) * 100000,
      colors: [COLOR_MAP[r.colour]],
      sizes: g.dept === 'women' ? APPAREL_SIZES.filter((_, i) => seeded(r.id, `s${i}`) > 0.25) : [],
      isNew: r.year >= 2018,
      images: [`/img/products/my-${r.id}.webp`],
    })
  }
  if (!catalog.categories.some(c => c.id === g.cat)) {
    catalog.categories.push({ id: g.cat, department: g.dept, vi: g.vi, en: g.en })
  }
  added += kept.length
  console.log(`  ${g.cat.padEnd(12)} +${kept.length} (đã có ${have}, cần ${need}, quét ${scored.length}/${pool.length} đạt)`)
}

await writeFile(`${CACHE}/catalog.json`, JSON.stringify(catalog, null, 2))
console.log(`\nThêm ${added} sản phẩm. Tổng: ${catalog.products.length}`)
for (const d of ['men', 'women', 'bags', 'watches']) {
  console.log(`  ${d.padEnd(8)} ${catalog.products.filter(p => p.department === d).length}`)
}
