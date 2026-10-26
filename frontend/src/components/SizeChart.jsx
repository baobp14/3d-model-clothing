import { chartForPrint } from '@/lib/tryon/brandSizes'
import { useLang } from '../i18n'

const columns = {
  tshirt: [['chestCircCm', 'Vòng ngực áo', 'Chest'], ['bodyLengthCm', 'Dài áo', 'Length']],
  pants: [['waistCircCm', 'Vòng eo (chưa giãn)', 'Waist (relaxed)'], ['inseamCm', 'Dài đáy trong', 'Inseam']],
  shorts: [['waistCircCm', 'Vòng eo', 'Waist'], ['inseamCm', 'Dài đáy trong', 'Inseam']],
  skirt: [['waistCircCm', 'Vòng eo cơ thể', 'Body waist'], ['hipCircCm', 'Vòng hông cơ thể', 'Body hip']],
}

/** The brand's own measurements for this product, or null when we have none. */
export function sizeChartFor(image) {
  const folder = /\/img\/clothing\/([^/]+)\//.exec(image || '')?.[1]
  return chartForPrint(folder)
}

export default function SizeChart({ chart }) {
  const { lang } = useLang()
  const vi = lang === 'vi'
  const cols = columns[chart.kind]
  return <div className="space-y-3">
    <p className="text-body-sm">{chart.measured
      ? (vi ? 'Số đo do N&B đo thực tế trên sản phẩm' : 'Measured by N&B on the garment')
      : <>{vi ? 'Số đo thật của hãng' : 'Brand measurements'}: <b>{chart.brand}</b> · {chart.style}</>}</p>
    <div className="overflow-x-auto">
      <table className="w-full text-left text-body-sm tabular-nums">
        <thead className="border-b border-line text-ink-muted"><tr>
          <th scope="col" className="py-2 pr-3 font-semibold">Size</th>
          {cols.map(([key, labelVi, labelEn]) => <th key={key} scope="col" className="py-2 pr-3 font-semibold">{vi ? labelVi : labelEn} (cm)</th>)}
        </tr></thead>
        <tbody>{Object.entries(chart.sizes).filter(([, size]) => size).map(([letter, size]) => <tr key={letter} className="border-b border-line last:border-0">
          <td className="py-2 pr-3 font-semibold">{letter}{size.label !== letter && <span className="font-normal text-ink-muted"> ({chart.brand} {size.label})</span>}</td>
          {cols.map(([key]) => <td key={key} className="py-2 pr-3">{size[key] ? Math.round(size[key]) : '—'}</td>)}
        </tr>)}</tbody>
      </table>
    </div>
    {chart.waistStretchCm && <p className="text-caption text-ink-muted">{vi ? `Lưng thun, giãn thêm khoảng ${chart.waistStretchCm}cm.` : `Elastic waist, stretches about ${chart.waistStretchCm}cm.`}</p>}
    {chart.estimate && <p className="text-caption text-warning">{chart.estimate}</p>}
    {chart.note && <p className="text-caption text-ink-muted">{chart.note}</p>}
    <p className="text-caption text-ink-muted">{vi ? 'Mặc thử 3D dùng đúng các số đo này để báo vừa / rộng / chật.' : 'The 3D try-on uses these numbers for its fit verdict.'} {chart.source && <a className="underline" href={chart.source} target="_blank" rel="noopener noreferrer">{vi ? 'Nguồn' : 'Source'}</a>}</p>
  </div>
}
