import { authError } from './PasswordResetRequest'
import { useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useLang } from '../../i18n'

/** Logo Google giữ đúng 4 màu gốc — đây là yêu cầu trong brand guideline của họ. */
const GoogleMark = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#4285F4" d="M45.1 24.5c0-1.6-.1-3.2-.4-4.7H24v8.9h11.8c-.5 2.8-2 5.1-4.4 6.7v5.5h7.1c4.2-3.8 6.6-9.5 6.6-16.4Z" />
    <path fill="#34A853" d="M24 46c6 0 11-2 14.6-5.4l-7.1-5.5c-2 1.3-4.5 2.1-7.5 2.1-5.8 0-10.6-3.9-12.4-9.1H4.3v5.7C7.9 41.1 15.4 46 24 46Z" />
    <path fill="#FBBC05" d="M11.6 28.1c-.5-1.3-.7-2.7-.7-4.1s.3-2.8.7-4.1V14H4.3A22 22 0 0 0 2 24c0 3.5.8 6.9 2.3 9.9l7.3-5.8Z" />
    <path fill="#EA4335" d="M24 10.8c3.3 0 6.2 1.1 8.5 3.3l6.3-6.3C35 4.2 30 2 24 2 15.4 2 7.9 6.9 4.3 14l7.3 5.8c1.8-5.2 6.6-9 12.4-9Z" />
  </svg>
)

export default function GoogleButton() {
  const { t } = useLang()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const active = useRef(false)

  const signIn = async () => {
    // Chưa cấu hình Supabase hoặc chưa bật provider thì báo rõ, đừng để nút
    // bấm vào không phản ứng gì.
    if (active.current) return
    if (!supabase) return setError(t('auth.googleOff'))
    active.current = true
    setBusy(true)
    try {
    setError('')
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/login` },
    })
    if (err) setError(authError(t, err.message))
    } catch { setError(t('auth.networkError')) }
    finally { active.current = false; setBusy(false) }
    // Thành công thì trình duyệt tự chuyển sang trang Google, không cần làm gì thêm.
  }

  return <>
    <button type="button" onClick={signIn} disabled={busy}
      className="button w-full gap-3">
      <GoogleMark />{t('auth.google')}
    </button>
    {error && <p role="alert" className="mt-3 text-[14px] text-danger">{error}</p>}
  </>
}
