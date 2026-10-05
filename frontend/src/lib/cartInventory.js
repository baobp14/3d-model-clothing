export function quantityLimit(items, line) {
  const others = items.filter(i => i.key !== line.key && i.product.id === line.product.id)
    .reduce((sum, i) => sum + i.quantity, 0)
  const variant = line.product.variants?.find(row => row.color === (line.color || '') && row.size === (line.size || ''))
  const sameVariant = items.filter(i => i.key !== line.key && i.product.id === line.product.id && i.color === line.color && i.size === line.size).reduce((sum, i) => sum + i.quantity, 0)
  const variantLimit = line.product.variants ? (variant?.stock ?? 0) - sameVariant : 99
  return Math.max(0, Math.min(99, (line.product.stock ?? 0) - others, variantLimit))
}

export function updateCartQuantity(items, key, quantity) {
  return items.map(i => i.key === key && quantityLimit(items, i) > 0
    ? { ...i, quantity: Math.max(1, Math.min(quantityLimit(items, i), Math.trunc(Number(quantity)) || 1)) } : i)
}

export function reconcileCart(items, products) {
  const catalog = new Map(products.map(p => [p.id, p]))
  return items.map(line => ({ ...line, product: catalog.get(line.product.id) || { ...line.product, stock: 0 } }))
}

export function cartHasUnavailableItems(items) {
  return items.some(i => i.quantity > quantityLimit(items, i)
    || (i.product.colors.length ? !i.product.colors.includes(i.color) : Boolean(i.color))
    || (i.product.sizes.length ? !i.product.sizes.includes(i.size) : Boolean(i.size)))
}
