export function canShop(user, loading = false, recovery = false) {
  return Boolean(!loading && !recovery && user?.id && !user.is_anonymous && user.app_metadata?.role !== 'admin')
}

export function safeReturnPath(value, fallback = '/') {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || /[\\\u0000-\u001f]/.test(value)) return fallback
  const path = value.split(/[?#]/)[0]
  if (['/login', '/register', '/reset-password', '/forgot-password'].includes(path)) return fallback
  return value
}

export const loginPath = path => `/login?next=${encodeURIComponent(safeReturnPath(path))}`
