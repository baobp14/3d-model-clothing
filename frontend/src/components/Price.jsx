import { useLang } from '../i18n'
import { formatVnd } from '../lib/format'

/** Giá VND; khi có giá gốc thì gạch ngang giá gốc và đọc rõ cho trình đọc màn hình (SHOP-A11Y). */
export default function Price({ value, compareAt, className = '' }) {
  const { t } = useLang()
  if (!compareAt || compareAt <= value) return <span className={`tabular-nums ${className}`}>{formatVnd(value)}</span>
  return <span className={`tabular-nums ${className}`}>
    <span className="sr-only">{t('price.original')} </span><s className="text-ink-muted">{formatVnd(compareAt)}</s>{' '}
    <span className="sr-only">{t('price.sale')} </span><span>{formatVnd(value)}</span>
  </span>
}
