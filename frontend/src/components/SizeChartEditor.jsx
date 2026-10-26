import { useEffect, useState } from 'react'
import { BRAND_CHARTS, chartForPrint, fromSaved } from '@/lib/tryon/brandSizes'
import { shopApi } from '../lib/api'
import { useLang } from '../i18n'
import { folderOf } from '../tryon/links'

const LETTERS = ['S', 'M', 'L', 'XL']
const KINDS = { tshirt: ['Áo', 'Top'], pants: ['Quần dài', 'Trousers'], shorts: ['Quần short', 'Shorts'], skirt: ['Chân váy', 'Skirt'] }
export const MEASURES = {
  tshirt: [['chestCircCm', 'Vòng ngực áo', 'Chest', true], ['bodyLengthCm', 'Dài áo', 'Length', true]],
  pants: [['waistCircCm', 'Vòng eo', 'Waist', true], ['hipCircCm', 'Vòng hông', 'Hip'], ['inseamCm', 'Dài đáy trong', 'Inseam']],
  shorts: [['waistCircCm', 'Vòng eo', 'Waist', true], ['inseamCm', 'Dài đáy trong', 'Inseam']],
  skirt: [['waistCircCm', 'Vòng eo', 'Waist', true], ['hipCircCm', 'Vòng hông', 'Hip']],
}
const kindFor = category => ({ 'm-trousers': 'pants', 'w-skirts': 'skirt' }[category] || 'tshirt')
const emptySizes = () => Object.fromEntries(LETTERS.map(letter => [letter, {}]))

