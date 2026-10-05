export async function loadCartProducts(api, lines) {
  const ids = [...new Set(lines.map(line => line.product.id))]
  const groups = []
  for (let index = 0; index < ids.length; index += 100) groups.push(ids.slice(index, index + 100))
  const pages = await Promise.all(groups.map(group => api.request(`/products/by-ids?ids=${group.join(',')}`)))
  return pages.flatMap(page => page.products)
}
