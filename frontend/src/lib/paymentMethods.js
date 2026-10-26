import { shopApi } from './api'

/** Payment methods the API accepts right now; QR appears only when the gateway is configured. */
export async function loadPaymentMethods() {
  try { return (await shopApi.request('/payment-methods')).methods }
  catch { return ['cod'] }
}
