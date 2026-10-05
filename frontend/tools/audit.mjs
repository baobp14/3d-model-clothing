/**
 * Soát code: import không dùng, biến khai báo rồi bỏ đó, file mồ côi.
 * Chạy: node tools/audit.mjs
 */
import fs from 'node:fs'

const files = []
const walk = d => {
  for (const f of fs.readdirSync(d, { withFileTypes: true })) {
    const p = `${d}/${f.name}`
    if (f.isDirectory()) walk(p)
    else if (/\.(jsx|js|mjs)$/.test(f.name)) files.push(p)
  }
}
walk('src')
walk('tools')

const src = Object.fromEntries(files.map(f => [f, fs.readFileSync(f, 'utf8')]))
const word = n => new RegExp(`\\b${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`)

let issues = 0

console.log('=== import khai báo nhưng không dùng ===')
for (const [file, code] of Object.entries(src)) {
  const importLines = code.match(/^import[^\n]*$/gm) ?? []
  const body = code.split('\n').filter(l => !/^\s*import\s/.test(l)).join('\n')
  for (const line of importLines) {
    const names = []
    const def = line.match(/^import\s+(\w+)/)
    if (def) names.push(def[1])
    const braced = line.match(/\{([^}]*)\}/)
    if (braced) {
      for (const part of braced[1].split(',')) {
        const n = part.trim().split(/\s+as\s+/).pop()
        if (n) names.push(n)
      }
    }
    for (const n of names) {
      if (!word(n).test(body)) { console.log(`  ${file} -> ${n}`); issues++ }
    }
  }
}

console.log('\n=== biến/hằng khai báo nhưng không dùng (trong cùng file) ===')
for (const [file, code] of Object.entries(src)) {
  for (const m of code.matchAll(/^(?:const|let)\s+([A-Za-z_]\w*)\s*=/gm)) {
    const name = m[1]
    const rest = code.slice(0, m.index) + code.slice(m.index + m[0].length)
    if (!word(name).test(rest) && !code.includes(`export const ${name}`)) {
      console.log(`  ${file} -> ${name}`); issues++
    }
  }
}

console.log('\n=== file không ai import ===')
const entry = ['src/main.jsx', 'src/App.jsx']
for (const file of files) {
  if (entry.includes(file) || file.startsWith('tools/')) continue
  const base = file.split('/').pop().replace(/\.(jsx|js|mjs)$/, '')
  const others = Object.entries(src).filter(([f]) => f !== file).map(([, c]) => c).join('\n')
  if (!others.includes(`/${base}'`) && !others.includes(`/${base}"`) && !others.includes(`'./${base}`)) {
    console.log(`  ${file}`); issues++
  }
}

// i18n: hai từ điển phải cùng bộ khoá, và trong một từ điển không được có
// khoá trùng — JS lấy giá trị cuối cùng nên khoá trùng âm thầm ghi đè, kiểu
// chèn nhầm bản tiếng Anh vào khối tiếng Việt thì cả trang đổi ngôn ngữ.
console.log('\n=== i18n ===')
{
  const code = fs.readFileSync('src/i18n.jsx', 'utf8')
  const viStart = code.indexOf('vi: {'), enStart = code.indexOf('en: {')
  const blocks = { vi: code.slice(viStart, enStart), en: code.slice(enStart) }
  const keysOf = b => [...b.matchAll(/'([a-z0-9]+\.[A-Za-z0-9_.]+)':/g)].map(m => m[1])
  const seen = {}
  for (const [lang, block] of Object.entries(blocks)) {
    const keys = keysOf(block)
    const dup = [...new Set(keys.filter((k, i) => keys.indexOf(k) !== i))]
    if (dup.length) { console.log(`  ${lang}: khoá trùng -> ${dup.join(' ')}`); issues += dup.length }
    seen[lang] = new Set(keys)
  }
  const onlyVi = [...seen.vi].filter(k => !seen.en.has(k))
  const onlyEn = [...seen.en].filter(k => !seen.vi.has(k))
  if (onlyVi.length) { console.log(`  chỉ có ở vi: ${onlyVi.join(' ')}`); issues += onlyVi.length }
  if (onlyEn.length) { console.log(`  chỉ có ở en: ${onlyEn.join(' ')}`); issues += onlyEn.length }
  if (!onlyVi.length && !onlyEn.length) console.log(`  ${seen.vi.size} khoá, hai ngôn ngữ khớp nhau`)
}

console.log(`\n${issues} điểm cần xem. File: ${files.filter(f => f.startsWith('src')).length} src, ${files.filter(f => f.startsWith('tools')).length} tools`)
