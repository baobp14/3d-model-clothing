/**
 * Nhập catalog từ bộ dữ liệu H&M (competition "H&M Personalized Fashion
 * Recommendations" do chính H&M Group công bố — dùng cho nghiên cứu, phi
 * thương mại).
 *
 * Vì sao đổi nguồn: dataset Myntra trước đó là hàng phổ thông (Nike/Puma/
 * Adidas chiếm đa số, 0 áo khoác thuộc nhóm Formal) và 80-90% ảnh quần áo là
 * chụp trên người mẫu. Ảnh H&M là ảnh catalog chụp phẳng — đo thử 14/15 tấm
 * đạt — nên vừa sang hơn vừa chiếu lên avatar 3D được.
 *
 * Đồng hồ giữ lại từ Myntra vì H&M không bán đồng hồ.
 *
 * Chạy: node tools/import-hm.mjs [số sản phẩm mỗi danh mục]
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'
import { reframe } from './lib/reframe.mjs'

const PER_CATEGORY = Number(process.argv[2] || 12)
const OUT_IMG = 'public/img/products'
const CACHE = 'tools/.kaggle-cache'
const COMP = 'h-and-m-personalized-fashion-recommendations'

const MAX_SKIN = 0.02
const CONCURRENCY = 3
const MAX_VARIANTS = 3        // tối đa 3 màu mỗi mẫu


const COLOR_MAP = {
  Black: 'black', White: 'white', 'Off White': 'white',
  Grey: 'grey', 'Dark Grey': 'grey', 'Light Grey': 'grey', 'Greyish Beige': 'grey',
  Beige: 'beige', 'Light Beige': 'beige', 'Dark Beige': 'beige',
  'Dark Blue': 'navy', 'Navy Blue': 'navy',
  Brown: 'brown', 'Dark Brown': 'brown', 'Light Brown': 'brown',
  'Dark Red': 'burgundy', Bordeaux: 'burgundy',
  Silver: 'silver', Gold: 'gold',
}

const GROUPS = [
  { dept: 'men', cat: 'm-shirts', vi: 'Áo sơ mi', en: 'Shirts', idx: 'Menswear', types: ['Shirt', 'Polo shirt'], price: [14, 38] },
  { dept: 'men', cat: 'm-tshirts', vi: 'Áo thun', en: 'T-shirts', idx: 'Menswear', types: ['T-shirt'], price: [8, 22] },
  { dept: 'men', cat: 'm-knit', vi: 'Áo len', en: 'Knitwear', idx: 'Menswear', types: ['Sweater', 'Hoodie', 'Cardigan'], price: [22, 48] },
  { dept: 'men', cat: 'm-jackets', vi: 'Áo khoác & vest', en: 'Jackets & blazers', idx: 'Menswear', types: ['Jacket', 'Blazer', 'Coat'], price: [58, 140] },
  { dept: 'men', cat: 'm-trousers', vi: 'Quần', en: 'Trousers', idx: 'Menswear', types: ['Trousers'], price: [18, 42] },

  { dept: 'women', cat: 'w-dresses', vi: 'Đầm', en: 'Dresses', idx: 'Ladieswear', types: ['Dress'], price: [42, 145] },
  { dept: 'women', cat: 'w-tops', vi: 'Áo kiểu', en: 'Blouses & tops', idx: 'Ladieswear', types: ['Blouse', 'Top', 'Vest top'], price: [12, 34] },
  { dept: 'women', cat: 'w-knit', vi: 'Áo len', en: 'Knitwear', idx: 'Ladieswear', types: ['Sweater', 'Cardigan'], price: [24, 52] },
  { dept: 'women', cat: 'w-jackets', vi: 'Áo khoác', en: 'Coats & jackets', idx: 'Ladieswear', types: ['Jacket', 'Coat', 'Blazer'], price: [52, 150] },
  { dept: 'women', cat: 'w-skirts', vi: 'Chân váy', en: 'Skirts', idx: 'Ladieswear', types: ['Skirt'], price: [20, 46] },
  { dept: 'women', cat: 'w-trousers', vi: 'Quần', en: 'Trousers', idx: 'Ladieswear', types: ['Trousers'], price: [20, 46] },

  { dept: 'bags', cat: 'b-bags', vi: 'Túi xách', en: 'Bags', idx: null, types: ['Bag'], price: [28, 96] },
  { dept: 'bags', cat: 'b-wallet', vi: 'Ví & đồ da nhỏ', en: 'Wallets & small leather goods', idx: null, types: ['Wallet'], price: [12, 32] },
  { dept: 'bags', cat: 'b-belt', vi: 'Thắt lưng', en: 'Belts', idx: null, types: ['Belt'], price: [10, 28] },
  { dept: 'bags', cat: 'b-scarf', vi: 'Khăn & kính', en: 'Scarves & sunglasses', idx: null, types: ['Scarf', 'Sunglasses'], price: [8, 26] },
]

const NAME_VI = {
  Shirt: 'Áo sơ mi', 'Polo shirt': 'Áo polo', 'T-shirt': 'Áo thun', Sweater: 'Áo len',
  Hoodie: 'Áo hoodie', Cardigan: 'Áo cardigan', Jacket: 'Áo khoác', Blazer: 'Áo vest',
  Coat: 'Áo măng tô', Trousers: 'Quần âu', Dress: 'Đầm', Blouse: 'Áo blouse',
  Top: 'Áo kiểu', 'Vest top': 'Áo hai dây', Skirt: 'Chân váy',
  Bag: 'Túi xách', Wallet: 'Ví da', Belt: 'Thắt lưng', Scarf: 'Khăn choàng', Sunglasses: 'Kính mát',
}
const NAME_EN = {
  Shirt: 'Shirt', 'Polo shirt': 'Polo Shirt', 'T-shirt': 'T-shirt', Sweater: 'Sweater',
  Hoodie: 'Hoodie', Cardigan: 'Cardigan', Jacket: 'Jacket', Blazer: 'Blazer',
  Coat: 'Coat', Trousers: 'Trousers', Dress: 'Dress', Blouse: 'Blouse',
  Top: 'Top', 'Vest top': 'Vest Top', Skirt: 'Skirt',
  Bag: 'Bag', Wallet: 'Wallet', Belt: 'Belt', Scarf: 'Scarf', Sunglasses: 'Sunglasses',
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

let rateLimited = 0        // số lần dính 429 liên tiếp
const RATE_LIMIT_GIVEUP = 12

async function fetchImage(id, attempt = 0) {
  const file = `images/${id.slice(0, 3)}/${id}.jpg`
  const url = `https://www.kaggle.com/api/v1/competitions/data/download/${COMP}/${encodeURIComponent(file)}`
  const res = await fetch(url, { headers: { Authorization: AUTH }, redirect: 'follow' })
  if (!res.ok) {
    if (res.status === 429) {
      rateLimited++
      if (attempt < 2) { await sleep(4000 * (attempt + 1)); return fetchImage(id, attempt + 1) }
    }
    throw new Error(`HTTP ${res.status}`)
  }
  rateLimited = 0
  return Buffer.from(await res.arrayBuffer())
}

/** Ảnh có người mẫu => nhiều pixel màu da. */
async function skinFraction(buf) {
  const { data, info } = await sharp(buf).resize(60, 80, { fit: 'fill' }).raw().toBuffer({ resolveWithObject: true })
  let skin = 0, n = 0
  for (let i = 0; i < data.length; i += info.channels) {
    if (isSkin(data[i], data[i + 1], data[i + 2])) skin++
    n++
  }
  return skin / n
}

