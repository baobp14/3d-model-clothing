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

            {/* Bộ đếm dùng thử cho khách */}
            {!isMember && (
              <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-medium text-neutral-600 border border-neutral-200">
                {vi ? `Còn ${remainingTries}/${MAX_GUEST_TRIES} lượt thử` : `${remainingTries}/${MAX_GUEST_TRIES} tries left`}
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
              className="text-body-sm font-medium text-ink underline underline-offset-4 hover:text-black"
            >
              {vi ? 'Đăng nhập' : 'Log in'}
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

        {/* Modal thông báo khi hết lượt thử cho khách */}
        {isLocked && (
          <div className="tryon-lock-overlay absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="relative max-w-sm w-full rounded-2xl bg-white p-6 text-ink shadow-xl border border-line text-center">
              <h2 className="font-display text-title-sm">
                {vi ? 'Hết lượt thử đồ' : 'Trial limit reached'}
              </h2>
              <p className="mt-2 text-body-sm text-ink-muted">
                {vi
                  ? `Bạn đã dùng hết ${MAX_GUEST_TRIES} lượt thử đồ. Vui lòng đăng nhập hoặc đăng ký tài khoản để tiếp tục.`
                  : `You have used your ${MAX_GUEST_TRIES} free trial tries. Please log in or sign up to continue.`}
              </p>

              <div className="mt-6 flex flex-col gap-2.5">
                <Link
                  to="/login"
                  state={{ returnTo }}
                  className="button button--primary w-full py-2.5 text-center text-body-sm font-semibold justify-center"
                >
                  {vi ? 'Đăng nhập' : 'Log in'}
                </Link>
                <Link
                  to="/register"
                  state={{ returnTo }}
                  className="button button--secondary w-full py-2.5 text-center text-body-sm font-semibold justify-center"
                >
                  {vi ? 'Đăng ký tài khoản' : 'Sign up'}
                </Link>
                <Link
                  to="/products"
                  className="mt-1 text-caption text-ink-muted underline underline-offset-4 hover:text-ink"
                >
                  {vi ? 'Quay lại cửa hàng' : 'Back to shop'}
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
