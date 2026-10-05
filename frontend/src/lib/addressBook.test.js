import { test } from 'node:test'
import assert from 'node:assert/strict'
import { addressErrorCode, emptyBook, loadAddressBook, mutateAddressBook, needsDefaultConfirmation, validateAddress } from './addressBook.js'
import { canShop, loginPath, safeReturnPath } from './customerSession.js'
import { cartKey, lineKey, readCart } from './cartStorage.js'

const address = { name: ' Nguyễn An ', email: ' an@example.com ', phone: '0901234567', city: 'Hồ Chí Minh', address: '12 Nguyễn Huệ', notes: '' }

test('only a signed-in registered account outside password recovery can shop', () => {
  assert.equal(canShop(null), false)
  assert.equal(canShop({ id: 'A' }, true), false)
  assert.equal(canShop({ id: 'A' }, false, true), false)
  assert.equal(canShop({ id: 'A', is_anonymous: true }), false)
  assert.equal(canShop({ id: 'A' }), true)
  assert.equal(canShop({ id: 'A', app_metadata: { role: 'admin' } }), false)
})

test('login returns to shopping routes but rejects external or looping destinations', () => {
  assert.equal(loginPath('/product/1000'), '/login?next=%2Fproduct%2F1000')
  for (const value of ['https://evil.example', '//evil.example', '/\\evil.example', '/login?next=/cart', '/register', '/\n/evil']) assert.equal(safeReturnPath(value), '/')
  assert.equal(safeReturnPath('/checkout'), '/checkout')
})

test('cart storage is isolated between accounts and never exposes the legacy guest cart', () => {
  const product = { id: 1, price: 100, images: ['a'], colors: ['black'], sizes: ['M'] }
  const item = { key: lineKey(product, 'black', 'M'), product, color: 'black', size: 'M', quantity: 1 }
  const data = new Map([[cartKey('A'), JSON.stringify([item])], ['nb-cart-v1', JSON.stringify([item])]])
  const storage = { getItem: key => data.get(key) }
  assert.deepEqual(readCart(storage, 'A'), [item])
  assert.deepEqual(readCart(storage, 'B'), [])
  assert.deepEqual(readCart(storage, null), [])
  data.set(cartKey('A'), '{broken')
  assert.deepEqual(readCart(storage, 'A'), [])
})

test('address validation trims values and rejects missing, malformed or oversized details', () => {
  assert.equal(validateAddress(address).name, 'Nguyễn An')
  for (const invalid of [{ phone: '.........' }, ...['090123456', '09012345678', '1901234567', '+84901234567', '09012a4567', '090 123456'].map(phone => ({ phone })), { email: 'bad-email' }, { address: ' ' }, { notes: 'x'.repeat(501) }]) assert.throws(() => validateAddress({ ...address, ...invalid }), /NB_INVALID_ADDRESS/)
})

test('the first address and current default need no default-switch confirmation', () => {
  assert.equal(needsDefaultConfirmation(emptyBook(), null, true), false)
  const book = { default_address_id: 'A' }
  assert.equal(needsDefaultConfirmation(book, 'A', true), false)
  assert.equal(needsDefaultConfirmation(book, 'B', false), false)
  assert.equal(needsDefaultConfirmation(book, 'B', true), true)
  assert.equal(needsDefaultConfirmation(book, null, true), true)
  assert.equal(book.default_address_id, 'A')
})

test('mutations preserve the revision reviewed in the confirmation popup', async () => {
  let called
  const client = { request: async (path, options) => { called = { path, options }; return { ...emptyBook(), revision: 9 } } }
  await mutateAddressBook(client, { ...emptyBook(), revision: 8 }, { action: 'save', address, makeDefault: true, expectedRevision: 7 })
  assert.equal(called.path, '/addresses')
  assert.equal(called.options.auth, true)
  assert.equal(called.options.body.expected_revision, 7)
  assert.equal(called.options.body.make_default, true)
  assert.equal(called.options.body.address.name, 'Nguyễn An')
  assert.equal(called.options.body.id, null)
})

test('database errors and network failures never become a successful address save', async () => {
  const failure = { code: 'P0001', message: 'NB_ADDRESS_LIMIT' }
  await assert.rejects(mutateAddressBook({ request: async () => { throw failure } }, emptyBook(), { action: 'save', address }), error => error === failure)
  await assert.rejects(mutateAddressBook({ request: async () => { throw Error('offline') } }, emptyBook(), { action: 'delete', id: 'A' }), /offline/)
  assert.equal(addressErrorCode(failure), 'NB_ADDRESS_LIMIT')
  assert.equal(addressErrorCode({ code: 'PGRST205' }), 'address-setup-required')
})

test('a registered account without saved addresses gets an empty book', async () => {
  const api = { request: async (path, options) => {
    assert.equal(path, '/addresses'); assert.deepEqual(options, { auth: true }); return emptyBook()
  } }
  assert.deepEqual(await loadAddressBook(api, 'customer-A'), emptyBook())
  await assert.rejects(loadAddressBook(null, 'A'), /NB_AUTH_REQUIRED/)
})
