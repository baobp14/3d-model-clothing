import { useEffect, useRef } from 'react'

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Panel trượt (menu, bộ lọc, tài khoản).
 * Đóng: `inert` + `aria-hidden` để không phần tử nào bên trong nhận focus (audit H1).
 * Mở: focus vào trong, Tab vòng trong panel, Esc đóng, khóa cuộn nền, trả focus khi đóng
 * (WAI-ARIA APG dialog modal).
 */
export default function Drawer({ id, open, onClose, side = 'left', label, labelledBy, surface = 'bg-paper', width = 'sm:w-105', children }) {
  const panel = useRef(null)
  const close = useRef(onClose)
  close.current = onClose

  useEffect(() => {
    if (!open) return
    const opener = document.activeElement
    const node = panel.current
    const first = node?.querySelector('[data-autofocus]') || node?.querySelector(FOCUSABLE)
    ;(first || node)?.focus({ preventScroll: true })
    const onKey = event => {
      if (event.key === 'Escape') { event.stopPropagation(); close.current?.(); return }
      if (event.key !== 'Tab' || !node) return
      const items = [...node.querySelectorAll(FOCUSABLE)].filter(el => el.offsetParent !== null || el === document.activeElement)
      if (!items.length) { event.preventDefault(); return }
      const firstItem = items[0], lastItem = items[items.length - 1]
      if (event.shiftKey && document.activeElement === firstItem) { event.preventDefault(); lastItem.focus() }
      else if (!event.shiftKey && document.activeElement === lastItem) { event.preventDefault(); firstItem.focus() }
    }
    document.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      if (opener?.isConnected && typeof opener.focus === 'function') opener.focus({ preventScroll: true })
    }
  }, [open])

  const position = side === 'right' ? 'right-0' : 'left-0'
  const hidden = side === 'right' ? 'translate-x-full' : '-translate-x-full'
  return <>
    <div onClick={onClose} aria-hidden="true"
      className={`fixed inset-0 z-(--z-overlay) bg-ink/40 transition-opacity duration-(--duration-slow) ease-soft ${open ? 'opacity-100' : 'pointer-events-none opacity-0'}`} />
    <div ref={panel} id={id} role="dialog" aria-modal={open || undefined} aria-label={labelledBy ? undefined : label} aria-labelledby={labelledBy}
      aria-hidden={!open} inert={!open} tabIndex={-1}
      className={`fixed inset-y-0 ${position} z-(--z-drawer) flex w-full flex-col ${surface} text-ink shadow-(--shadow-overlay) outline-none ${width} ${open ? 'translate-x-0' : `${hidden} invisible`}`}
      // Mở: hiện ngay để focus được; đóng: ẩn sau khi trượt xong
      style={{ transition: open ? 'transform var(--duration-slow) var(--ease-soft)' : 'transform var(--duration-slow) var(--ease-soft), visibility 0s linear var(--duration-slow)' }}>
      {children}
    </div>
  </>
}

/** Đầu drawer: tiêu đề + nút đóng 44px. */
export function DrawerHeader({ id, title, onClose, closeLabel, titleClassName = 'text-title-sm' }) {
  return <div className="flex min-h-16 items-center justify-between gap-4 border-b border-line px-(--gutter) sm:px-8">
    <h2 id={id} className={`font-display ${titleClassName}`}>{title}</h2>
    <button type="button" onClick={onClose} aria-label={closeLabel} className="-mr-3 grid size-11 place-items-center">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
    </button>
  </div>
}
