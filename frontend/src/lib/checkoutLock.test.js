import { test } from 'node:test'
import assert from 'node:assert/strict'
import { withCheckoutLock } from './checkoutLock.js'

test('a competing checkout tab is refused instead of queuing a stale second submission', async () => {
  const values = new Map()
  const storage = { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) }
  let release
  const wait = new Promise(resolve => { release = resolve })
  const first = withCheckoutLock('customer', () => wait, { locks: null, storage })
  await assert.rejects(withCheckoutLock('customer', () => assert.fail('must not submit'), { locks: null, storage }), /NB_CHECKOUT_BUSY/)
  release('done')
  assert.equal(await first, 'done')
  assert.equal(values.size, 0)
})

test('native locks reject a busy tab and release after an API error', async () => {
  await assert.rejects(withCheckoutLock('customer', () => assert.fail('must not submit'), { locks: { request: async (_, options, action) => { assert.equal(options.ifAvailable, true); return action(null) } } }), /NB_CHECKOUT_BUSY/)
  await assert.rejects(withCheckoutLock('customer', async () => { throw Error('offline') }, { locks: { request: async (_, options, action) => action({}) } }), /offline/)
})
