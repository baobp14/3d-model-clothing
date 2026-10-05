import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadCartProducts } from './cartProducts.js'

test('cart refresh requests only distinct cart IDs in bounded batches and does not load empty carts', async () => {
  const paths = []
  const api = { request: async path => { paths.push(path); return { products: new URLSearchParams(path.split('?')[1]).get('ids').split(',').map(id => ({ id: Number(id) })) } } }
  assert.deepEqual(await loadCartProducts(api, []), [])
  assert.equal(paths.length, 0)
  const lines = Array.from({ length: 101 }, (_, index) => ({ product: { id: index + 1 } }))
  const products = await loadCartProducts(api, [...lines, lines[0]])
  assert.equal(products.length, 101)
  assert.equal(paths.length, 2)
  assert.equal(new URLSearchParams(paths[0].split('?')[1]).get('ids').split(',').length, 100)
  assert.equal(paths[1], '/products/by-ids?ids=101')
})
