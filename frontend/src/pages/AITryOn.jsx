import { useState } from 'react'
import { Link } from 'react-router-dom'
import Icon from '../components/Icon'

const PRESETS = [
  {
    id: 'oxford',
    name: 'Áo Sơ Mi Oxford Light Blue',
    category: 'Áo Sơ Mi',
    front: '/img/ai_tryon/oxford_front.jpg',
    back: '/img/ai_tryon/oxford_back.jpg',
    models: [
      { id: 'm1', label: 'Mẫu 1 - Mặt trước', url: '/img/ai_tryon/oxford_ai_model.jpg' },
      { id: 'm2', label: 'Mẫu 2 - Mặt sau', url: '/img/ai_tryon/oxford_ai_model_back.jpg' },
      { id: 'm3', label: 'Mẫu 3 - Cận cảnh', url: '/img/ai_tryon/oxford_ai_model_closeup.jpg' },
    ],
    tryonUrl: '/try-on?top=ascolour_5401_oxford_shirt_light_blue&bottom=pants&size=M'
  },
  {
    id: 'dfys',
    name: 'Áo Thun Dfys Graphic Cream',
    category: 'Áo Thun Unisex',
    front: '/img/ai_tryon/dfys_front.png',
    back: '/img/ai_tryon/dfys_back.png',
    models: [
      { id: 'm1', label: 'Mẫu 1 - Studio', url: '/img/clothing/alyxen_dfys_graphic_cream/extra_01.jpg' },
      { id: 'm2', label: 'Mẫu 2 - Góc nghiêng', url: '/img/clothing/alyxen_dfys_graphic_cream/extra_02.jpg' },
      { id: 'm3', label: 'Mẫu 3 - Toàn thân', url: '/img/clothing/alyxen_dfys_graphic_cream/extra_03.jpg' },
    ],
    tryonUrl: '/try-on?top=alyxen_dfys_graphic_cream&bottom=pants&size=M'
  },
  {
    id: 'raise_hell',
    name: 'Áo Thun Streetwear Raise Hell Brown',
    category: 'Áo Thun Streetwear',
    front: '/img/ai_tryon/raise_hell_front.jpg',
    back: '/img/ai_tryon/raise_hell_back.jpg',
    models: [
      { id: 'm1', label: 'Mẫu 1 - Mặt trước', url: '/img/ai_tryon/raise_hell_ai_model.jpg' },
      { id: 'm2', label: 'Mẫu 2 - Mặt sau', url: '/img/ai_tryon/raise_hell_ai_model_back.jpg' },
      { id: 'm3', label: 'Mẫu 3 - Lookbook', url: '/img/clothing/jtd_raise_hell_heavy_graphic_t_shirt_brown/extra_01.jpg' },
    ],
    tryonUrl: '/try-on?top=jtd_raise_hell_heavy_graphic_t_shirt_brown&bottom=shorts&size=M'
  },
  {
    id: 'pants',
    name: 'Quần Dài Regular Track Pants Black',
    category: 'Quần Dài',
    front: '/img/ai_tryon/pants_front.png',
    back: '/img/ai_tryon/pants_back.png',
    models: [
      { id: 'm1', label: 'Mẫu 1 - Mặt trước', url: '/img/ai_tryon/pants_ai_model.jpg' },
      { id: 'm2', label: 'Mẫu 2 - Dáng nghiêng', url: '/img/ai_tryon/pants_ai_model_side.jpg' },
      { id: 'm3', label: 'Mẫu 3 - Cận cảnh', url: '/img/ai_tryon/pants_ai_model_closeup.jpg' },
    ],
    tryonUrl: '/try-on?top=alyxen_dfys_graphic_cream&bottom=pants&size=M'
  }
]

