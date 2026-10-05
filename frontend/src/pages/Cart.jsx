import { useEffect } from 'react'
import { quantityLimit } from '../lib/cartInventory'
import { Link } from 'react-router-dom'
import { useCart } from '../hooks/useCart'
import { useLang } from '../i18n'
import { formatPrice } from '../data/products'
import { colorName } from '../lib/colorName'

export function EmptyCart() {
  const { lang } = useLang()
  return <div className="py-16 text-center"><p className="text-stone">{lang === 'vi' ? 'Giỏ hàng của bạn đang trống.' : 'Your bag is empty.'}</p><Link to="/men/ready-to-wear" className="button mt-8">{lang === 'vi' ? 'Khám phá sản phẩm' : 'Explore products'}</Link></div>
}

export function OrderSummary({ children, discount = 0, discountCode = '' }) {
  const { total, count } = useCart()
  const { lang } = useLang()
  const vi = lang === 'vi'
  return <aside className="h-fit border border-feather bg-alabaster p-6 sm:p-8"><h2 className="display-title text-xl">{vi ? 'Tóm tắt đơn hàng' : 'Order summary'}</h2><div className="mt-6 flex justify-between gap-4 text-sm"><span>{vi ? 'Tạm tính' : 'Subtotal'} ({count})</span><span>{formatPrice(total)}</span></div><div className="mt-4 flex justify-between text-sm"><span>{vi ? 'Giao hàng' : 'Delivery'}</span><span>{vi ? 'Miễn phí' : 'Free'}</span></div>{discountCode && <div className="mt-4 flex justify-between gap-3 text-sm"><span>{vi ? 'Giảm giá' : 'Discount'} ({discountCode})</span><span>−{formatPrice(discount)}</span></div>}<div className="mt-6 flex justify-between gap-4 border-t border-feather pt-6"><strong>{vi ? 'Tổng cộng' : 'Total'}</strong><strong>{formatPrice(total - discount)}</strong></div>{children}</aside>
}

export default function Cart() {
  const { items, update, remove, ready, refresh, checking, inventoryError, unavailable, pending } = useCart()
  const { lang } = useLang()
  const vi = lang === 'vi'
  useEffect(() => { if (ready && !pending) refresh().catch(() => {}) }, [ready, pending])
  if (!ready) return <main className="shop-shell" role="status">{vi ? 'Đang tải giỏ hàng…' : 'Loading your bag…'}</main>
  return <main className="shop-shell"><p className="eyebrow text-stone">N&B</p><h1 className="display-title mt-3 text-3xl">{vi ? 'Giỏ hàng' : 'Your bag'}</h1>{pending && <p className="mt-4 text-sm text-amber-700">{vi ? 'Có đơn đang chờ xác nhận. Vào thanh toán để kiểm tra lại trước khi sửa giỏ.' : 'An order is awaiting confirmation. Go to checkout to check it before editing your bag.'}</p>}{inventoryError && <p role="alert" className="mt-4 text-sm text-red-700">{vi ? 'Không thể cập nhật giá và tồn kho.' : 'Could not update prices and stock.'} <button onClick={() => refresh().catch(() => {})} className="underline">{vi ? 'Thử lại' : 'Retry'}</button></p>}{unavailable && !pending && <p role="alert" className="mt-4 text-sm text-red-700">{vi ? 'Một số sản phẩm không đủ số lượng hoặc lựa chọn không còn khả dụng. Vui lòng giảm số lượng hoặc xóa sản phẩm.' : 'Some quantities or options are unavailable. Reduce the quantity or remove the item.'}</p>}{!items.length ? <EmptyCart /> : <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_380px]"><div>{items.map(item => <article key={item.key} className="flex gap-4 border-b border-feather py-6 first:pt-0 sm:gap-6"><Link to={`/product/${item.product.id}`} className="h-36 w-24 shrink-0 bg-muted sm:h-44 sm:w-32"><img src={item.product.images[item.product.colors.indexOf(item.color)] || item.product.images[0]} alt={item.product[lang]} className="h-full w-full object-contain" /></Link><div className="min-w-0 flex-1"><Link to={`/product/${item.product.id}`} className="text-sm">{item.product[lang]}</Link><p className="mt-2 text-xs text-stone">{colorName(item.product, item.color, lang)}{item.size && ` / ${item.size}`}</p><p className="mt-3 text-sm">{formatPrice(item.product.price)}</p><div className="mt-4 flex flex-wrap items-center gap-4"><label className="flex items-center gap-2 text-xs">{vi ? 'Số lượng' : 'Quantity'}<input type="number" min="1" max={Math.max(1, quantityLimit(items, item))} disabled={!!pending || checking || quantityLimit(items, item) === 0} value={item.quantity} onChange={e => update(item.key, e.target.value)} className="shop-input w-20" /></label><button disabled={!!pending || checking} onClick={() => remove(item.key)} className="text-xs text-stone underline underline-offset-4">{vi ? 'Xóa' : 'Remove'}</button></div><p className="mt-4 text-sm sm:text-right">{formatPrice(item.product.price * item.quantity)}</p></div></article>)}<Link to="/men/ready-to-wear" className="mt-6 inline-block text-xs underline underline-offset-4">{vi ? 'Tiếp tục mua sắm' : 'Continue shopping'}</Link></div><OrderSummary><Link to="/checkout" aria-disabled={!pending && (checking || inventoryError || unavailable)} onClick={e => { if (!pending && (checking || inventoryError || unavailable)) e.preventDefault() }} className="button mt-8 w-full bg-obsidian text-white">{vi ? 'Tiến hành thanh toán' : 'Checkout'}</Link></OrderSummary></div>}</main>
}
