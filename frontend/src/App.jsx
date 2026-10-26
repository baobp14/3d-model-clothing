import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Link, Route, Routes, useLocation } from 'react-router-dom'
import EmptyState from './components/ui/EmptyState'
import { PageSkeleton } from './components/ui/Skeleton'
import { CartProvider } from './hooks/useCart'
import { WishlistProvider } from './hooks/useWishlist'
import RequireCustomer from './components/RequireCustomer'
import Header from './components/Header'
import Footer from './components/Footer'
import Admin from './pages/Admin'
import { ForgotPassword, Login, Register, ResetPassword } from './pages/Auth'
import { AuthProvider } from './hooks/useAuth'
import { LanguageProvider } from './i18n'
import { useLang } from './i18n'

const ProductDetail = lazy(() => import('./pages/ProductDetail'))
const Cart = lazy(() => import('./pages/Cart'))
const Checkout = lazy(() => import('./pages/Checkout'))
const Addresses = lazy(() => import('./pages/Addresses'))
const Inventory = lazy(() => import('./pages/Inventory'))
const InventoryDetail = lazy(() => import('./pages/InventoryDetail'))
const Home = lazy(() => import('./pages/Home'))
const ProductList = lazy(() => import('./pages/ProductList'))
const Search = lazy(() => import('./pages/Search'))
const Orders = lazy(() => import('./pages/Orders'))
const Overview = lazy(() => import('./pages/Overview'))
const Wishlist = lazy(() => import('./pages/Wishlist'))
const Promotions = lazy(() => import('./pages/Promotions'))
const StockAlerts = lazy(() => import('./pages/StockAlerts'))
const Returns = lazy(() => import('./pages/Returns'))
const TryOn = lazy(() => import('./pages/TryOn'))
const Users = lazy(() => import('./pages/Users'))
const Terms = lazy(() => import('./pages/Legal').then(module => ({ default: module.Terms })))
const Privacy = lazy(() => import('./pages/Legal').then(module => ({ default: module.Privacy })))

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  return null
}

function NotFound() {
  const { t } = useLang()
  return <main className="shop-shell">
    <title>{`404 – N&B`}</title>
    <EmptyState as="h1" title={t('nav.notFound')}>
      <Link to="/" className="button button--primary">{t('nav.home')}</Link>
      <Link to="/products" className="button">{t('nav.all')}</Link>
    </EmptyState>
  </main>
}

function AppContent() {
  const { pathname } = useLocation()
  const { t } = useLang()
  const admin = pathname.startsWith('/admin')
  return <div className="flex min-h-screen flex-col bg-paper text-ink">
    {!admin && <a href="#main" className="skip-link">{t('ui.skip')}</a>}
    {!admin && <Header />}
    <div id="main" tabIndex={-1} className="flex flex-1 flex-col outline-none">
    <Suspense fallback={<PageSkeleton label={t('ui.loading')} />}><Routes>
      <Route path="/" element={<Home />} />
      <Route path="/search" element={<Search />} />
      <Route path="/products" element={<ProductList />} />
      <Route path="/men/ready-to-wear" element={<ProductList department="men" />} />
      <Route path="/women/ready-to-wear" element={<ProductList department="women" />} />
      <Route path="/product/:id" element={<ProductDetail />} />
      <Route path="/try-on" element={<TryOn />} />
      <Route path="/cart" element={<RequireCustomer><Cart /></RequireCustomer>} />
      <Route path="/checkout" element={<RequireCustomer><Checkout /></RequireCustomer>} />
      <Route path="/account/addresses" element={<RequireCustomer><Addresses /></RequireCustomer>} />
      <Route path="/account/orders" element={<RequireCustomer><Orders /></RequireCustomer>} />
      <Route path="/account/wishlist" element={<RequireCustomer><Wishlist /></RequireCustomer>} />
      <Route path="/admin" element={<Admin />}>
        <Route index element={<Overview />} />
        <Route path="inventory/products" element={<Inventory />} />
        <Route path="inventory/alerts" element={<StockAlerts />} />
        <Route path="inventory/products/:id" element={<InventoryDetail />} />
        <Route path="pricing/products" element={<Inventory pricing />} />
        <Route path="pricing/promotions" element={<Promotions />} />
        <Route path="orders" element={<Orders admin />} />
        <Route path="returns" element={<Returns />} />
        <Route path="users" element={<Users />} />
      </Route>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/terms" element={<Terms />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="*" element={<NotFound />} />
    </Routes></Suspense>
    </div>
    {!admin && <Footer />}
  </div>
}

export default function App() {
  return (
    <BrowserRouter>
      <LanguageProvider>
        <AuthProvider>
        <WishlistProvider>
        <CartProvider>
        <ScrollToTop />
        <AppContent />
        </CartProvider>
        </WishlistProvider>
        </AuthProvider>
      </LanguageProvider>
    </BrowserRouter>
  )
}
