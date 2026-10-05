import { useSearchParams } from 'react-router-dom'

export function useListParams() {
  const [params, setParams] = useSearchParams()
  const update = (values, resetPage = true) => setParams(current => {
    const next = new URLSearchParams(current)
    if (resetPage) next.delete('page')
    for (const [key, value] of Object.entries(values)) {
      if (value === '' || value == null || (key === 'page' && Number(value) === 1)) next.delete(key)
      else next.set(key, String(value))
    }
    return next
  }, { replace: resetPage })
  const raw = Number(params.get('page') || 1)
  return { params, page: Number.isSafeInteger(raw) && raw > 0 ? raw : 1, setPage: value => update({ page: value }, false), update }
}
