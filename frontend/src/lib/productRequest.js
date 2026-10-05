export const productRequestKey = owner => `nb-product-create-v1:${owner}`
export function readProductRequest(storage, owner) {
  const raw = storage.getItem(productRequestKey(owner))
  if (!raw) return null
  const request = JSON.parse(raw)
  if (!request?.id || !request?.payload?.name || !request.payload.image) throw Error('NB_PRODUCT_REQUEST_STORAGE')
  return request
}
export function prepareProductRequest(storage, owner, payload) {
  const previous = readProductRequest(storage, owner)
  if (previous) {
    if (JSON.stringify(previous.payload) !== JSON.stringify(payload)) throw Error('NB_PRODUCT_REQUEST_PENDING')
    return previous
  }
  const request = { id: crypto.randomUUID(), payload }
  storage.setItem(productRequestKey(owner), JSON.stringify(request))
  return request
}
