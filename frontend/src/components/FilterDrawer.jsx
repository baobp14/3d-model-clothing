import Drawer, { DrawerHeader } from './ui/Drawer'
import { useLang } from '../i18n'

function toggle(list, value) {
  return list.includes(value) ? list.filter(x => x !== value) : [...list, value]
}

function Group({ legend, children }) {
  return <fieldset className="border-b border-line py-6">
    <legend className="eyebrow float-left mb-4 w-full text-ink-muted">{legend}</legend>
    <div className="clear-left">{children}</div>
  </fieldset>
}

/**
 * Bộ lọc: lựa chọn chỉ áp dụng khi bấm nút (WCAG 3.2.2); đóng bằng Esc thì bỏ lựa chọn chưa áp dụng.
 * `draft` = { cats, cols, szs } do trang danh sách giữ.
 */
export default function FilterDrawer({ open, onClose, draft, setDraft, onApply, categories, colors, sizes }) {
  const { lang, t } = useLang()
  const set = key => value => setDraft(d => ({ ...d, [key]: toggle(d[key], value) }))
  return <Drawer open={open} onClose={onClose} side="left" labelledBy="filter-drawer-title">
    <DrawerHeader id="filter-drawer-title" title={t('plp.filters')} onClose={onClose} closeLabel={t('nav.close')} />
    <div className="flex-1 overflow-y-auto px-(--gutter) sm:px-8">
      {categories.length > 1 && <Group legend={t('plp.category')}>
        <div className="flex flex-col">
          {categories.map(c => <label key={c.id} className="flex min-h-11 cursor-pointer items-center gap-3 text-body-sm">
            <input type="checkbox" checked={draft.cats.includes(c.id)} onChange={() => set('cats')(c.id)} className="size-5 accent-ink" />{c[lang]}
          </label>)}
        </div>
      </Group>}
      {colors.length > 0 && <Group legend={t('plp.color')}>
        <div className="flex flex-wrap gap-2">
          {colors.map(c => {
            const on = draft.cols.includes(c.id)
            return <button key={c.id} type="button" onClick={() => set('cols')(c.id)} aria-pressed={on}
              className={`flex min-h-11 items-center gap-2 border px-3 text-body-sm ${on ? 'border-ink ring-1 ring-ink' : 'border-line-strong hover:border-ink'}`}>
              <span aria-hidden="true" className="size-4 shrink-0 rounded-full border border-ink/20" style={{ background: c.hex }} />{c[lang]}
            </button>
          })}
        </div>
      </Group>}
      {sizes.length > 0 && <Group legend={t('plp.size')}>
        <div className="flex flex-wrap gap-2">
          {sizes.map(s => {
            const on = draft.szs.includes(s)
            return <button key={s} type="button" onClick={() => set('szs')(s)} aria-pressed={on}
              className={`h-12 min-w-12 border px-3 text-body-sm ${on ? 'border-ink bg-ink text-on-ink' : 'border-line-strong hover:border-ink'}`}>{s}</button>
          })}
        </div>
      </Group>}
    </div>
    <div className="flex items-center gap-4 border-t border-line px-(--gutter) py-4 sm:px-8">
      <button type="button" onClick={() => setDraft({ cats: [], cols: [], szs: [] })} className="min-h-11 text-body-sm text-link">{t('plp.clear')}</button>
      <button type="button" onClick={onApply} className="button button--primary ml-auto">{t('plp.apply')}</button>
    </div>
  </Drawer>
}
