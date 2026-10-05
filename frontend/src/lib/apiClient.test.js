import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createApiClient } from './apiClient.js'

test('API sends the active bearer token, body and abort signal only when authentication is required', async () => {
  const calls = []
  const api = createApiClient({ baseUrl: '/api/', getSession: async () => ({ data: { session: { access_token: 'token', user: {} } } }),
    fetchImpl: async (...args) => { calls.push(args); return { ok: true, json: async () => ({ ok: true }) } } })
  const controller = new AbortController()
  const signal = controller.signal
  await api.request('/orders', { method: 'POST', body: { quantity: 2 }, auth: true, signal })
  assert.equal(calls[0][0], '/api/orders')
  assert.equal(calls[0][1].headers.Authorization, 'Bearer token')
  assert.equal(calls[0][1].body, '{"quantity":2}')
  assert.equal(calls[0][1].signal.aborted, false)
  await api.request('/catalog')
  assert.equal(calls[1][1].headers.Authorization, undefined)
})

test('caller cancellation propagates to the active HTTP request', async () => {
  const controller = new AbortController()
  let activeSignal
  const api = createApiClient({ fetchImpl: async (_, { signal }) => {
    activeSignal = signal
    return new Promise((_, reject) => signal.addEventListener('abort', () => reject(Error('canceled')), { once: true }))
  } })
  const request = api.request('/catalog', { signal: controller.signal })
  controller.abort()
  await assert.rejects(request, /canceled/)
  assert.equal(activeSignal.aborted, true)
})

test('unauthenticated and anonymous sessions never send a protected request', async () => {
  for (const session of [null, { access_token: 'token', user: { is_anonymous: true } }]) {
    const api = createApiClient({ getSession: async () => ({ data: { session } }), fetchImpl: () => assert.fail('must not fetch') })
    await assert.rejects(api.request('/addresses', { auth: true }), /NB_AUTH_REQUIRED/)
  }
})

test('API surfaces server conflicts and rejects offline or malformed responses', async () => {
  const api = createApiClient({ fetchImpl: async () => ({ ok: false, status: 409, json: async () => ({ code: 'NB_PRODUCT_CONFLICT' }) }) })
  await assert.rejects(api.request('/admin/products/1'), error => error.code === 'NB_PRODUCT_CONFLICT' && error.status === 409)
  await assert.rejects(createApiClient({ fetchImpl: async () => { throw Error('offline') } }).request('/catalog'), /offline/)
  await assert.rejects(createApiClient({ fetchImpl: async () => ({ json: async () => { throw Error('HTML') } }) }).request('/catalog'), /NB_API_UNAVAILABLE/)
})

test('API timeout releases the UI and aborts an unresponsive request', async () => {
  let signal
  const api = createApiClient({ timeoutMs: 10, fetchImpl: async (_, options) => { signal = options.signal; return new Promise(() => {}) } })
  await assert.rejects(api.request('/catalog'), /NB_API_TIMEOUT/)
  assert.equal(signal.aborted, true)
})