// ── Đọc metadata ─────────────────────────────────────────────────────────
const rows = (await readFile(`${CACHE}/hm-articles.csv`, 'utf8')).split('\n').slice(1).filter(Boolean)
  .map(line => {
    const p = line.split(',')
    if (p.length < 24) return null
    return { id: p[0], code: p[1], name: p[2], type: p[4], group: p[5], colour: p[9], idxg: p[19] }
  })
  .filter(r => r && COLOR_MAP[r.colour])

await mkdir(OUT_IMG, { recursive: true })

// ── Chọn + tải ───────────────────────────────────────────────────────────
const products = []
let nextId = 1000

// Nhớ cả ảnh đã bị loại, nếu không mỗi lần chạy lại sẽ tải lại chúng và
// đốt hết hạn mức request của Kaggle.
const REJECT_FILE = `${CACHE}/rejected.json`
const rejected = new Set(
  existsSync(REJECT_FILE) ? JSON.parse(await readFile(REJECT_FILE, 'utf8')) : [])
const saveRejects = () => writeFile(REJECT_FILE, JSON.stringify([...rejected]))

/** Tải + lọc + chuẩn hoá một article, trả về đường dẫn ảnh hoặc null. */
async function prepareImage(id) {
  const out = path.join(OUT_IMG, `hm-${id}.webp`)
  // Ảnh có sẵn cũng tính là thành công: nếu không, bộ đếm 429 chỉ tăng mà
  // không bao giờ về 0, và lần chạy lại từ cache sẽ tự bỏ cuộc oan.
  if (existsSync(out)) { rateLimited = 0; return `/img/products/hm-${id}.webp` }
  if (rejected.has(id)) return null
  try {
    const buf = await fetchImage(id)
    if (await skinFraction(buf) >= MAX_SKIN) { rejected.add(id); return null }
    await reframe(buf, out)
    return `/img/products/hm-${id}.webp`
  } catch { return null }   // lỗi mạng/429 thì KHÔNG ghi vào danh sách loại
}

