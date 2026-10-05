import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeSearch, searchProducts } from './productSearch.js'
import { products, categories, colors } from '../data/products.js'

test('search ignores case, Vietnamese accents and repeated whitespace', () => {
  assert.equal(normalizeSearch('  ÁO   ĐEN  '), 'ao den')
  assert.deepEqual(searchProducts(products, categories, colors, 'Áo THUN ĐEN'), searchProducts(products, categories, colors, '  ao   thun den '))
  assert.ok(searchProducts(products, categories, colors, 'ao thun den').length > 0)
})

test('search matches English, category, color and product ID across departments', () => {
  assert.ok(searchProducts(products, categories, colors, 'shirt black').length > 0)
  const product = products[0]
  assert.ok(searchProducts(products, categories, colors, String(product.id)).some(p => p.id === product.id))
  const watch = { id: 9999, vi: 'Đồng hồ nữ', en: 'Women’s watch', department: 'watches', category: 'wa-women', colors: [] }
  assert.deepEqual(searchProducts([watch], categories, colors, 'dong ho'), [watch])
  assert.ok(searchProducts(products, categories, colors, 'nu').some(p => p.department === 'women'))
})

test('search requires every token and handles blank and absent results', () => {
  assert.deepEqual(searchProducts(products, categories, colors, ' '), products)
  assert.deepEqual(searchProducts(products, categories, colors, 'zzunknown'), [])
  assert.deepEqual(searchProducts(products, categories, colors, 'ao zzunknown'), [])
  assert.deepEqual(searchProducts(products, categories, colors, "' OR 1=1 --"), [])
})
