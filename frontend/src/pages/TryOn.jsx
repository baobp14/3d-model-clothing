import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import GarmentTestApp from '@/components/garment-test/GarmentTestApp'
import { registerSavedCharts } from '@/lib/tryon/brandSizes'
import { shopApi } from '../lib/api'
import { useLang } from '../i18n'

// The 3D fitting room inside the shop. It reads ?top= / ?bottom= (dataset folder
// names) like the standalone app, so product pages can deep-link a garment.
export default function TryOn() {
  const { lang } = useLang()
  const vi = lang === 'vi'
  // Size charts saved in admin must be known before the first fit is computed.
  const [chartsReady, setChartsReady] = useState(false)
  useEffect(() => {
    let live = true
    shopApi.request('/size-charts')
      .then(data => registerSavedCharts(data.charts || []))
      .catch(() => registerSavedCharts([]))
      .finally(() => { if (live) setChartsReady(true) })
    return () => { live = false }
  }, [])

  return <main className="tryon-embed">
    <title>{(vi ? 'Phòng thử đồ 3D' : '3D fitting room') + ' – N&B'}</title>
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-paper px-(--gutter) py-3">
      <div>
        <h1 className="font-display text-title-sm">{vi ? 'Phòng thử đồ 3D' : '3D fitting room'}</h1>
        <p className="text-body-sm text-ink-muted">{vi ? 'Chọn người mẫu theo số đo, chọn size, xoay để xem độ vừa.' : 'Pick a body by measurements, choose a size and rotate to check the fit.'}</p>
      </div>
      <Link to="/products" className="button button--sm">{vi ? 'Tiếp tục mua sắm' : 'Continue shopping'}</Link>
    </div>
    {chartsReady ? <GarmentTestApp /> : <p className="p-6 text-body-sm text-ink-muted">{vi ? 'Đang tải bảng size…' : 'Loading size charts…'}</p>}
  </main>
}