for (const g of GROUPS) {
  const pool = rows
    .filter(r => g.types.includes(r.type))
    .filter(r => !g.idx || r.idxg === g.idx)

  // Gom theo product_code: cùng một mẫu, khác màu. Mỗi màu giữ 1 article.
  const byCode = {}
  for (const r of pool) {
    const variants = (byCode[r.code] ??= {})
    variants[COLOR_MAP[r.colour]] ??= r
  }

  // Ưu tiên mẫu nhiều màu nhất, trong cùng mức thì xáo tất định
  const codes = Object.entries(byCode)
    .map(([code, v]) => ({ code, variants: Object.entries(v) }))
    .sort((a, b) => b.variants.length - a.variants.length || seeded(a.code, g.cat) - seeded(b.code, g.cat))

  const accepted = []
  for (let i = 0; i < codes.length && accepted.length < PER_CATEGORY && rateLimited < RATE_LIMIT_GIVEUP; i += CONCURRENCY) {
    const batch = codes.slice(i, i + CONCURRENCY)
    const results = await Promise.all(batch.map(async ({ code, variants }) => {
      const kept = []
      for (const [color, r] of variants.slice(0, MAX_VARIANTS)) {
        const img = await prepareImage(r.id)
        if (img) kept.push({ color, img, r })
      }
      return kept.length ? { code, kept } : null
    }))
    for (const x of results) if (x && accepted.length < PER_CATEGORY) accepted.push(x)
    await sleep(150)
  }

  for (const { kept } of accepted) {
    const head = kept[0].r
    const cut = Math.floor(seeded(head.id, 'cut') * CUT_VI.length)
    const [lo, hi] = g.price
    const apparel = g.dept === 'men' || g.dept === 'women'
    products.push({
      id: nextId++,
      department: g.dept,
      category: g.cat,
      vi: `${NAME_VI[head.type]} ${CUT_VI[cut]}`,
      en: `${CUT_EN[cut]} ${NAME_EN[head.type]}`,
      price: Math.round((lo + seeded(head.id, 'price') * (hi - lo)) * 10) * 100000,
      colors: kept.map(k => k.color),
      sizes: apparel ? APPAREL_SIZES.filter((_, i) => seeded(head.id, `s${i}`) > 0.25) : [],
      isNew: seeded(head.id, 'new') > 0.78,
      images: kept.map(k => k.img),   // images[i] là ảnh của colors[i]
    })
  }
  const multi = accepted.filter(a => a.kept.length > 1).length
  await saveRejects()
  const note = rateLimited >= RATE_LIMIT_GIVEUP ? '  [Kaggle chặn - dừng sớm]' : ''
  console.log(`  ${g.cat.padEnd(12)} ${accepted.length}/${PER_CATEGORY}  (${multi} mẫu nhiều màu)${note}`)
}

// ── Giữ lại đồng hồ từ Myntra (H&M không bán đồng hồ) ────────────────────
const old = JSON.parse(await readFile(`${CACHE}/catalog.json`, 'utf8'))
const watches = old.products.filter(p => p.department === 'watches')
const watchCats = old.categories.filter(c => c.department === 'watches')

const categories = [
  ...GROUPS.map(g => ({ id: g.cat, department: g.dept, vi: g.vi, en: g.en }))
    .filter(c => products.some(p => p.category === c.id)),
  ...watchCats,
]

const prevCount = old.products.filter(p => p.department !== 'watches').length
if (products.length < prevCount * 0.9) {
  console.log(`
GIỮ NGUYÊN catalog cũ: lần này chỉ ${products.length} sản phẩm, lần trước ${prevCount}.`)
  console.log('Kaggle đang chặn — chờ rồi chạy lại, ảnh đã tải sẽ được dùng lại.')
  process.exit(0)
}
await writeFile(`${CACHE}/catalog.json`, JSON.stringify({ products: [...products, ...watches], categories }, null, 2))
console.log(`\nTổng: ${products.length + watches.length} sản phẩm (H&M ${products.length}, đồng hồ Myntra ${watches.length})`)
for (const d of ['men', 'women', 'bags', 'watches']) {
  const n = [...products, ...watches].filter(p => p.department === d).length
  console.log(`  ${d.padEnd(8)} ${n}`)
}
