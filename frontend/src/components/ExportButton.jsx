import { useState } from 'react'
import { shopApi } from '../lib/api'
import { useLang } from '../i18n'

export default function ExportButton({ endpoint, disabled = false }) {
  const { lang } = useLang(), vi = lang === 'vi'
  const [busy, setBusy] = useState(false), [error, setError] = useState('')
  async function download() {
    if (busy) return
    setBusy(true); setError('')
    try {
      const result = await shopApi.request(endpoint, { auth: true })
      const url = URL.createObjectURL(new Blob([result.csv], { type: 'text/csv;charset=utf-8' }))
      const link = document.createElement('a')
      link.href = url; link.download = result.filename; document.body.append(link); link.click(); link.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (e) {
      setError(e.code === 'NB_EXPORT_TOO_LARGE' ? (vi ? 'Dữ liệu quá lớn. Lọc hẹp hơn rồi xuất lại (tối đa 10.000 mục / 50.000 dòng).' : 'Too much data. Narrow your filters before exporting (up to 10,000 items / 50,000 rows).') : (vi ? 'Không xuất được CSV. Vui lòng thử lại.' : 'Could not export CSV. Please retry.'))
    } finally { setBusy(false) }
  }
  return <div><button type="button" disabled={busy || disabled} onClick={download} className="button">{busy ? (vi ? 'Đang xuất…' : 'Exporting…') : (vi ? 'Xuất CSV' : 'Export CSV')}</button>{error && <p role="alert" className="mt-2 max-w-xs text-sm text-red-700">{error}</p>}</div>
}
