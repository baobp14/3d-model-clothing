import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import GarmentTestApp from '@/components/garment-test/GarmentTestApp'
import { registerSavedCharts } from '@/lib/tryon/brandSizes'
import { shopApi } from '../lib/api'
import { useAuth } from '../hooks/useAuth'
import { useLang } from '../i18n'

const MAX_GUEST_TRIES = 3
const STORAGE_KEY = 'nb_guest_tryon_count'

export default function TryOn() {
  const { lang } = useLang()
  const vi = lang === 'vi'
  const { user } = useAuth()
  const location = useLocation()
  const [chartsReady, setChartsReady] = useState(false)
  const lastInteractionRef = useRef(0)

  // Đọc số lượt dùng thử của khách vãng lai từ localStorage
  const [guestTries, setGuestTries] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      return stored ? parseInt(stored, 10) : 0
    } catch {
      return 0
    }
  })

  // Khách vãng lai khi vào trang lần đầu với mẫu áo/quần cũng tính 1 lượt trải nghiệm
  useEffect(() => {
    if (!user) {
      setGuestTries(prev => {
        if (prev === 0) {
          try { localStorage.setItem(STORAGE_KEY, '1') } catch {}
          return 1
        }
        return prev
      })
    }
  }, [user])

  // Tải bảng size từ API
  useEffect(() => {
    let live = true
    shopApi.request('/size-charts')
      .then(data => registerSavedCharts(data.charts || []))
      .catch(() => registerSavedCharts([]))
      .finally(() => { if (live) setChartsReady(true) })
    return () => { live = false }
  }, [])

  // Bắt sự kiện đổi đồ, đổi mẫu của khách vãng lai để trừ lượt
  function handleTryInteraction(e) {
    if (user) return // Thành viên đã đăng nhập -> Không giới hạn
    if (guestTries >= MAX_GUEST_TRIES) return // Đã hết lượt

    const interactiveTarget = e.target.closest('button, select, [role="button"], input[type="radio"]')
    if (!interactiveTarget) return
    // Bỏ qua các nút điều hướng hoặc trong modal khóa
    if (interactiveTarget.closest('a') || interactiveTarget.closest('.tryon-lock-overlay')) return

    const now = Date.now()
    // Throttle tối thiểu 4 giây giữa các lần đổi đồ để tránh đếm trùng click chuột nhanh
    if (now - lastInteractionRef.current < 4000) return
    lastInteractionRef.current = now

    setGuestTries(prev => {
      const next = prev + 1
      try { localStorage.setItem(STORAGE_KEY, String(next)) } catch {}
      return next
    })
  }

  // Thành viên đăng nhập = Không giới hạn. Khách vãng lai = Tối đa MAX_GUEST_TRIES lượt
  const isMember = !!user
  const remainingTries = isMember ? 999 : Math.max(0, MAX_GUEST_TRIES - guestTries)
  const isLocked = !isMember && remainingTries <= 0

  const returnTo = location.pathname + location.search

  return (
    <main className="tryon-embed relative">
      <title>{(vi ? 'Phòng thử đồ 3D' : '3D fitting room') + ' – N&B'}</title>

      {/* Header thanh điều hướng & Bộ đếm lượt thử */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-paper px-(--gutter) py-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-display text-title-sm">{vi ? 'Phòng thử đồ 3D' : '3D fitting room'}</h1>

            {/* Huy hiệu thành viên hoặc Bộ đếm dùng thử */}
            {isMember ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-0.5 text-xs font-semibold text-emerald-800 border border-emerald-200">
                <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                {vi ? '✨ Thành viên N&B (VIP) · Không giới hạn' : '✨ N&B VIP Member · Unlimited'}
              </span>
            ) : (
              <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-0.5 text-xs font-semibold border ${
                remainingTries > 1
                  ? 'bg-amber-50 text-amber-800 border-amber-200'
                  : 'bg-red-50 text-red-800 border-red-200'
              }`}>
                <span className={`size-2 rounded-full ${remainingTries > 1 ? 'bg-amber-500' : 'bg-red-500'}`} />
                {vi
                  ? `🎟️ Dùng thử: Còn ${remainingTries}/${MAX_GUEST_TRIES} lượt`
                  : `🎟️ Trial: ${remainingTries}/${MAX_GUEST_TRIES} tries left`}
              </span>
            )}
          </div>
          <p className="mt-1 text-body-sm text-ink-muted">
            {vi
              ? 'Chọn người mẫu theo số đo, đổi trang phục, xoay 360 độ để ngắm phom dáng.'
              : 'Pick a body by measurements, switch outfits and rotate 360° to check the fit.'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {!isMember && (
            <Link
              to="/login"
              state={{ returnTo }}
              className="text-body-sm font-semibold text-ink underline underline-offset-4 hover:text-black"
            >
              {vi ? 'Đăng nhập mở khóa vô hạn' : 'Log in for unlimited'}
            </Link>
          )}
          <Link to="/products" className="button button--sm">
            {vi ? 'Tiếp tục mua sắm' : 'Continue shopping'}
          </Link>
        </div>
      </div>

      {/* Vùng canvas 3D với bộ lắng nghe tương tác đổi đồ */}
      <div className="relative" onClickCapture={handleTryInteraction}>
        {chartsReady ? (
          <GarmentTestApp />
        ) : (
          <p className="p-6 text-body-sm text-ink-muted">
            {vi ? 'Đang tải bảng size…' : 'Loading size charts…'}
          </p>
        )}

        {/* Modal Khóa khi Hết lượt dùng thử dành cho Khách Vãng Lai */}
        {isLocked && (
          <div className="tryon-lock-overlay absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
            <div className="relative max-w-lg w-full rounded-3xl bg-white p-7 sm:p-9 text-ink shadow-2xl border border-line">
              <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 text-3xl">
                🔒
              </div>

              <div className="mt-5 text-center">
                <span className="inline-block rounded-full bg-amber-100 px-3 py-1 text-micro font-bold uppercase tracking-wider text-amber-800">
                  {vi ? 'Đã hết lượt dùng thử miễn phí' : 'Guest trial completed'}
                </span>
                <h2 className="mt-3 font-display text-title leading-snug">
                  {vi ? 'Đăng Nhập Để Thử Đồ 3D Không Giới Hạn' : 'Log In for Unlimited 3D Try-On'}
                </h2>
                <p className="mt-3 text-body-sm text-ink-muted leading-relaxed">
                  {vi
                    ? `Bạn đã sử dụng hết ${MAX_GUEST_TRIES}/${MAX_GUEST_TRIES} lượt thử đồ trải nghiệm dành cho khách vãng lai. Hãy tạo tài khoản thành viên N&B (hoàn toàn miễn phí chỉ mất 5 giây) để tiếp tục!`
                    : `You have enjoyed all ${MAX_GUEST_TRIES} guest trial sessions. Create a complimentary N&B account to unlock full benefits!`}
                </p>
              </div>

              {/* Danh sách đặc quyền thành viên */}
              <div className="mt-6 rounded-2xl bg-paper p-4 border border-line/60 space-y-2.5 text-body-sm">
                <div className="flex items-center gap-2.5 text-ink">
                  <span className="text-emerald-600 font-bold">✓</span>
                  <span>{vi ? 'Thử đồ 3D không giới hạn số lần & mẫu áo quần' : 'Unlimited 3D try-on for all styles'}</span>
                </div>
                <div className="flex items-center gap-2.5 text-ink">
                  <span className="text-emerald-600 font-bold">✓</span>
                  <span>{vi ? 'Tặng ngay Voucher 50.000đ cho đơn hàng đầu tiên' : '50,000₫ Welcome voucher for your first order'}</span>
                </div>
                <div className="flex items-center gap-2.5 text-ink">
                  <span className="text-emerald-600 font-bold">✓</span>
                  <span>{vi ? 'Lưu vĩnh viễn hồ sơ số đo & vóc dáng cá nhân' : 'Save your personal body profile forever'}</span>
                </div>
              </div>

              {/* Nút hành động */}
              <div className="mt-7 flex flex-col gap-3">
                <Link
                  to="/register"
                  state={{ returnTo }}
                  className="button button--primary w-full py-3 text-center text-body font-semibold justify-center shadow-md"
                >
                  {vi ? 'Đăng ký tài khoản (Miễn phí 100%)' : 'Create Free Account'}
                </Link>
                <Link
                  to="/login"
                  state={{ returnTo }}
                  className="button button--secondary w-full py-3 text-center text-body font-semibold justify-center"
                >
                  {vi ? 'Đã có tài khoản? Đăng nhập ngay' : 'Already a member? Log in'}
                </Link>
                <div className="mt-2 text-center">
                  <Link to="/products" className="text-caption text-ink-muted underline underline-offset-4 hover:text-ink">
                    {vi ? 'Quay lại cửa hàng xem danh mục sản phẩm' : 'Back to shop catalog'}
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
