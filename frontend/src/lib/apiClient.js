/** Shared HTTP contract; dependencies are injected so auth and failures can be tested. */
export function createApiClient({ baseUrl = '/api', getSession, fetchImpl = globalThis.fetch, timeoutMs = 15000 }) {
  const base = baseUrl.replace(/\/$/, '')
  return {
    async request(path, options = {}) {
      const controller = new AbortController()
      const cancel = () => controller.abort(options.signal.reason)
      if (options.signal?.aborted) cancel()
      else options.signal?.addEventListener('abort', cancel, { once: true })
      let timer
      const operation = execute(path, { ...options, signal: controller.signal })
      try {
        return await Promise.race([operation, new Promise((_, reject) => {
          timer = setTimeout(() => { reject(new Error('NB_API_TIMEOUT')); controller.abort() }, timeoutMs)
        })])
      } finally { clearTimeout(timer); options.signal?.removeEventListener('abort', cancel) }
    },
  }
  async function execute(path, { method = 'GET', body, auth = false, signal } = {}) {
      const headers = { Accept: 'application/json' }
      if (body !== undefined) headers['Content-Type'] = 'application/json'
      if (auth) {
        const { data, error } = await getSession()
        if (error || !data?.session?.access_token || data.session.user?.is_anonymous) throw new Error('NB_AUTH_REQUIRED')
        headers.Authorization = `Bearer ${data.session.access_token}`
      }
      if (signal.aborted) throw new Error('NB_API_CANCELED')
      const response = await fetchImpl(`${base}${path}`, {
        method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal,
      })
      let result
      try { result = await response.json() } catch { throw new Error('NB_API_UNAVAILABLE') }
      if (!response.ok) {
        const error = new Error(result.code || 'NB_API_UNAVAILABLE')
        error.code = result.code
        error.status = response.status
        throw error
      }
      return result
    }
}
