import { useLang } from '../i18n'
import Icon from './Icon'

/** Phân trang gọn một hàng ở mọi kích thước (audit M5); số trang có vùng bấm 44px. */
export default function Pagination({ page, pages, total, onPage, busy = false }) {
  const { lang } = useLang()
  const vi = lang === 'vi'
  const numbers = [...new Set([1, page - 1, page, page + 1, pages])].filter(n => n >= 1 && n <= pages).sort((a, b) => a - b)
  const step = 'flex h-11 items-center gap-2 px-2 text-caption font-medium tracking-[.08em] uppercase disabled:cursor-not-allowed disabled:opacity-30'
  return <nav aria-label={vi ? 'Phân trang' : 'Pagination'} className="mt-12 flex flex-col items-center gap-4 border-t border-line pt-8">
    <div className="flex items-center gap-1 sm:gap-3">
      <button type="button" className={step} disabled={busy || page <= 1} onClick={() => onPage(page - 1)} aria-label={vi ? 'Trang trước' : 'Previous page'}>
        <Icon name="arrowLeft" size={16} /><span className="hidden sm:inline" aria-hidden="true">{vi ? 'Trước' : 'Previous'}</span>
      </button>
      <ol className="flex items-center gap-1">{numbers.map((number, index) => <li key={number} className="flex items-center gap-1">
        {index > 0 && number > numbers[index - 1] + 1 && <span aria-hidden="true" className="px-1 text-ink-muted">…</span>}
        <button type="button" aria-label={`${vi ? 'Trang' : 'Page'} ${number}`} aria-current={number === page ? 'page' : undefined} disabled={busy || number === page} onClick={() => onPage(number)}
          className={`grid size-11 place-items-center text-body-sm tabular-nums disabled:cursor-default ${number === page ? 'border-b border-ink font-medium' : 'text-ink-muted hover:text-ink'}`}>{number}</button>
      </li>)}</ol>
      <button type="button" className={step} disabled={busy || page >= pages} onClick={() => onPage(page + 1)} aria-label={vi ? 'Trang sau' : 'Next page'}>
        <span className="hidden sm:inline" aria-hidden="true">{vi ? 'Sau' : 'Next'}</span><Icon name="arrowRight" size={16} />
      </button>
    </div>
    <p className="text-caption text-ink-muted">{total} {vi ? 'kết quả' : 'results'} · {vi ? 'Trang' : 'Page'} {page}/{pages}</p>
  </nav>
}
