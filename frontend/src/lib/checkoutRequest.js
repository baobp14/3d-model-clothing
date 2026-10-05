export const checkoutKey = owner => `nb-checkout-v1:${owner}`

export function orderFingerprint(payload) {
  return JSON.stringify({ ...payload, items: [...payload.items].sort((a, b) =>
    a.product_id - b.product_id || a.color.localeCompare(b.color) || a.size.localeCompare(b.size)) })
}

export function readOrderRequest(storage, owner) {
  const raw = storage.getItem(checkoutKey(owner))
  if (!raw) return null
  const pending = JSON.parse(raw)
  if (!pending?.id || !pending?.payload?.items?.length) throw new Error('NB_CHECKOUT_STORAGE')
  return pending
}

export function saveOrderRequest(storage, owner, payload, uuid = () => crypto.randomUUID()) {
  const previous = readOrderRequest(storage, owner)
  if (previous) {
    if (orderFingerprint(previous.payload) !== orderFingerprint(payload)) throw new Error('NB_PENDING_ORDER')
    return previous
  }
  const pending = { id: uuid(), payload }
  storage.setItem(checkoutKey(owner), JSON.stringify(pending))
  return pending
}
