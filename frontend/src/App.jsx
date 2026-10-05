import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom'
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

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  return null
}

function AppContent() {
  const { pathname } = useLocation()
  const { t } = useLang()
  const admin = pathname.startsWith('/admin')
  return <div className={`min-h-screen bg-background text-foreground ${pathname === "/" ? "home-page" : ""}`}>
    {!admin && <Header />}
    <Suspense fallback={<main className="shop-shell" role="status">{t('auth.processing')}</main>}><Routes>
      <Route path="/" element={<Home />} />
      <Route path="/search" element={<Search />} />
      <Route path="/products" element={<ProductList />} />
      <Route path="/men/ready-to-wear" element={<ProductList department="men" />} />
      <Route path="/women/ready-to-wear" element={<ProductList department="women" />} />
      <Route path="/bags" element={<ProductList department="bags" />} />
      <Route path="/watches" element={<ProductList department="watches" />} />
      <Route path="/product/:id" element={<ProductDetail />} />
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
      </Route>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="*" element={<main className="shop-shell"><h1 className="display-title text-3xl">404</h1><p className="mt-5">{t('nav.notFound')}</p><a className="button mt-6" href="/">{t('nav.home')}</a></main>} />
    </Routes></Suspense>
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
