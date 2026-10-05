export const lineKey = (product, color, size) => JSON.stringify([product.id, color, size])
export const cartKey = userId => userId ? `nb-cart-v2:${userId}` : null

export function readCart(storage, userId) {
  if (!userId) return []
  try {
    const saved = JSON.parse(storage.getItem(cartKey(userId)) || '[]')
    return Array.isArray(saved) ? saved.filter(i => i?.product?.id && Number.isFinite(i.product.price) && i.product.price >= 0 && Array.isArray(i.product.images) && Array.isArray(i.product.colors) && Array.isArray(i.product.sizes) && Number.isInteger(i.quantity) && i.quantity > 0 && i.quantity <= 99 && i.key === lineKey(i.product, i.color, i.size)) : []
  } catch { return [] }
}
