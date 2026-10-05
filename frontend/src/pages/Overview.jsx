import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { shopApi } from '../lib/api'
import { useLang } from '../i18n'

const vnDay = offset => new Date(Date.now() + 7 * 3600000 + offset * 86400000).toISOString().slice(0, 10)
const calendarRange = (period, month) => {
  const [year, number] = month.split('-').map(Number)
  return period === 'month'
    ? { period, start: `${year}-01-01`, end: `${year}-12-31` }
    : { period, start: `${month}-01`, end: `${month}-${new Date(Date.UTC(year, number, 0)).getUTCDate()}` }
}

export default function Overview() {
  const { lang } = useLang()
  const vi = lang === 'vi'
  const [data, setData] = useState(null)
  const [chart, setChart] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [revision, setRevision] = useState(0)
  const [month, setMonth] = useState(() => vnDay(0).slice(0, 7))
  const [period, setPeriod] = useState('day')
  const [includeTest, setIncludeTest] = useState(false)
  const [range, setRange] = useState(() => calendarRange('day', vnDay(0).slice(0, 7)))
  useEffect(() => {
    let current = vnDay(0).slice(0, 7)
    const check = () => {
      const next = vnDay(0).slice(0, 7)
      if (next !== current) { current = next; setMonth(next); setRange(calendarRange(period, next)) }
    }
    const timer = setInterval(check, 60000)
    window.addEventListener('focus', check)
    return () => { clearInterval(timer); window.removeEventListener('focus', check) }
  }, [period])
  const selectPeriod = next => { setPeriod(next); setRange(calendarRange(next, month)) }
  const money = value => new Intl.NumberFormat(vi ? 'vi-VN' : 'en-US', { style: 'currency', currency: 'VND' }).format(value)
  useEffect(() => {
    const controller = new AbortController()
    setBusy(true); setError('')
    Promise.all([shopApi.request(`/admin/overview${includeTest ? '?include_test=true' : ''}`, { auth: true, signal: controller.signal }),
      shopApi.request(`/admin/report?${new URLSearchParams(range)}${includeTest ? '&include_test=true' : ''}`, { auth: true, signal: controller.signal })]).then(([summary, report]) => {
      if (!controller.signal.aborted) { setData(summary); setChart({ ...report, rangeKey: JSON.stringify(range), includeTest }) }
    }).catch(e => { if (!controller.signal.aborted) setError(e.code === 'NB_INVALID_DATE_RANGE' ? (vi ? 'Chọn khoảng ngày hợp lệ, tối đa 367 ngày.' : 'Select a valid date range of up to 367 days.') : (vi ? 'Không tải được số liệu. Vui lòng thử lại.' : 'Could not load figures. Please retry.')) })
      .finally(() => { if (!controller.signal.aborted) setBusy(false) })
    return () => controller.abort()
  }, [revision, range, vi, includeTest])
  const cards = [
    [vi ? 'Tổng tiền đã thu' : 'Total payment received', data && money(data.received), '/admin/orders?paid=received'],
    [vi ? 'Giá trị đơn đã giao' : 'Delivered order value', data && money(data.revenue), '/admin/orders?status=delivered'],
    [vi ? 'Tổng đơn hàng' : 'Total orders', data?.orders, '/admin/orders'],
    [vi ? 'Chờ xác nhận' : 'Awaiting confirmation', data?.pending, '/admin/orders?status=pending'],
    [vi ? 'Đã giao' : 'Delivered', data?.delivered, '/admin/orders?status=delivered'],
    [vi ? 'Số mẫu sản phẩm' : 'Product styles', data?.products, '/admin/inventory/products'],
    [vi ? 'Số lượng hàng còn trong kho' : 'Units remaining in stock', data?.stock_units?.toLocaleString(vi ? 'vi-VN' : 'en-US'), '/admin/inventory/products'],
    [vi ? 'Sản phẩm tồn kho ≤ 20' : 'Products with stock ≤ 20', data?.low_stock, '/admin/inventory/products?stock=low_or_out'],
  ]
  const series = chart?.series || []
  const max = Math.max(1, ...series.flatMap(row => [row.order_value, row.received]))
  const width = Math.max(600, series.length * 32)
  const step = (width - 80) / Math.max(1, series.length - 1)
  const xAt = index => 50 + index * step
  const yAt = value => 180 - value / max * 150
  const points = key => series.map((row, index) => `${xAt(index)},${yAt(row[key])}`).join(' ')
  return <main className="p-5 lg:p-8"><div className="flex items-center justify-between gap-3"><h1 className="text-3xl font-semibold">{vi ? 'Tổng quan cửa hàng' : 'Store overview'}</h1><button disabled={busy} onClick={() => setRevision(x => x + 1)} className="button">{vi ? 'Tải lại' : 'Reload'}</button></div>
    <p className="mt-4 text-sm text-slate">{vi ? 'Các thẻ hiển thị toàn thời gian. Kho trừ ngay khi đặt đơn, hoàn lại khi hủy. Số mẫu sản phẩm không giảm khi bán hàng. Tiền đã thu do admin xác nhận thực nhận.' : 'Cards show all-time figures. Stock is deducted when an order is placed and restored on cancellation. Selling items does not reduce the number of product styles. Admin records actual payment receipt.'}</p>
    {busy && <p role="status" className="mt-4">{vi ? 'Đang cập nhật…' : 'Updating…'}</p>}{error && <p role="alert" className="mt-4 text-red-700">{error}</p>}
    <label className="mt-4 flex items-center gap-2 text-sm"><input type="checkbox" checked={includeTest} onChange={e => setIncludeTest(e.target.checked)} />{vi ? 'Bao gồm đơn test trong thống kê' : 'Include test orders in statistics'}</label>
    <p className="mt-2 text-xs text-slate">{vi ? 'Mặc định loại đơn test khỏi số liệu đơn và tiền. Số liệu kho vẫn gồm toàn bộ sản phẩm.' : 'Test orders are excluded from order and payment figures by default. Inventory figures include all products.'}</p>
    <div className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{cards.map(([label, value, to]) => <Link key={label} aria-disabled={busy} onClick={e => { if (busy) e.preventDefault() }} to={to.startsWith('/admin/orders') && !includeTest ? `${to}${to.includes('?') ? '&' : '?'}scope=real` : to} className="rounded-xl border border-feather bg-white p-7"><p>{label}</p><p className="mt-5 text-3xl font-semibold">{busy ? '—' : value ?? '—'}</p></Link>)}</div>
    <section className="mt-8 rounded-xl border border-feather bg-white p-5 sm:p-7"><h2 className="text-xl font-semibold">{vi ? 'Biểu đồ đơn hàng và tiền đã thu' : 'Orders and received payments'}</h2>
      <div className="mt-5 flex flex-wrap items-end gap-4">
        <div role="group" aria-label={vi ? 'Hiển thị theo' : 'Display by'} className="flex gap-2">{['day', 'month'].map(value => <button key={value} aria-pressed={period === value} onClick={() => selectPeriod(value)} className={`button rounded-lg ${period === value ? 'bg-indigo-700 text-white' : 'border border-feather'}`}>{value === 'day' ? (vi ? 'Theo ngày' : 'By day') : (vi ? 'Theo tháng' : 'By month')}</button>)}</div>
        {period === 'day' ? <label className="text-sm">{vi ? 'Tháng' : 'Month'}<input type="month" required value={month} className="shop-input mt-2 block" onChange={e => { if (!e.target.value) return; setMonth(e.target.value); setRange(calendarRange(period, e.target.value)) }} /></label>
          : <label className="text-sm">{vi ? 'Năm' : 'Year'}<input type="number" min="2000" max="9999" value={Number(month.slice(0, 4))} className="shop-input mt-2 block" onChange={e => { const year = Number(e.target.value); if (year < 2000 || year > 9999) return; const next = `${year}${month.slice(4)}`; setMonth(next); setRange(calendarRange(period, next)) }} /></label>}
      </div>
      <p className="mt-3 text-sm text-slate">{vi ? (period === 'day' ? 'Từng ngày trong tháng đã chọn. Sang tháng mới tự chuyển về tháng hiện tại.' : 'Từng tháng trong năm đã chọn.') : (period === 'day' ? 'Each day of the selected month. Automatically switches to the current month when a new month starts.' : 'Each month of the selected year.')}</p>
      <p className="mt-5 text-xs text-slate">{vi ? 'Múi giờ Việt Nam. Giá trị đơn tính theo ngày đặt, loại trừ đơn hủy; tiền đã thu tính theo ngày ghi nhận thực nhận.' : 'Vietnam time. Order value uses order dates and excludes cancellations; received payments use receipt dates.'}</p>
      {chart && !busy && !error && chart.rangeKey === JSON.stringify(range) && chart.includeTest === includeTest && <><div className="mt-5 flex flex-wrap gap-5 text-sm"><span className="text-indigo-700">■ {vi ? 'Giá trị đơn' : 'Order value'}: {money(chart.order_value)}</span><span className="text-emerald-700">■ {vi ? 'Đã thu trong kỳ' : 'Received in period'}: {money(chart.received)}</span></div>
      <div className="mt-6 overflow-x-auto"><svg role="img" aria-label={vi ? 'Biểu đồ giá trị đơn và tiền đã thu; số liệu chi tiết bên dưới' : 'Order value and received payment chart; detailed figures below'} viewBox={`0 0 ${width} 220`} style={{ minWidth: width, width: '100%', height: 220 }}>
        {[0, .5, 1].map(fraction => <g key={fraction}><line x1="50" x2={width - 30} y1={yAt(max * fraction)} y2={yAt(max * fraction)} stroke="#e5e7eb" /><text x="45" y={yAt(max * fraction) - 5} fontSize="10" fill="#6b7280">{new Intl.NumberFormat(vi ? 'vi-VN' : 'en-US', { notation: 'compact' }).format(max * fraction)}</text></g>)}
        <polyline data-series="order_value" points={points('order_value')} fill="none" stroke="#4338ca" strokeWidth="2.5" strokeLinejoin="round" /><polyline data-series="received" points={points('received')} fill="none" stroke="#047857" strokeWidth="2.5" strokeLinejoin="round" />{series.map((row, index) => {
        const x = xAt(index)
        return <g key={row.date}><title>{row.date}: {vi ? 'Giá trị đơn' : 'Order value'} {money(row.order_value)}; {vi ? 'Đã thu' : 'Received'} {money(row.received)}</title><circle cx={x} cy={yAt(row.order_value)} r="3" fill="#4338ca" /><circle cx={x} cy={yAt(row.received)} r="3" fill="#047857" /><text x={x} y="205" textAnchor="middle" fontSize="11" fill="#6b7280">{range.period === 'day' ? Number(row.date.slice(-2)) : Number(row.date.slice(5, 7))}</text></g>
      })}</svg></div>
      <details className="mt-5"><summary className="cursor-pointer text-sm underline">{vi ? 'Xem bảng số liệu' : 'View data table'}</summary><div className="mt-4 overflow-auto"><table className="w-full min-w-[500px] text-left text-sm"><thead><tr>{[vi ? 'Ngày/tháng' : 'Day/month', vi ? 'Số đơn' : 'Orders', vi ? 'Giá trị đơn' : 'Order value', vi ? 'Đã thu' : 'Received'].map(label => <th key={label} className="p-3">{label}</th>)}</tr></thead><tbody>{series.map(row => <tr key={row.date} className="border-t border-feather"><td className="p-3">{row.date}</td><td className="p-3">{row.orders}</td><td className="p-3">{money(row.order_value)}</td><td className="p-3">{money(row.received)}</td></tr>)}</tbody></table></div></details></>}
    </section>
  </main>
}
