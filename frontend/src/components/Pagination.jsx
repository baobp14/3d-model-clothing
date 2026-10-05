import { useLang } from '../i18n'

export default function Pagination({ page, pages, total, onPage, busy = false }) {
  const { lang } = useLang()
  const vi = lang === 'vi'
  const numbers = [...new Set([1, page - 1, page, page + 1, pages])].filter(n => n >= 1 && n <= pages).sort((a, b) => a - b)
  return <nav aria-label={vi ? 'Phân trang' : 'Pagination'} className="mt-8 flex flex-wrap items-center justify-center gap-3">
    <span className="text-sm text-slate">{total} {vi ? 'kết quả' : 'results'} · {vi ? 'Trang' : 'Page'} {page}/{pages}</span>
    <button type="button" className="button button--sm" disabled={busy || page <= 1} onClick={() => onPage(page - 1)}>{vi ? 'Trang trước' : 'Previous page'}</button>
    <div className="flex items-center gap-2">{numbers.map((number, index) => <span key={number} className="flex items-center gap-2">
      {index > 0 && number > numbers[index - 1] + 1 && <span aria-hidden="true">…</span>}
      <button type="button" aria-label={`${vi ? 'Trang' : 'Page'} ${number}`} aria-current={number === page ? 'page' : undefined} disabled={busy || number === page} onClick={() => onPage(number)} className={`h-10 min-w-10 border px-2 text-sm disabled:cursor-default ${number === page ? 'border-obsidian bg-obsidian text-white' : 'border-feather hover:border-obsidian'}`}>{number}</button>
    </span>)}</div>
    <button type="button" className="button button--sm" disabled={busy || page >= pages} onClick={() => onPage(page + 1)}>{vi ? 'Trang sau' : 'Next page'}</button>
  </nav>
}
