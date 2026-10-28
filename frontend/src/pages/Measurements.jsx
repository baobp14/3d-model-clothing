import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useLang } from '../i18n'
import { useMeasurements } from '../hooks/useMeasurements'
import { estimateMeasurements } from '../lib/sizeRecommendation'

export default function Measurements() {
  const { lang } = useLang()
  const vi = lang === 'vi'
  const { measurements, loading, saving, save } = useMeasurements()

  const [height, setHeight] = useState('')
  const [weight, setWeight] = useState('')
  const [chest, setChest] = useState('')
  const [waist, setWaist] = useState('')
  const [hips, setHips] = useState('')
  const [shoulder, setShoulder] = useState('')
  const [fitPref, setFitPref] = useState('regular')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (measurements) {
      setHeight(measurements.height ?? '')
      setWeight(measurements.weight ?? '')
      setChest(measurements.chest ?? '')
      setWaist(measurements.waist ?? '')
      setHips(measurements.hips ?? '')
      setShoulder(measurements.shoulder ?? '')
      setFitPref(measurements.fit_preference || 'regular')
    }
  }, [measurements])

  function parseVal(val) {
    if (val === null || val === undefined || val === '') return null
    const cleaned = String(val).trim().replace(',', '.')
    const num = Number(cleaned)
    return Number.isFinite(num) ? num : null
  }

  function handleEstimate() {
    const pHeight = parseVal(height)
    const pWeight = parseVal(weight)
    if (!pHeight || !pWeight) {
      setError(vi ? 'Vui lòng nhập chiều cao và cân nặng trước khi ước tính.' : 'Please enter height and weight before estimating.')
      return
    }
    setError('')
    const est = estimateMeasurements(pHeight, pWeight)
    if (est.chest) setChest(est.chest)
    if (est.waist) setWaist(est.waist)
    if (est.hips) setHips(est.hips)
    if (est.shoulder) setShoulder(est.shoulder)
    setMessage(vi ? 'Đã ước tính số đo từ chiều cao & cân nặng. Bạn có thể tinh chỉnh lại cho chuẩn xác.' : 'Estimated from height & weight. You can adjust the numbers.')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setMessage('')
    setError('')

    const pHeight = parseVal(height)
    const pWeight = parseVal(weight)
    const pChest = parseVal(chest)
    const pWaist = parseVal(waist)
    const pHips = parseVal(hips)
    const pShoulder = parseVal(shoulder)

    if (pHeight !== null && (pHeight < 50 || pHeight > 250)) {
      setError(vi ? 'Chiều cao phải từ 50 đến 250 cm.' : 'Height must be between 50 and 250 cm.')
      return
    }
    if (pWeight !== null && (pWeight < 20 || pWeight > 300)) {
      setError(vi ? 'Cân nặng phải từ 20 đến 300 kg.' : 'Weight must be between 20 and 300 kg.')
      return
    }
    if (pChest !== null && (pChest < 40 || pChest > 200)) {
      setError(vi ? 'Vòng ngực phải từ 40 đến 200 cm.' : 'Chest must be between 40 and 200 cm.')
      return
    }
    if (pWaist !== null && (pWaist < 40 || pWaist > 200)) {
      setError(vi ? 'Vòng eo phải từ 40 đến 200 cm.' : 'Waist must be between 40 and 200 cm.')
      return
    }
    if (pHips !== null && (pHips < 40 || pHips > 200)) {
      setError(vi ? 'Vòng hông phải từ 40 đến 200 cm.' : 'Hips must be between 40 and 200 cm.')
      return
    }
    if (pShoulder !== null && (pShoulder < 20 || pShoulder > 100)) {
      setError(vi ? 'Rộng vai phải từ 20 đến 100 cm.' : 'Shoulder must be between 20 and 100 cm.')
      return
    }

    const payload = {
      height: pHeight,
      weight: pWeight,
      chest: pChest,
      waist: pWaist,
      hips: pHips,
      shoulder: pShoulder,
      fit_preference: fitPref,
    }

    try {
      await save(payload)
      setMessage(vi ? 'Đã lưu số đo thành công! Hệ thống sẽ tự động đề xuất size khi bạn xem sản phẩm.' : 'Measurements saved! Sizes will be recommended when viewing products.')
    } catch (err) {
      setError(vi ? `Lỗi khi lưu số đo: ${err.message || 'Vui lòng kiểm tra lại giá trị nhập.'}` : (err.message || 'Error saving measurements.'))
    }
  }

  return (
    <main className="shop-shell">
      <title>{`${vi ? 'Số đo của tôi & Gợi ý size' : 'My Measurements & Size Guide'} – N&B`}</title>
      <div className="mb-6">
        <Link to="/products" className="inline-flex min-h-11 items-center text-body-sm text-link">
          {vi ? '← Tiếp tục mua sắm' : '← Continue shopping'}
        </Link>
      </div>

      <div className="mx-auto max-w-3xl">
        <h1 className="font-display text-title">
          {vi ? 'Hồ sơ số đo cá nhân' : 'Personal Body Profile'}
        </h1>
        <p className="mt-3 text-body text-ink-muted">
          {vi
            ? 'Lưu số đo cơ thể để hệ thống tự động tính toán và gắn nhãn "Đề xuất" trên nút kích cỡ vừa vặn nhất cho bạn ở từng chiếc áo, quần.'
            : 'Save your body measurements so the system can automatically label the best fitting size as "Recommended" for every shirt or pants.'}
        </p>

        {loading ? (
          <div className="mt-10 py-12 text-center text-ink-muted">
            {vi ? 'Đang tải thông tin số đo…' : 'Loading measurements…'}
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate className="mt-8 space-y-8">
            {/* Nhóm chiều cao & cân nặng */}
            <div className="border border-line bg-surface/50 p-6">
              <h2 className="font-display text-title-sm">
                {vi ? '1. Thể trạng cơ bản' : '1. Basic Body Stats'}
              </h2>
              <div className="mt-4 grid gap-6 sm:grid-cols-2">
                <div>
                  <label htmlFor="m-height" className="block text-body-sm font-medium">
                    {vi ? 'Chiều cao (cm)' : 'Height (cm)'}
                  </label>
                  <input
                    id="m-height"
                    type="number"
                    step="any"
                    min="50"
                    max="250"
                    placeholder="vd: 175"
                    value={height}
                    onChange={e => setHeight(e.target.value)}
                    className="mt-2 h-11 w-full border border-line-strong bg-paper px-3 text-body"
                  />
                </div>
                <div>
                  <label htmlFor="m-weight" className="block text-body-sm font-medium">
                    {vi ? 'Cân nặng (kg)' : 'Weight (kg)'}
                  </label>
                  <input
                    id="m-weight"
                    type="number"
                    step="any"
                    min="20"
                    max="300"
                    placeholder="vd: 68"
                    value={weight}
                    onChange={e => setWeight(e.target.value)}
                    className="mt-2 h-11 w-full border border-line-strong bg-paper px-3 text-body"
                  />
                </div>
              </div>
              <div className="mt-4">
                <button
                  type="button"
                  onClick={handleEstimate}
                  className="button min-h-10 text-body-sm"
                >
                  {vi ? '⚡ Ước tính các vòng từ chiều cao & cân nặng' : '⚡ Estimate circumferences from height & weight'}
                </button>
              </div>
            </div>

            {/* Nhóm số đo 3 vòng */}
            <div className="border border-line bg-surface/50 p-6">
              <h2 className="font-display text-title-sm">
                {vi ? '2. Số đo chi tiết cơ thể (cm)' : '2. Detailed Body Measurements (cm)'}
              </h2>
              <p className="mt-1 text-caption text-ink-muted">
                {vi
                  ? 'Đo sát vòng cơ thể bằng thước dây mềm để có kết quả chuẩn xác nhất.'
                  : 'Measure body circumferences snug against the skin with a tape measure.'}
              </p>
              <div className="mt-4 grid gap-6 sm:grid-cols-2">
                <div>
                  <label htmlFor="m-chest" className="block text-body-sm font-medium">
                    {vi ? 'Vòng ngực (cm)' : 'Chest circumference (cm)'}
                  </label>
                  <input
                    id="m-chest"
                    type="number"
                    step="any"
                    min="40"
                    max="200"
                    placeholder="vd: 96"
                    value={chest}
                    onChange={e => setChest(e.target.value)}
                    className="mt-2 h-11 w-full border border-line-strong bg-paper px-3 text-body"
                  />
                  <p className="mt-1 text-micro text-ink-muted">
                    {vi ? 'Đo ngang qua đỉnh ngực' : 'Across the fullest part of the chest'}
                  </p>
                </div>

                <div>
                  <label htmlFor="m-waist" className="block text-body-sm font-medium">
                    {vi ? 'Vòng eo (cm)' : 'Waist circumference (cm)'}
                  </label>
                  <input
                    id="m-waist"
                    type="number"
                    step="any"
                    min="40"
                    max="200"
                    placeholder="vd: 78"
                    value={waist}
                    onChange={e => setWaist(e.target.value)}
                    className="mt-2 h-11 w-full border border-line-strong bg-paper px-3 text-body"
                  />
                  <p className="mt-1 text-micro text-ink-muted">
                    {vi ? 'Đo phần nhỏ nhất của thắt lưng' : 'Around natural narrowest waistline'}
                  </p>
                </div>

                <div>
                  <label htmlFor="m-hips" className="block text-body-sm font-medium">
                    {vi ? 'Vòng hông (cm)' : 'Hips circumference (cm)'}
                  </label>
                  <input
                    id="m-hips"
                    type="number"
                    step="any"
                    min="40"
                    max="200"
                    placeholder="vd: 94"
                    value={hips}
                    onChange={e => setHips(e.target.value)}
                    className="mt-2 h-11 w-full border border-line-strong bg-paper px-3 text-body"
                  />
                  <p className="mt-1 text-micro text-ink-muted">
                    {vi ? 'Đo ngang đỉnh nở nhất của mông' : 'Around fullest part of hips'}
                  </p>
                </div>

                <div>
                  <label htmlFor="m-shoulder" className="block text-body-sm font-medium">
                    {vi ? 'Rộng vai (cm)' : 'Shoulder width (cm)'}
                  </label>
                  <input
                    id="m-shoulder"
                    type="number"
                    step="any"
                    min="20"
                    max="100"
                    placeholder="vd: 44"
                    value={shoulder}
                    onChange={e => setShoulder(e.target.value)}
                    className="mt-2 h-11 w-full border border-line-strong bg-paper px-3 text-body"
                  />
                  <p className="mt-1 text-micro text-ink-muted">
                    {vi ? 'Từ mỏm vai trái sang mỏm vai phải' : 'Across back shoulder tips'}
                  </p>
                </div>
              </div>
            </div>

            {/* Nhóm sở thích mặc */}
            <div className="border border-line bg-surface/50 p-6">
              <h2 className="font-display text-title-sm">
                {vi ? '3. Thói quen mặc yêu thích' : '3. Preferred Fit Style'}
              </h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                {[
                  {
                    id: 'slim',
                    labelVi: 'Ôm gọn (Slim)',
                    labelEn: 'Slim Fit',
                    descVi: 'Tôn dáng, ôm nhẹ vừa người',
                    descEn: 'Form-fitting, sleek look',
                  },
                  {
                    id: 'regular',
                    labelVi: 'Vừa vặn (Regular)',
                    labelEn: 'Regular Fit',
                    descVi: 'Chuẩn dáng thoải mái, dễ chịu',
                    descEn: 'Standard comfortable fit',
                  },
                  {
                    id: 'loose',
                    labelVi: 'Rộng rãi (Loose)',
                    labelEn: 'Relaxed / Oversized',
                    descVi: 'Phóng khoáng, độ rộng thoải mái',
                    descEn: 'Roomy, relaxed streetwear',
                  },
                ].map(item => (
                  <label
                    key={item.id}
                    className={`flex cursor-pointer flex-col border p-4 transition-colors ${
                      fitPref === item.id
                        ? 'border-ink bg-ink text-on-ink'
                        : 'border-line hover:border-ink'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="fit_preference"
                        value={item.id}
                        checked={fitPref === item.id}
                        onChange={() => setFitPref(item.id)}
                        className="accent-ink"
                      />
                      <span className="font-medium text-body-sm">
                        {vi ? item.labelVi : item.labelEn}
                      </span>
                    </div>
                    <span
                      className={`mt-2 text-micro ${
                        fitPref === item.id ? 'text-on-ink/80' : 'text-ink-muted'
                      }`}
                    >
                      {vi ? item.descVi : item.descEn}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {message && (
              <div
                role="status"
                className="border border-ink bg-surface p-4 text-body-sm font-medium text-ink"
              >
                ✓ {message}
              </div>
            )}

            {error && (
              <div role="alert" className="border border-danger p-4 text-body-sm text-danger">
                {error}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-4 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="button button--primary min-h-12 px-8"
              >
                {saving
                  ? (vi ? 'Đang lưu…' : 'Saving…')
                  : (vi ? 'Lưu hồ sơ số đo' : 'Save measurements')}
              </button>
              <Link to="/account/addresses" className="button min-h-12">
                {vi ? 'Quản lý sổ địa chỉ' : 'Manage addresses'}
              </Link>
            </div>
          </form>
        )}
      </div>
    </main>
  )
}
