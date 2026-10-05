import { test } from 'node:test'
import assert from 'node:assert/strict'
import { checkoutKey, readOrderRequest, saveOrderRequest } from './checkoutRequest.js'

const storage = () => {
  const values = new Map()
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) }
}
const payload = { address_id: 'address', payment: 'cod', items: [{ product_id: 1, color: 'black', size: 'M', quantity: 2 }] }

test('a lost response followed by reload reuses the original order ID and isolates accounts', () => {
  const saved = storage()
  saveOrderRequest(saved, 'alice', payload, () => 'first-id')
  assert.equal(readOrderRequest(saved, 'alice').id, 'first-id')
  assert.equal(saveOrderRequest(saved, 'alice', structuredClone(payload), () => 'must-not-use').id, 'first-id')
  assert.equal(readOrderRequest(saved, 'bob'), null)
  assert.equal(saveOrderRequest(saved, 'bob', payload, () => 'bob-id').id, 'bob-id')
})
test('an unresolved request cannot silently become a second order with changed quantities', () => {
  const saved = storage()
  saveOrderRequest(saved, 'alice', payload, () => 'first-id')
  const changed = { ...payload, items: [{ ...payload.items[0], quantity: 3 }] }
  assert.throws(() => saveOrderRequest(saved, 'alice', changed), /NB_PENDING_ORDER/)
  assert.equal(readOrderRequest(saved, 'alice').id, 'first-id')
  saved.removeItem(checkoutKey('alice'))
  assert.equal(saveOrderRequest(saved, 'alice', changed, () => 'next-id').id, 'next-id')
})
test('unavailable storage or a corrupt retry record prevents starting an unsafe order', () => {
  assert.throws(() => saveOrderRequest({ getItem: () => null, setItem: () => { throw Error('quota') } }, 'alice', payload), /quota/)
  const saved = storage()
  saved.setItem(checkoutKey('alice'), '{}')
  assert.throws(() => saveOrderRequest(saved, 'alice', payload), /NB_CHECKOUT_STORAGE/)
})
