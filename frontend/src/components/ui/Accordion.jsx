/** Mục mở/đóng dùng <details>, bàn phím hoạt động sẵn. */
export function AccordionItem({ title, defaultOpen = false, children }) {
  return <details className="group border-b border-line" open={defaultOpen || undefined}>
    <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-4 text-body-sm font-medium [&::-webkit-details-marker]:hidden">
      {title}
      <span aria-hidden="true" className="relative size-3 shrink-0 before:absolute before:inset-x-0 before:top-1/2 before:h-px before:bg-current after:absolute after:inset-y-0 after:left-1/2 after:w-px after:bg-current group-open:after:hidden" />
    </summary>
    <div className="pb-6 text-body-sm leading-relaxed text-ink">{children}</div>
  </details>
}
