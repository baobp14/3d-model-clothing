import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useLang } from '../i18n'
import { canShop, loginPath } from '../lib/customerSession'

export default function RequireCustomer({ children }) {
  const { user, loading, recovery, isAdmin } = useAuth()
  const { lang } = useLang()
  const location = useLocation()
  if (loading) return <main className="shop-shell" role="status">{lang === 'vi' ? 'Đang kiểm tra đăng nhập…' : 'Checking your session…'}</main>
  if (isAdmin) return <Navigate to="/admin" replace />
  if (!canShop(user, loading, recovery)) return <Navigate to={loginPath(location.pathname + location.search)} replace />
  return <div key={user.id}>{children}</div>
}
