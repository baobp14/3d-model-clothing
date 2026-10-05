import { test } from 'node:test'
import assert from 'node:assert/strict'
import { prepareProductRequest, readProductRequest, productRequestKey } from './productRequest.js'

test('a lost product-create response and reload retain the ID and block different payloads', () => {
  const values = new Map()
  const storage = { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value) }
  const payload = { name: 'Shirt', image: '/img/test.webp', price: 100, stock: 5 }
  const first = prepareProductRequest(storage, 'admin-a', payload)
  assert.deepEqual(readProductRequest(storage, 'admin-a'), first)
  assert.deepEqual(prepareProductRequest(storage, 'admin-a', payload), first)
  assert.throws(() => prepareProductRequest(storage, 'admin-a', { ...payload, price: 200 }), /NB_PRODUCT_REQUEST_PENDING/)
  assert.equal(readProductRequest(storage, 'admin-b'), null)
  values.set(productRequestKey('admin-a'), '{invalid')
  assert.throws(() => prepareProductRequest(storage, 'admin-a', payload))
})
