/** Trạng thái trống: tiêu đề serif, mô tả ngắn, tối đa hai hành động. */
export default function EmptyState({ title, description, children, as: Heading = 'h2' }) {
  return <div className="mx-auto max-w-reading px-(--gutter) py-(--section-y-tight) text-center">
    <Heading className="font-display text-title-sm">{title}</Heading>
    {description && <p className="mt-3 text-body text-ink-muted">{description}</p>}
    {children && <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">{children}</div>}
  </div>
}
