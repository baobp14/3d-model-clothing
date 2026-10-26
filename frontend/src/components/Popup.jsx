import { useEffect, useId, useRef } from 'react'
import { useLang } from '../i18n'

/** Modal dùng <dialog> gốc: nền phía sau tự inert, Esc đóng, trả focus khi đóng. Mobile: neo đáy. */
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
  return <dialog ref={ref} aria-labelledby={titleId} onCancel={e => { e.preventDefault(); if (!busy) close() }}
    className="fixed inset-x-0 bottom-0 top-auto m-0 max-h-[90dvh] w-full max-w-none overflow-y-auto bg-paper p-6 text-ink shadow-(--shadow-overlay) backdrop:bg-ink/40 sm:inset-0 sm:m-auto sm:h-fit sm:w-[calc(100%-2rem)] sm:max-w-xl sm:p-10 open:animate-[fade-up_.3s_var(--ease-soft)]">
    <div className="mb-6 flex items-start justify-between gap-4">
      <h2 id={titleId} className="font-display text-title-sm">{title}</h2>
      <button type="button" disabled={busy} onClick={close} aria-label={lang === 'vi' ? 'Đóng' : 'Close'} className="-mr-3 -mt-2 grid size-11 shrink-0 place-items-center disabled:opacity-40">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
      </button>
    </div>
    {children}
  </dialog>
}