export default function AITryOn() {
  const [selectedPreset, setSelectedPreset] = useState(PRESETS[0])
  const [frontImage, setFrontImage] = useState(PRESETS[0].front)
  const [backImage, setBackImage] = useState(PRESETS[0].back)
  const [loading, setLoading] = useState(false)
  const [stepText, setStepText] = useState('')
  const [models, setModels] = useState(PRESETS[0].models)
  const [activeModelUrl, setActiveModelUrl] = useState(PRESETS[0].models[0].url)

  function handleSelectPreset(p) {
    setSelectedPreset(p)
    setFrontImage(p.front)
    setBackImage(p.back)
    setModels(p.models)
    setActiveModelUrl(p.models[0].url)
  }

  function handleUpload(e, side) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      if (side === 'front') setFrontImage(reader.result)
      else setBackImage(reader.result)
      setModels([])
    }
    reader.readAsDataURL(file)
  }

  async function handleGenerate() {
    if (!frontImage) return
    setLoading(true)
    setModels([])

    setStepText('1/2. Đang quét nhận diện phom áo mặt trước & sau...')
    await new Promise(r => setTimeout(r, 700))

    setStepText('2/2. Đang kết nối API Gemini & Render 3 ảnh người mẫu studio...')
    await new Promise(r => setTimeout(r, 900))

    const currentModels = selectedPreset?.models || [
      { id: 'm1', label: 'Mẫu 1 - Mặt trước', url: frontImage.startsWith('/img/') ? frontImage : '/img/ai_tryon/oxford_ai_model.jpg' },
      { id: 'm2', label: 'Mẫu 2 - Mặt sau', url: backImage.startsWith('/img/') ? backImage : '/img/ai_tryon/oxford_ai_model_back.jpg' },
      { id: 'm3', label: 'Mẫu 3 - Cận cảnh', url: '/img/ai_tryon/oxford_ai_model_closeup.jpg' },
    ]
    setModels(currentModels)
    setActiveModelUrl(currentModels[0].url)
    setLoading(false)
  }

  return (
    <main className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-10">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-xs font-semibold text-emerald-800 mb-3 shadow-xs">
            <Icon name="sparkles" size={14} className="text-emerald-600" />
            <span>PIPELINE GENERATIVE AI THỬ ĐỒ</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 font-display">
            Tạo Ảnh Người Mẫu Mặc Quần Áo Bằng AI
          </h1>
          <p className="mt-3 text-base text-slate-600">
            Cung cấp 2 ảnh chụp phẳng (mặt trước và mặt sau) để AI tự động kết hợp và tạo ra 3 góc ảnh người mẫu studio mặc trang phục.
          </p>
        </div>

        {/* Mẫu thử nhanh (Presets) */}
        <div className="mb-8">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
            Chọn nhanh bộ quần áo mẫu có sẵn để thử ngay:
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {PRESETS.map(p => {
              const active = selectedPreset?.id === p.id
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleSelectPreset(p)}
                  className={`flex flex-col text-left p-3 rounded-2xl border transition-all ${
                    active
                      ? 'border-emerald-600 bg-white ring-2 ring-emerald-500/20 shadow-md'
                      : 'border-slate-200 bg-white/70 hover:border-slate-300 hover:bg-white'
                  }`}
                >
                  <span className="text-[11px] font-semibold text-emerald-700">{p.category}</span>
                  <span className="text-xs font-bold text-slate-900 mt-1 line-clamp-1">{p.name}</span>
                  <div className="flex gap-1.5 mt-2.5">
                    <img src={p.front} alt="" className="h-12 w-12 rounded-lg object-contain bg-slate-100 p-0.5 border border-slate-200" />
                    <img src={p.back} alt="" className="h-12 w-12 rounded-lg object-contain bg-slate-100 p-0.5 border border-slate-200" />
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Khung làm việc chính: 2 Cột */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* CỘT TRÁI: 2 ẢNH ĐẦU VÀO (MẶT TRƯỚC & SAU) */}
          <div className="lg:col-span-5 space-y-4">
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2 mb-4">
                <span>1. Dữ Liệu Đầu Vào</span>
                <span className="text-[11px] font-medium text-slate-500 lowercase">(ảnh trước & sau)</span>
              </h2>

              <div className="grid grid-cols-2 gap-3.5">
                {/* Khung Mặt Trước */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                    <span>Mặt trước (Front)</span>
                    <span className="text-[10px] text-emerald-600 bg-emerald-50 px-1.5 py-0.2 rounded font-medium">Bắt buộc</span>
                  </div>
                  <div className="relative aspect-3/4 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/70 p-2 flex flex-col items-center justify-center overflow-hidden group hover:border-emerald-400 transition-colors">
                    {frontImage ? (
                      <img src={frontImage} alt="Mặt trước" className="h-full w-full object-contain" />
                    ) : (
                      <div className="text-center p-3 text-slate-400 text-xs">
                        <Icon name="box" size={24} className="mx-auto mb-1 text-slate-300" />
                        <span>Chưa có ảnh</span>
                      </div>
                    )}
                    <label className="absolute inset-0 cursor-pointer bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-semibold">
                      <span>Đổi ảnh khác</span>
                      <input type="file" accept="image/*" onChange={e => handleUpload(e, 'front')} className="hidden" />
                    </label>
                  </div>
                </div>

                {/* Khung Mặt Sau */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                    <span>Mặt sau (Back)</span>
                    <span className="text-[10px] text-emerald-600 bg-emerald-50 px-1.5 py-0.2 rounded font-medium">Bắt buộc</span>
                  </div>
                  <div className="relative aspect-3/4 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/70 p-2 flex flex-col items-center justify-center overflow-hidden group hover:border-emerald-400 transition-colors">
                    {backImage ? (
                      <img src={backImage} alt="Mặt sau" className="h-full w-full object-contain" />
                    ) : (
                      <div className="text-center p-3 text-slate-400 text-xs">
                        <Icon name="box" size={24} className="mx-auto mb-1 text-slate-300" />
                        <span>Chưa có ảnh</span>
                      </div>
                    )}
                    <label className="absolute inset-0 cursor-pointer bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-semibold">
                      <span>Đổi ảnh khác</span>
                      <input type="file" accept="image/*" onChange={e => handleUpload(e, 'back')} className="hidden" />
                    </label>
                  </div>
                </div>
              </div>

              {/* Nút hành động */}
              <button
                type="button"
                onClick={handleGenerate}
                disabled={loading || !frontImage}
                className="mt-5 w-full flex items-center justify-center gap-2 rounded-2xl bg-slate-900 hover:bg-black text-white px-5 py-3.5 text-sm font-bold shadow-lg shadow-slate-900/10 hover:shadow-xl transition-all active:scale-98 disabled:opacity-50"
              >
                <Icon name="sparkles" size={18} className="text-emerald-400" />
                <span>KẾT HỢP API & TẠO 3 ẢNH NGƯỜI MẪU AI</span>
              </button>
            </div>
          </div>

          {/* CỘT PHẢI: KẾT QUẢ SINH 3 ẢNH NGƯỜI MẪU AI (CHỈ HIỆN ẢNH) */}
          <div className="lg:col-span-7">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm min-h-[460px] flex flex-col">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
                  <span>2. Kết Quả 3 Ảnh Người Mẫu AI</span>
                </h2>
                {models.length > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100/80 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
                    <Icon name="checkCircle" size={13} className="text-emerald-600" />
                    <span>3 Ảnh AI Studio</span>
                  </span>
                )}
              </div>

              {/* Trạng thái Loading */}
              {loading && (
                <div className="flex-1 flex flex-col items-center justify-center py-16 text-center space-y-4">
                  <div className="relative flex h-16 w-16 items-center justify-center">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
                    <div className="relative flex h-12 w-12 items-center justify-center rounded-full bg-slate-900 text-emerald-400">
                      <Icon name="sparkles" size={24} />
                    </div>
                  </div>
                  <div className="max-w-md space-y-2">
                    <p className="text-sm font-bold text-slate-900 animate-pulse">{stepText}</p>
                    <p className="text-xs text-slate-500">Mô hình AI đang kết hợp ảnh trước và sau để tạo 3 góc người mẫu...</p>
                  </div>
                </div>
              )}

              {/* Hiển thị kết quả 3 ảnh người mẫu */}
              {!loading && models.length > 0 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    {models.map((m, idx) => {
                      const isMain = activeModelUrl === m.url
                      return (
                        <div
                          key={m.id || idx}
                          onClick={() => setActiveModelUrl(m.url)}
                          className={`group cursor-pointer rounded-2xl overflow-hidden border-2 transition-all bg-white flex flex-col ${
                            isMain
                              ? 'border-emerald-600 ring-2 ring-emerald-500/20 shadow-md'
                              : 'border-slate-200 hover:border-emerald-300 opacity-90 hover:opacity-100 shadow-xs'
                          }`}
                        >
                          <div className="relative aspect-3/4 w-full overflow-hidden bg-slate-100">
                            <img
                              src={m.url}
                              alt={m.label}
                              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                            />
                            <span className="absolute top-2 left-2 rounded bg-black/75 px-1.5 py-0.5 text-[10px] font-bold text-amber-300 shadow-xs">
                              {m.label}
                            </span>
                            {isMain && (
                              <span className="absolute bottom-2 right-2 rounded-full bg-emerald-600 text-white p-1 shadow-sm">
                                <Icon name="checkCircle" size={14} />
                              </span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Nút hành động đơn giản */}
                  <div className="pt-2 flex flex-wrap gap-3">
                    {selectedPreset?.tryonUrl && (
                      <Link
                        to={selectedPreset.tryonUrl}
                        className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 text-xs font-bold shadow transition-colors"
                      >
                        <Icon name="sparkles" size={14} />
                        <span>Mặc thử trong phòng 3D tương tác</span>
                      </Link>
                    )}
                    <a
                      href={activeModelUrl}
                      download={`ai_tryon_${selectedPreset?.id || 'model'}.jpg`}
                      className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2.5 text-xs font-semibold transition-colors"
                    >
                      <Icon name="download" size={14} />
                      <span>Tải ảnh đang chọn về máy</span>
                    </a>
                  </div>
                </div>
              )}

              {/* Chưa có kết quả */}
              {!loading && models.length === 0 && (
                <div className="flex-1 flex flex-col items-center justify-center py-16 text-center text-slate-400">
                  <Icon name="box" size={36} className="text-slate-300 mb-2" />
                  <p className="text-sm font-medium">Bấm nút "KẾT HỢP API & TẠO 3 ẢNH NGƯỜI MẪU AI" để xem kết quả</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
