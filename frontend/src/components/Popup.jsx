import { useEffect, useId, useRef } from 'react'
import { useLang } from '../i18n'

export default function Popup({ title, close, busy = false, children }) {
  const ref = useRef(null)
  const titleId = useId()
  const { lang } = useLang()
  useEffect(() => {
    const dialog = ref.current
    const focus = document.activeElement
    const overflow = document.body.style.overflow
    dialog.showModal()
    document.body.style.overflow = 'hidden'
    return () => { dialog.close(); document.body.style.overflow = overflow; if (focus?.isConnected) focus.focus() }
  }, [])
  return <dialog ref={ref} aria-labelledby={titleId} onCancel={e => { e.preventDefault(); if (!busy) close() }} className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-xl overflow-y-auto border border-feather bg-white p-6 text-obsidian backdrop:bg-black/50 sm:p-8">
    <div className="mb-6 flex items-start justify-between gap-4"><h2 id={titleId} className="font-display text-xl uppercase">{title}</h2><button type="button" disabled={busy} onClick={close} aria-label={lang === 'vi' ? 'Đóng' : 'Close'} className="px-2 text-2xl leading-none disabled:opacity-50">×</button></div>{children}
  </dialog>
}