// Admin: pick one of the brand charts we have, or enter the shop's own flat measurements.
// The product page and the 3D try-on use whatever is saved here.
export default function SizeChartEditor({ product }) {
  const { lang } = useLang()
  const vi = lang === 'vi'
  const auto = chartForPrint(folderOf(product.images[0]))
  const [saved, setSaved] = useState(undefined)
  const [source, setSource] = useState('brand')
  const [kind, setKind] = useState(kindFor(product.category))
  const [brandChart, setBrandChart] = useState('')
  const [sizes, setSizes] = useState(emptySizes)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  function load(chart) {
    setSaved(chart)
    const base = chart ? fromSaved(chart) : auto
    setSource(chart?.source || (auto ? 'brand' : 'measured'))
    setKind(chart?.kind || auto?.kind || kindFor(product.category))
    setBrandChart(chart?.brand_chart || (auto && !auto.measured ? auto.id : ''))
    setSizes(chart?.source === 'measured' ? { ...emptySizes(), ...chart.sizes } : base ? Object.fromEntries(LETTERS.map(l => [l, { ...base.sizes[l] }])) : emptySizes())
    setNote(chart?.note || '')
  }
  useEffect(() => {
    shopApi.request(`/products/${product.id}/size-chart`).then(data => load(data.chart)).catch(() => load(null))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.id])

  const brandOptions = BRAND_CHARTS.filter(chart => chart.kind === kind)
  const picked = BRAND_CHARTS.find(chart => chart.id === brandChart)
  const columns = MEASURES[kind]
  const setMeasure = (letter, key, value) => setSizes(current => ({ ...current, [letter]: { ...current[letter], [key]: value === '' ? undefined : Number(value) } }))

  async function save() {
    setBusy(true); setMessage('')
    const chosen = source === 'brand' ? picked?.sizes || {} : sizes
    const body = {
      source, kind, note,
      brand_chart: source === 'brand' ? brandChart : '',
      sizes: Object.fromEntries(LETTERS.filter(l => chosen[l] && columns.some(([key]) => chosen[l][key]))
        .map(l => [l, Object.fromEntries(columns.filter(([key]) => chosen[l][key]).map(([key]) => [key, chosen[l][key]]))])),
    }
    try {
      const data = await shopApi.request(`/admin/products/${product.id}/size-chart`, { method: 'PUT', auth: true, body })
      load(data.chart); setMessage(vi ? 'Đã lưu bảng size.' : 'Size chart saved.')
    } catch {
      setMessage(vi ? 'Chưa lưu được. Áo cần đủ vòng ngực và dài áo; quần, váy cần vòng eo cho mỗi size đã nhập.' : 'Not saved. Tops need chest and length; bottoms need the waist for each size entered.')
    } finally { setBusy(false) }
  }
  async function clear() {
    if (!window.confirm(vi ? 'Xóa bảng size đã lưu? Sản phẩm sẽ quay về bảng tự nhận diện hoặc bảng chung.' : 'Delete the saved chart?')) return
    setBusy(true)
    try { await shopApi.request(`/admin/products/${product.id}/size-chart`, { method: 'DELETE', auth: true }); load(null); setMessage(vi ? 'Đã xóa.' : 'Deleted.') }
    finally { setBusy(false) }
  }

  const current = saved ? (saved.source === 'brand' ? `${picked?.brand || ''} · ${picked?.style || saved.brand_chart}` : (vi ? 'Shop tự đo' : 'Measured by the shop'))
    : auto ? `${vi ? 'Tự nhận diện' : 'Auto-detected'}: ${auto.brand} · ${auto.style}` : (vi ? 'Bảng size chung N&B' : 'N&B generic chart')
  const radio = (value, label) => <label className="flex items-center gap-2 text-sm"><input type="radio" name="size-source" checked={source === value} onChange={() => setSource(value)} />{label}</label>

  return <section className="rounded-2xl border border-[#dfe3eb] bg-white p-5 sm:p-7">
    <h2 className="font-semibold">{vi ? 'Bảng size' : 'Size chart'}</h2>
    <p className="mt-1 text-sm text-slate">{vi ? 'Đang dùng' : 'In use'}: <b>{saved === undefined ? '…' : current}</b>{saved && <span className="ml-2 badge badge--success">{vi ? 'Đã lưu' : 'Saved'}</span>}</p>
    <div className="mt-4 flex flex-wrap gap-6">
      {radio('brand', vi ? 'Dùng bảng có sẵn của hãng' : 'Use a brand chart')}
      {radio('measured', vi ? 'Shop tự đo' : 'Measured by the shop')}
      <label className="text-sm">{vi ? 'Loại đồ' : 'Garment'} <select value={kind} onChange={e => { setKind(e.target.value); setBrandChart('') }} className="shop-input ml-2">{Object.entries(KINDS).map(([key, label]) => <option key={key} value={key}>{label[vi ? 0 : 1]}</option>)}</select></label>
    </div>

    {source === 'brand' && <div className="mt-4">
      <label className="block text-sm">{vi ? 'Hãng và mẫu' : 'Brand and style'}
        <select value={brandChart} onChange={e => setBrandChart(e.target.value)} className="shop-input mt-2 w-full max-w-md">
          <option value="">{vi ? '— Chọn bảng size —' : '— Choose a chart —'}</option>
          {brandOptions.map(chart => <option key={chart.id} value={chart.id}>{chart.brand} · {chart.style}</option>)}
        </select></label>
      {!brandOptions.length && <p className="mt-2 text-sm text-warning">{vi ? 'Chưa có bảng hãng nào cho loại đồ này. Chọn "Shop tự đo".' : 'No brand chart for this garment yet. Choose "Measured by the shop".'}</p>}
      {picked?.estimate && <p className="mt-2 text-sm text-warning">{picked.estimate}</p>}
    </div>}

    {(source === 'measured' || picked) && <div className="mt-4 overflow-x-auto">
      <table className="w-full min-w-[28rem] text-left text-sm tabular-nums">
        <thead className="border-b border-[#e2e5ec] text-xs text-slate"><tr><th className="py-2 pr-3">Size</th>{columns.map(([key, labelVi, labelEn, required]) => <th key={key} className="py-2 pr-3">{vi ? labelVi : labelEn} (cm){required && ' *'}</th>)}</tr></thead>
        <tbody>{LETTERS.map(letter => <tr key={letter} className="border-b border-[#e2e5ec] last:border-0">
          <td className="py-2 pr-3 font-semibold">{letter}{source === 'brand' && picked?.sizes[letter]?.label && picked.sizes[letter].label !== letter && <span className="font-normal text-slate"> ({picked.sizes[letter].label})</span>}</td>
          {columns.map(([key, labelVi]) => <td key={key} className="py-2 pr-3">{source === 'brand'
            ? (picked?.sizes[letter]?.[key] ? Math.round(picked.sizes[letter][key] * 10) / 10 : '—')
            : <input type="number" min="1" max="299" step="0.5" aria-label={`${labelVi} ${letter}`} value={sizes[letter]?.[key] ?? ''} onChange={e => setMeasure(letter, key, e.target.value)} className="shop-input w-24" />}</td>)}
        </tr>)}</tbody>
      </table>
      {source === 'measured' && <p className="mt-2 text-xs text-slate">{vi ? 'Đo phẳng: ngang ngực từ nách sang nách rồi nhân đôi; vòng eo đo phẳng nhân đôi. Size nào không bán thì để trống.' : 'Measure flat: armpit to armpit ×2 for chest; flat waist ×2. Leave sizes you do not sell empty.'}</p>}
    </div>}

    <label className="mt-4 block text-sm">{vi ? 'Ghi chú hiển thị cho khách (không bắt buộc)' : 'Note shown to customers (optional)'}
      <input value={note} maxLength={300} onChange={e => setNote(e.target.value)} placeholder={vi ? 'VD: Đo phẳng, sai số ±1cm' : 'e.g. Measured flat, ±1cm'} className="shop-input mt-2 w-full" /></label>
    <div className="mt-4 flex flex-wrap items-center gap-3">
      <button type="button" disabled={busy || (source === 'brand' && !picked)} className="button button--primary" onClick={save}>{vi ? 'Lưu bảng size' : 'Save size chart'}</button>
      {saved && <button type="button" disabled={busy} className="button button--danger" onClick={clear}>{vi ? 'Xóa bảng đã lưu' : 'Delete saved chart'}</button>}
      {message && <p role="status" className="text-sm">{message}</p>}
    </div>
  </section>
}
