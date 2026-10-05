import { normalizeInputSpacing } from './inputSpacing.js'

export const MAX_ADDRESSES = 5
export const emptyBook = () => ({ addresses: [], default_address_id: null, revision: 0 })

export function addressErrorCode(error) {
  const message = error?.message || ''
  for (const code of ['NB_AUTH_REQUIRED', 'NB_ADDRESS_CONFLICT', 'NB_ADDRESS_LIMIT', 'NB_ADDRESS_NOT_FOUND', 'NB_INVALID_ADDRESS']) {
    if (message.includes(code)) return code
  }
  if (['PGRST202', 'PGRST205', '42P01', '42883'].includes(error?.code)) return 'address-setup-required'
  return 'address-request-failed'
}

export function validateAddress(values) {
  const clean = Object.fromEntries(['name', 'email', 'phone', 'city', 'address', 'notes'].map(key => [key, normalizeInputSpacing(values[key] ?? '').trim()]))
  const limits = { name: 120, email: 120, phone: 10, city: 120, address: 300, notes: 500 }
  if (Object.entries(clean).some(([key, value]) => (key !== 'notes' && !value) || value.length > limits[key])
    || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean.email)
    || !/^0[0-9]{9}$/.test(clean.phone)) {
    throw new Error('NB_INVALID_ADDRESS')
  }
  return clean
}

export async function loadAddressBook(client, userId) {
  if (!client || !userId) throw new Error('NB_AUTH_REQUIRED')
  // Ownership is resolved from the verified bearer token by Python.
  return client.request('/addresses', { auth: true })
}

export async function mutateAddressBook(client, book, { action, address, id, makeDefault = false, expectedRevision = book.revision }) {
  if (!client) throw new Error('NB_AUTH_REQUIRED')
  const data = await client.request('/addresses', { method: 'POST', auth: true, body: {
    action, address: action === 'save' ? validateAddress(address) : null,
    id: id || null, make_default: Boolean(makeDefault), expected_revision: expectedRevision,
  } })
  if (!data || !Array.isArray(data.addresses)) throw new Error('address-request-failed')
  return data
}

export function needsDefaultConfirmation(book, id, makeDefault) {
  return Boolean(makeDefault && book.default_address_id && book.default_address_id !== id)
}
