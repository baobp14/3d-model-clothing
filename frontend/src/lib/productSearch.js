export const normalizeSearch = value => String(value).toLocaleLowerCase().replace(/đ/g, 'd')
  .normalize('NFD').replace(/\p{M}/gu, '').trim().replace(/\s+/g, ' ')

export function searchProducts(products, categories, colors, query) {
  const tokens = normalizeSearch(query).split(' ').filter(Boolean)
  const departments = { men: 'nam men', women: 'nu women', bags: 'tui phu kien bags accessories', watches: 'dong ho watches' }
  const categoryNames = new Map(categories.map(c => [c.id, `${c.vi} ${c.en}`]))
  const colorNames = new Map(colors.map(c => [c.id, `${c.vi} ${c.en}`]))
  return products.filter(p => {
    const text = normalizeSearch([p.id, p.vi, p.en, categoryNames.get(p.category), departments[p.department],
      ...p.colors.map(c => colorNames.get(c) || c)].join(' '))
    return tokens.every(token => text.includes(token))
  })
}
