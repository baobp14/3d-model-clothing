import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import Icon from './Icon'
import { useAuth } from '../hooks/useAuth'
import { useCart } from '../hooks/useCart'
import { formatVnd } from '../lib/format'
import { shopApi } from '../lib/api'
import { canShop, loginPath } from '../lib/customerSession'

const QUICK_PROMPTS = [
  { label: '👔 Set công sở lịch sự', prompt: 'Gợi ý cho mình set đồ đi làm công sở thanh lịch, lịch sự và chuyên nghiệp.' },
  { label: '☕ Dạo phố cuối tuần', prompt: 'Gợi ý cho mình combo trẻ trung, thoải mái để đi cà phê dạo phố cuối tuần.' },
  { label: '🖤 Phong cách Minimalist', prompt: 'Mình thích phong cách tối giản (Minimalist), phối giúp mình một combo tinh tế nhé.' },
  { label: '📏 Chọn size theo số đo', prompt: 'Dựa vào chiều cao cân nặng của mình, bạn hãy tư vấn size và gợi ý combo phù hợp nhất.' },
]

export default function AIStylistChat() {
  const [open, setOpen] = useState(false)
  const [catalog, setCatalog] = useState([])
  const [toast, setToast] = useState(null)
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: 'Xin chào! Mình là **N&B AI Stylist** 🌟. Mình có thể phân tích số đo, tư vấn phối đồ và gợi ý **Combo trang phục hoàn chỉnh (Áo + Quần/Váy)** để bạn thêm ngay vào giỏ hàng hoặc mua ngay chỉ với 1 chạm.\n\nBạn đang tìm combo cho dịp nào hôm nay?',
      outfits: [],
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [unread, setUnread] = useState(false)
  const [measurements, setMeasurements] = useState(null)
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)
  const { user } = useAuth()
  const { add } = useCart()
  const location = useLocation()
  const navigate = useNavigate()

  // Tải danh mục sản phẩm từ catalog để ánh xạ thành combo thương mại
  useEffect(() => {
    shopApi.request('/catalog')
      .then(data => setCatalog(data.products || []))
      .catch(() => {})
  }, [])

  // Đọc số đo lưu trong máy người dùng nếu có
  useEffect(() => {
    try {
      const raw = localStorage.getItem('nb_measurements')
      if (raw) {
        const m = JSON.parse(raw)
        if (m && (m.height || m.weight)) {
          setMeasurements(m)
        }
      }
    } catch {}
  }, [user, open])

  // Tự động cuộn xuống tin nhắn mới nhất
  useEffect(() => {
    if (open) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
      setUnread(false)
      setTimeout(() => inputRef.current?.focus(), 150)
    }
  }, [open, messages, loading])

  // Tìm sản phẩm thật trong catalog khớp với mã gợi ý của AI
  function findProduct(key, defaultCat) {
    if (!catalog || !catalog.length) return null
    const k = String(key || '').toLowerCase()
    // Khớp mã ID hoặc đường dẫn ảnh
    for (const p of catalog) {
      if (String(p.id) === k || p.images?.some(img => img.toLowerCase().includes(k))) {
        return p
      }
    }
    // Khớp từ khóa thông minh
    for (const p of catalog) {
      const cat = p.category || ''
      const name = (p.name_vi || '').toLowerCase()
      if (k.includes('oxford') && cat.includes('shirt')) return p
      if (k.includes('short') && name.includes('short')) return p
      if (k.includes('skirt') && cat.includes('skirt')) return p
      if (k.includes('pant') && cat.includes('trouser') && !name.includes('short')) return p
      if (k.includes('dfys') && name.includes('dfys')) return p
      if (k.includes('sunny') && name.includes('sunny')) return p
      if (k.includes('tidebreaker') && name.includes('tidebreaker')) return p
      if (k.includes('blind') && name.includes('blind')) return p
    }
    // Fallback theo danh mục
    for (const p of catalog) {
      if (p.category === defaultCat) return p
    }
    return catalog[0] || null
  }

  async function handleSend(textToSend) {
    const text = (textToSend || input).trim()
    if (!text || loading) return

    const newMsg = { role: 'user', content: text }
    const updatedHistory = [...messages, newMsg]
    setMessages(updatedHistory)
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/chat/stylist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          history: updatedHistory.slice(-6).map(m => ({ role: m.role, content: m.content })),
          measurements: measurements || undefined,
        }),
      })

      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()

      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: data.reply || 'Cảm ơn bạn! N&B Stylist đã ghi nhận.',
          outfits: data.outfits || [],
        },
      ])
      if (!open) setUnread(true)
    } catch (err) {
      console.error('[AI Stylist] Error:', err)
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: 'Rất tiếc, đường truyền AI Stylist đang chập chờn. Bạn vui lòng thử bấm lại hoặc chọn các gợi ý bên dưới nhé!',
          outfits: [],
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  // Thêm Combo 2 món vào giỏ hàng hoặc mua ngay
  function handleAddComboToCart(outfit, buyNow = false) {
    if (!canShop(user)) {
      setOpen(false)
      navigate(loginPath(location.pathname + location.search), {
        state: { returnTo: location.pathname + location.search },
      })
      return
    }

    const topProd = findProduct(outfit.top, 'm-tshirts')
    const bottomProd = findProduct(outfit.bottom, 'm-trousers')
    const size = outfit.size || 'M'

    let addedCount = 0
    if (topProd) {
      const ok1 = add(topProd, topProd.colors?.[0] || 'Trắng', size, 1, {
        combo: true,
        comboTitle: outfit.label || 'Combo AI Stylist',
      })
      if (ok1) addedCount++
    }
    if (bottomProd) {
      const ok2 = add(bottomProd, bottomProd.colors?.[0] || 'Đen', size, 1, {
        combo: true,
        comboTitle: outfit.label || 'Combo AI Stylist',
      })
      if (ok2) addedCount++
    }

    if (addedCount > 0) {
      if (buyNow) {
        setOpen(false)
        navigate('/checkout')
      } else {
        setToast(`✓ Đã thêm Combo (${addedCount} món, Size ${size}) vào giỏ hàng!`)
        setTimeout(() => setToast(null), 4000)
      }
    }
  }

  function formatText(content) {
    const lines = content.split('\n')
    return lines.map((line, idx) => {
      // Bỏ qua dòng link thô vì đã hiển thị thẻ Combo Card chuyên biệt bên dưới
      if (line.includes('](/try-on?') || line.trim().startsWith('/try-on?')) {
        return null
      }

      const parts = line.split(/(\*\*[^*]+\*\*)/g).map((part, pIdx) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={pIdx} className="font-semibold text-ink">{part.slice(2, -2)}</strong>
        }
        return part
      })

      if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
        return (
          <li key={idx} className="ml-4 list-disc text-body-xs leading-relaxed text-ink/90 my-1">
            {parts}
          </li>
        )
      }

      return (
        <p key={idx} className={`text-body-xs leading-relaxed ${line.trim() ? 'my-1' : 'h-2'}`}>
          {parts}
        </p>
      )
    })
  }

  return (
    <>
      {/* Nút bấm nổi (Floating Action Button) */}
      <div className="fixed bottom-6 right-6 z-40">
        <button
          type="button"
          onClick={() => setOpen(prev => !prev)}
          className={`group relative flex items-center gap-2.5 rounded-full px-4 py-3 shadow-xl transition-all duration-300 ${
            open
              ? 'bg-ink text-paper hover:bg-black'
              : 'bg-gradient-to-r from-ink via-slate-800 to-emerald-900 text-paper ring-4 ring-emerald-500/20 hover:scale-105 hover:shadow-2xl'
          }`}
          aria-label="Mở N&B AI Stylist"
        >
          {open ? (
            <Icon name="close" size={20} />
          ) : (
            <>
              <div className="relative flex items-center justify-center">
                <Icon name="sparkles" size={20} className="text-emerald-400 group-hover:rotate-12 transition-transform duration-300" />
                <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                </span>
              </div>
              <span className="font-medium text-body-sm tracking-wide">
                AI Stylist <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-300 bg-emerald-950/80 px-1.5 py-0.5 rounded-full border border-emerald-500/30">Combo</span>
              </span>
            </>
          )}

          {unread && !open && (
            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow">
              1
            </span>
          )}
        </button>
      </div>

      {/* Cửa sổ chat AI Stylist */}
      {open && (
        <div className="fixed bottom-24 right-4 sm:right-6 z-50 flex w-[calc(100vw-2rem)] sm:w-[420px] h-[600px] max-h-[85vh] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl border border-line animate-in fade-in zoom-in-95 duration-200">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 bg-gradient-to-r from-ink via-slate-900 to-emerald-950 px-4 py-3.5 text-paper">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/40">
                <Icon name="sparkles" size={18} />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="font-semibold text-body-sm leading-tight text-white">N&B AI Stylist</h3>
                  <span className="rounded bg-emerald-500/20 px-1.5 py-0.2 text-[10px] font-medium text-emerald-300 ring-1 ring-emerald-500/30">
                    Gemini 2.5
                  </span>
                </div>
                <p className="text-[11px] text-paper-muted leading-none mt-0.5">
                  Tư vấn phối đồ & Gợi ý Combo mua sắm thông minh
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  setMessages([
                    {
                      role: 'assistant',
                      content: 'Cuộc trò chuyện đã được làm mới. Bạn cần mình tư vấn combo trang phục theo dịp nào tiếp theo nhé!',
                      outfits: [],
                    },
                  ])
                }}
                className="rounded-lg p-1.5 text-paper-muted hover:bg-white/10 hover:text-white transition-colors"
                title="Làm mới cuộc trò chuyện"
                aria-label="Làm mới"
              >
                <Icon name="refresh" size={16} />
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg p-1.5 text-paper-muted hover:bg-white/10 hover:text-white transition-colors"
                aria-label="Đóng"
              >
                <Icon name="close" size={18} />
              </button>
            </div>
          </div>

          {/* Banner thông tin số đo */}
          <div className="border-b border-line bg-surface/60 px-4 py-2 text-[11px] text-ink-muted flex items-center justify-between">
            {measurements ? (
              <div className="flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                <span>
                  Đã kết nối số đo: <strong className="text-ink">{measurements.height}cm</strong> · <strong className="text-ink">{measurements.weight}kg</strong>
                  {measurements.gender === 'female' ? ' (Nữ)' : ' (Nam)'}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <span className="text-ink-muted">💡 Chưa có số đo:</span>
                <Link
                  to="/account/measurements"
                  onClick={() => setOpen(false)}
                  className="font-medium text-emerald-700 underline underline-offset-2 hover:text-emerald-800"
                >
                  Nhập số đo để chuẩn size
                </Link>
              </div>
            )}
            <Link
              to="/cart"
              onClick={() => setOpen(false)}
              className="font-medium text-emerald-700 hover:text-emerald-800 transition-colors flex items-center gap-1"
            >
              <span>Xem giỏ hàng</span> →
            </Link>
          </div>

          {/* Toast thông báo trong khung chat */}
          {toast && (
            <div className="bg-emerald-600 text-white text-xs py-2 px-4 flex items-center justify-between animate-in fade-in slide-in-from-top-1">
              <span>{toast}</span>
              <Link
                to="/cart"
                onClick={() => setOpen(false)}
                className="underline underline-offset-2 font-semibold hover:text-emerald-100 ml-2"
              >
                Mở giỏ
              </Link>
            </div>
          )}

          {/* Vùng tin nhắn */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-paper/40">
            {messages.map((msg, idx) => {
              const isAssistant = msg.role === 'assistant'
              return (
                <div
                  key={idx}
                  className={`flex flex-col ${isAssistant ? 'items-start' : 'items-end'}`}
                >
                  <div
                    className={`max-w-[90%] rounded-2xl px-3.5 py-2.5 text-body-xs shadow-sm ${
                      isAssistant
                        ? 'bg-white text-ink border border-line rounded-tl-sm'
                        : 'bg-ink text-white rounded-tr-sm'
                    }`}
                  >
                    {isAssistant ? (
                      <div className="space-y-1">{formatText(msg.content)}</div>
                    ) : (
                      <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                    )}
                  </div>

                  {/* THẺ COMBO MUA SẮM THƯƠNG MẠI (COMMERCIAL COMBO CARD) */}
                  {isAssistant && msg.outfits && msg.outfits.length > 0 && (
                    <div className="mt-2.5 w-full max-w-[94%] space-y-3">
                      {msg.outfits.map((of, ofIdx) => {
                        const topProd = findProduct(of.top, 'm-tshirts')
                        const bottomProd = findProduct(of.bottom, 'm-trousers')
                        const comboPrice = (topProd?.price || 199000) + (bottomProd?.price || 299000)
                        const size = of.size || 'M'

                        return (
                          <div
                            key={ofIdx}
                            className="rounded-2xl border border-line bg-white p-3.5 shadow-md overflow-hidden"
                          >
                            {/* Header Thẻ Combo */}
                            <div className="flex items-center justify-between pb-2 border-b border-line">
                              <div className="flex items-center gap-1.5 text-emerald-800 font-semibold text-[11px] uppercase tracking-wider">
                                <Icon name="tag" size={13} className="text-emerald-600" />
                                <span>Combo Đề Xuất Cho Bạn</span>
                              </div>
                              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700 border border-emerald-200">
                                Size: {size}
                              </span>
                            </div>

                            {/* Danh sách 2 món trong Combo kèm hình ảnh thật */}
                            <div className="mt-2.5 space-y-2">
                              {/* Món 1: Áo */}
                              {topProd && (
                                <div className="flex items-center gap-2.5 rounded-xl bg-surface/50 p-2 border border-line/60">
                                  <img
                                    src={topProd.images?.[0] || '/img/intro.mp4'}
                                    alt={topProd.name_vi}
                                    className="h-12 w-12 rounded-lg object-cover bg-white border border-line"
                                  />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium text-ink truncate leading-tight">
                                      {topProd.name_vi}
                                    </p>
                                    <p className="text-[11px] text-emerald-700 font-semibold mt-0.5">
                                      {formatVnd(topProd.price)}
                                    </p>
                                  </div>
                                </div>
                              )}

                              {/* Món 2: Quần/Váy */}
                              {bottomProd && (
                                <div className="flex items-center gap-2.5 rounded-xl bg-surface/50 p-2 border border-line/60">
                                  <img
                                    src={bottomProd.images?.[0] || '/img/intro.mp4'}
                                    alt={bottomProd.name_vi}
                                    className="h-12 w-12 rounded-lg object-cover bg-white border border-line"
                                  />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium text-ink truncate leading-tight">
                                      {bottomProd.name_vi}
                                    </p>
                                    <p className="text-[11px] text-emerald-700 font-semibold mt-0.5">
                                      {formatVnd(bottomProd.price)}
                                    </p>
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Tổng tiền Combo */}
                            <div className="mt-3 flex items-center justify-between border-t border-line/60 pt-2 text-xs">
                              <span className="text-ink-muted">Tổng Combo (2 món):</span>
                              <span className="font-bold text-ink text-sm">
                                {formatVnd(comboPrice)}
                              </span>
                            </div>

                            {/* 2 Nút Hành Động Thương Mại */}
                            <div className="mt-3 grid grid-cols-2 gap-2">
                              <button
                                type="button"
                                onClick={() => handleAddComboToCart(of, false)}
                                className="flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2.5 text-center text-[12px] font-semibold text-white shadow hover:bg-emerald-700 active:scale-98 transition-all"
                              >
                                <Icon name="bag" size={14} />
                                <span>Thêm vào giỏ</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleAddComboToCart(of, true)}
                                className="flex items-center justify-center gap-1.5 rounded-xl bg-ink px-3 py-2.5 text-center text-[12px] font-semibold text-white shadow hover:bg-black active:scale-98 transition-all"
                              >
                                <span>⚡ Mua ngay</span>
                              </button>
                            </div>

                            {/* Huy hiệu cam kết chất lượng */}
                            <div className="mt-2.5 flex items-center justify-center gap-1.5 text-[11px] text-ink-muted">
                              <Icon name="checkCircle" size={13} className="text-emerald-600" />
                              <span>Cam kết chuẩn phom dáng theo số đo · Đổi trả 7 ngày</span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}

            {/* Hiệu ứng đang gõ */}
            {loading && (
              <div className="flex items-center gap-2 text-ink-muted bg-white border border-line rounded-2xl rounded-tl-sm px-4 py-2.5 w-fit shadow-sm">
                <span className="text-[11px] text-ink-muted font-medium">Stylist đang phối combo</span>
                <span className="flex gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-bounce [animation-delay:-0.3s]" />
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-bounce [animation-delay:-0.15s]" />
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-bounce" />
                </span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Gợi ý câu hỏi nhanh (Quick Chips) */}
          <div className="border-t border-line/60 bg-surface/40 px-3 py-2 overflow-x-auto scrollbar-none flex gap-1.5">
            {QUICK_PROMPTS.map((q, i) => (
              <button
                key={i}
                type="button"
                disabled={loading}
                onClick={() => handleSend(q.prompt)}
                className="shrink-0 rounded-full border border-line bg-white px-2.5 py-1 text-[11px] font-medium text-ink hover:border-emerald-500 hover:text-emerald-700 hover:bg-emerald-50/50 disabled:opacity-50 transition-colors"
              >
                {q.label}
              </button>
            ))}
          </div>

          {/* Ô nhập tin nhắn */}
          <form
            onSubmit={e => {
              e.preventDefault()
              handleSend()
            }}
            className="border-t border-line bg-white p-2.5 flex items-center gap-2"
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Hỏi: 'Phối combo đi làm', 'Cao 1m72 nặng 55kg'..."
              disabled={loading}
              className="flex-1 rounded-xl border border-line bg-paper px-3 py-2 text-body-xs text-ink placeholder:text-ink-muted focus:border-ink focus:outline-none focus:ring-1 focus:ring-ink"
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-ink text-paper transition-all hover:bg-black disabled:opacity-30 disabled:hover:bg-ink"
              aria-label="Gửi"
            >
              <Icon name="arrowRight" size={16} />
            </button>
          </form>
        </div>
      )}
    </>
  )
}
