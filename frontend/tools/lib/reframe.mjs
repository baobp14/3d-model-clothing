import sharp from 'sharp'

export const CANVAS = { w: 900, h: 1200 }
export const BG = { r: 250, g: 249, b: 246 }
const FILL = 0.84

/**
 * Vì sao không xoá nền mà lại chỉnh tông nền:
 *
 * Ảnh H&M chụp trên phông xám nhạt. Với sản phẩm sáng màu, vải còn gần màu
 * nền hơn cả độ dao động của chính nền (đo được: vải trắng 228,229,233 vs
 * nền 236,235,233 — chênh 14). Không ngưỡng màu nào tách được, và loang từ
 * mép thì ăn thủng ruột áo trắng.
 *
 * Cách chắc ăn hơn: đo màu nền rồi dịch toàn ảnh sao cho nền trùng đúng màu
 * nền của trang. Sản phẩm còn nguyên, và cái khối chữ nhật lạc tông biến mất
 * vì nền ảnh hoà vào nền thẻ.
 */
async function levelBackground(input) {
  const pre = await sharp(input)
    .resize(1100, 1500, { fit: 'inside', withoutEnlargement: true })
    .removeAlpha().raw().toBuffer({ resolveWithObject: true })

  const { width: w, height: h, channels: ch } = pre.info
  const at = (x, y) => (y * w + x) * ch

  // Màu nền = trung vị dải pixel sát mép (bền với vết bẩn/bóng lọt vào mép)
  const samples = []
  for (let x = 0; x < w; x += 3) { samples.push(at(x, 1), at(x, h - 2)) }
  for (let y = 0; y < h; y += 3) { samples.push(at(1, y), at(w - 2, y)) }
  const median = c => {
    const v = samples.map(i => pre.data[i + c]).sort((a, b) => a - b)
    return v[v.length >> 1]
  }
  const bg = [median(0), median(1), median(2)]

  // Nền tối => không phải ảnh studio, để nguyên
  if ((bg[0] + bg[1] + bg[2]) / 3 < 170) return { buf: input, bg: null }

  const target = [BG.r, BG.g, BG.b]
  const delta = target.map((t, i) => t - bg[i])

  const buf = await sharp(input)
    .linear([1, 1, 1], delta)   // x + delta, theo từng kênh
    .toBuffer()

  return { buf, bg, delta }
}

/** Cắt phần lề trơn quanh ảnh, trả về buffer đã cắt (hoặc nguyên nếu không cắt được). */
async function trimMargins(buf) {
  try {
    const t = await sharp(buf).trim({ threshold: 6 }).toBuffer({ resolveWithObject: true })
    const src = await sharp(buf).metadata()
    if (t.info.width > src.width * 0.2 && t.info.height > src.height * 0.2) return t.data
  } catch { /* nền không trơn */ }
  return buf
}

/**
 * Đưa ảnh về khung chuẩn: nền trùng màu trang, sản phẩm căn giữa, cùng tỉ lệ.
 * Trả về màu nền gốc đo được (để kiểm tra).
 */
export async function reframe(input, out) {
  const { buf, bg } = await levelBackground(input)
  const subject = await trimMargins(buf)

  const inner = await sharp(subject)
    .resize(Math.round(CANVAS.w * FILL), Math.round(CANVAS.h * FILL), { fit: 'inside' })
    .toBuffer()

  await sharp({ create: { width: CANVAS.w, height: CANVAS.h, channels: 3, background: BG } })
    .composite([{ input: inner, gravity: 'center' }])
    .webp({ quality: 86 })
    .toFile(out)

  return bg
}
