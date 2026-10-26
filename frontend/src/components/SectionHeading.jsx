/** Eyebrow + tiêu đề serif + mô tả. Căn giữa cho trang trưng bày, căn trái cho trang làm việc. */
export default function SectionHeading({ id, eyebrow, title, description, align = 'center', as: Heading = 'h2', action, tone = 'text-ink-muted' }) {
  const centered = align === 'center'
  const layout = centered ? 'flex flex-col items-center text-center' : 'flex flex-wrap items-end justify-between gap-4'
  return <div className={`mb-(--stack-heading) ${layout}`}>
    <div className={centered ? 'max-w-reading' : ''}>
      {eyebrow && <p className={`eyebrow ${tone}`}>{eyebrow}</p>}
      <Heading id={id} className={`font-display text-title-sm ${eyebrow ? 'mt-3' : ''}`}>{title}</Heading>
      {description && <p className={`mt-3 text-body ${tone}`}>{description}</p>}
    </div>
    {action && <div className={centered ? 'mt-5' : ''}>{action}</div>}
  </div>
}
