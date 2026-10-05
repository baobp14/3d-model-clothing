/** Serialize checkout tabs without queuing a stale second submission. */
export async function withCheckoutLock(owner, action, { locks = globalThis.navigator?.locks, storage = globalThis.localStorage } = {}) {
  const name = `nb-checkout-lock:${owner}`
  if (locks) return locks.request(name, { ifAvailable: true }, lock => {
    if (!lock) throw new Error('NB_CHECKOUT_BUSY')
    return action()
  })
  // Older browsers: reserve before awaiting, then verify after competing tabs run.
  const token = crypto.randomUUID()
  const previous = JSON.parse(storage.getItem(name) || 'null')
  if (previous && previous.expires > Date.now()) throw new Error('NB_CHECKOUT_BUSY')
  storage.setItem(name, JSON.stringify({ token, expires: Date.now() + 60000 }))
  await new Promise(resolve => setTimeout(resolve, 25))
  if (JSON.parse(storage.getItem(name) || 'null')?.token !== token) throw new Error('NB_CHECKOUT_BUSY')
  try { return await action() }
  finally { if (JSON.parse(storage.getItem(name) || 'null')?.token === token) storage.removeItem(name) }
}
