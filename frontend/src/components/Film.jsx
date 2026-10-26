import { useEffect, useRef, useState } from 'react'
import Icon from './Icon'
import { useLang } from '../i18n'

/**
 * Video nền tắt tiếng. Chỉ tự phát khi người dùng không bật "giảm chuyển động".
 * controls=false: không hiện nút dừng/phát (theo yêu cầu cho hero — lưu ý không đạt WCAG 2.2.2).
 */
export default function Film({ src, label, controls = true, buttonClassName = 'bottom-3 right-3' }) {
  const { lang } = useLang()
  const video = useRef(null)
  const [playing, setPlaying] = useState(false)
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    video.current?.play().then(() => setPlaying(true)).catch(() => {})
  }, [])
  const toggle = () => {
    const v = video.current
    if (!v) return
    if (v.paused) v.play().then(() => setPlaying(true)).catch(() => {}); else { v.pause(); setPlaying(false) }
  }
  return <>
    <video ref={video} src={src} muted loop playsInline preload="metadata" aria-label={label} className="absolute inset-0 h-full w-full object-cover" />
    {controls && <button type="button" onClick={toggle} aria-label={playing ? (lang === 'vi' ? 'Tạm dừng video' : 'Pause video') : (lang === 'vi' ? 'Phát video' : 'Play video')}
      className={`absolute z-10 grid size-11 place-items-center bg-ink/60 text-on-ink ${buttonClassName}`}>
      {playing ? <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 4h4v16H6zM14 4h4v16h-4z" /></svg> : <Icon name="play" size={14} />}
    </button>}
  </>
}
