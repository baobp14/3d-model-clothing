/**
 * Shipping carriers and tracking URL helpers for Vietnamese e-commerce.
 */

export const CARRIERS = [
  {
    id: 'GHN',
    name: 'Giao Hàng Nhanh (GHN)',
    codePrefix: 'GHN',
    trackingUrl: code => `https://tracking.ghn.vn/?order_code=${encodeURIComponent(code)}`,
  },
  {
    id: 'GHTK',
    name: 'Giao Hàng Tiết Kiệm (GHTK)',
    codePrefix: 'S',
    trackingUrl: code => `https://i.ghtk.vn/${encodeURIComponent(code)}`,
  },
  {
    id: 'VTP',
    name: 'Viettel Post',
    codePrefix: 'VTP',
    trackingUrl: code => `https://viettelpost.vn/tra-cuu-hanh-trinh-don-hang?code=${encodeURIComponent(code)}`,
  },
  {
    id: 'VNPost',
    name: 'VNPost (Bưu điện Việt Nam)',
    codePrefix: 'VN',
    trackingUrl: code => `http://www.vnpost.vn/vi-vn/dinh-vi/buu-pham?key=${encodeURIComponent(code)}`,
  },
  {
    id: 'SPX',
    name: 'Shopee Xpress (SPX)',
    codePrefix: 'SPX',
    trackingUrl: code => `https://spx.vn/track?${encodeURIComponent(code)}`,
  },
  {
    id: 'JT',
    name: 'J&T Express',
    codePrefix: 'JT',
    trackingUrl: code => `https://jtexpress.vn/vi/tracking?type=track&billcode=${encodeURIComponent(code)}`,
  },
]

export function findCarrier(carrierNameOrId) {
  if (!carrierNameOrId) return null
  const query = String(carrierNameOrId).toLowerCase().trim()
  return CARRIERS.find(c => c.id.toLowerCase() === query || c.name.toLowerCase().includes(query) || query.includes(c.id.toLowerCase())) || null
}

export function getTrackingUrl(carrierNameOrId, trackingCode) {
  if (!trackingCode) return null
  const carrier = findCarrier(carrierNameOrId)
  if (carrier && carrier.trackingUrl) {
    return carrier.trackingUrl(trackingCode)
  }
  return `https://www.google.com/search?q=${encodeURIComponent(`${carrierNameOrId || 'tra cứu vận đơn'} ${trackingCode}`)}`
}

export function generateTrackingCode(carrierId = 'GHN') {
  const carrier = CARRIERS.find(c => c.id === carrierId) || CARRIERS[0]
  const randomDigits = Math.floor(10000000 + Math.random() * 90000000)
  return `${carrier.codePrefix}${randomDigits}`
}
