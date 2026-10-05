import { test } from 'node:test'
import assert from 'node:assert/strict'
import { requestReset, saveReset, sessionId } from './passwordReset.js'

test('recovery matches one auth session across token refresh, not merely the user', () => {
  const session = id => ({ access_token: `header.${Buffer.from(JSON.stringify({ session_id: id })).toString('base64url')}.signature` })
  assert.equal(sessionId(session('recovery-session')), 'recovery-session')
  assert.notEqual(sessionId(session('normal-session')), sessionId(session('recovery-session')))
  assert.equal(sessionId(null), null)
  assert.equal(sessionId({ access_token: 'invalid' }), null)
})

test('reset emails use the current production domain and normalized address', async () => {
  let args
  const auth = { resetPasswordForEmail: async (...values) => { args = values; return {} } }
  assert.deepEqual(await requestReset(auth, ' customer@example.com ', 'https://shop.example.com'), { ok: true })
  assert.deepEqual(args, ['customer@example.com', { redirectTo: 'https://shop.example.com/reset-password' }])
})

test('unconfigured, rejected, and network requests never report success', async () => {
  assert.equal((await requestReset(null, 'x', 'x')).error, 'supabase-off')
  assert.equal((await requestReset({ resetPasswordForEmail: async () => ({ error: { message: 'rate limited' } }) }, 'x', 'x')).ok, false)
  assert.equal((await requestReset({ resetPasswordForEmail: async () => { throw Error() } }, 'x', 'x')).error, 'network-error')
})

function client(overrides = {}) {
  return { getUser: async () => ({ data: { user: { id: 'customer' } } }), updateUser: async () => ({}), signOut: async () => ({}), ...overrides }
}

test('missing recovery or expired user cannot write a password', async () => {
  const auth = client({ updateUser: () => assert.fail('unexpected write') })
  assert.equal((await saveReset(auth, 'new-password', false, () => {})).error, 'invalid-recovery')
  auth.getUser = async () => ({ data: { user: null }, error: {} })
  assert.equal((await saveReset(auth, 'new-password', true, () => {})).error, 'invalid-recovery')
})

test('successful write clears recovery before global sign out', async () => {
  const steps = []
  const auth = client({ updateUser: async args => { assert.deepEqual(args, { password: 'new-password' }); steps.push('write'); return {} }, signOut: async args => { assert.deepEqual(args, { scope: 'global' }); steps.push('signout'); return {} } })
  assert.deepEqual(await saveReset(auth, 'new-password', true, () => steps.push('clear')), { ok: true, signOutFailed: false })
  assert.deepEqual(steps, ['write', 'clear', 'signout'])
})

test('write errors retain recovery and never revoke sessions', async () => {
  const auth = client({ updateUser: async () => ({ error: { message: 'weak password' } }), signOut: () => assert.fail('unexpected signout') })
  assert.deepEqual(await saveReset(auth, 'weak', true, () => assert.fail('unexpected clear')), { ok: false, error: 'weak password' })
})

test('signout errors do not misreport an already saved password', async () => {
  for (const signOut of [async () => ({ error: {} }), async () => { throw Error() }]) {
    assert.deepEqual(await saveReset(client({ signOut }), 'new-password', true, () => {}), { ok: true, signOutFailed: true })
  }
})
