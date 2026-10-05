import { test } from 'node:test'
import assert from 'node:assert/strict'
import { reconcileCart, updateCartQuantity, cartHasUnavailableItems } from './cartInventory.js'

const product = { id: 1, price: 100, stock: 5, colors: ['black'], sizes: ['M', 'L'] }
const items = [{ key: 'M', product, color: 'black', size: 'M', quantity: 2 }, { key: 'L', product, color: 'black', size: 'L', quantity: 2 }]
test('changing one variant cannot exceed the shared product inventory', () => {
  const updated = updateCartQuantity(items, 'M', 99)
  assert.equal(updated[0].quantity, 3)
  assert.equal(updated[1].quantity, 2)
  assert.equal(cartHasUnavailableItems(updated), false)
})
test('a price/stock refresh preserves the selection for review and flags shortages or deleted products', () => {
  const updated = reconcileCart(items, [{ ...product, price: 200, stock: 2 }])
  assert.equal(updated[0].product.price, 200)
  assert.equal(updated[0].quantity, 2)
  assert.equal(cartHasUnavailableItems(updated), true)
  assert.equal(cartHasUnavailableItems(reconcileCart(items, [])), true)
  assert.equal(cartHasUnavailableItems(reconcileCart(items, [{ ...product, sizes: ['L'] }])), true)
  assert.equal(cartHasUnavailableItems(reconcileCart(items, [{ ...product, colors: [], sizes: [] }])), true)
  assert.equal(items[0].product.price, 100)
})

test('variant stock limits a selection even when aggregate inventory is sufficient', () => {
  const variantProduct = { ...product, variants: [{ color: 'black', size: 'M', stock: 1 }, { color: 'black', size: 'L', stock: 4 }] }
  const lines = items.map(line => ({ ...line, product: variantProduct }))
  assert.equal(cartHasUnavailableItems(lines), true)
  const updated = updateCartQuantity(lines, 'M', 4)
  assert.equal(updated[0].quantity, 1)
  assert.equal(updated[1].quantity, 2)
  assert.equal(cartHasUnavailableItems(updated), false)
})
