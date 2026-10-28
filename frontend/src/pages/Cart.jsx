import { useEffect } from 'react'
import { quantityLimit } from '../lib/cartInventory'
import { Link } from 'react-router-dom'
import { useCart } from '../hooks/useCart'
import { useLang } from '../i18n'
import { formatPrice } from '../lib/format'
import { colorName } from '../lib/colorName'
import EmptyState from '../components/ui/EmptyState'

export function EmptyCart() {
  const { lang } = useLang()
  const vi = lang === 'vi'
  return <EmptyState title={vi ? 'Giỏ hàng của bạn đang trống.' : 'Your bag is empty.'} description={vi ? 'Khám phá các thiết kế mới và thêm sản phẩm vào giỏ.' : 'Explore the latest designs and add something to your bag.'}>
    <Link to="/products?sort=new" className="button button--primary">{vi ? 'Khám phá sản phẩm' : 'Explore products'}</Link>
  </EmptyState>
}

/** Tóm tắt đơn: dùng chung cho giỏ hàng và thanh toán. */
export function OrderSummary({ children, discount = 0, discountCode = '' }) {
  const { total, count } = useCart()
  const { lang } = useLang()
  const vi = lang === 'vi'
  const row = 'flex justify-between gap-4 text-body-sm'
  return <aside className="h-fit bg-cream p-6 sm:p-8 lg:sticky lg:top-[calc(var(--header-h)+2rem)]" aria-labelledby="order-summary-title">
    <h2 id="order-summary-title" className="font-display text-title-sm">{vi ? 'Tóm tắt đơn hàng' : 'Order summary'}</h2>
    <dl className="mt-6 space-y-3" aria-live="polite">
      <div className={row}><dt>{vi ? 'Tạm tính' : 'Subtotal'} ({count})</dt><dd className="tabular-nums">{formatPrice(total)}</dd></div>
      <div className={row}><dt>{vi ? 'Giao hàng' : 'Delivery'}</dt><dd>{vi ? 'Miễn phí' : 'Free'}</dd></div>
      {discountCode && <div className={row}><dt>{vi ? 'Giảm giá' : 'Discount'} ({discountCode})</dt><dd className="tabular-nums">−{formatPrice(discount)}</dd></div>}
      <div className="flex justify-between gap-4 border-t border-line-strong/40 pt-4 text-lead font-medium"><dt>{vi ? 'Tổng cộng' : 'Total'}</dt><dd className="tabular-nums">{formatPrice(total - discount)}</dd></div>
    </dl>
    {children}
  </aside>
}

function CartLine({ item, items, pending, checking, update, remove, lang, vi }) {
  const limit = quantityLimit(items, item)
  const locked = !!pending || checking || limit === 0
  const name = item.product[lang]
  const image = item.product.images[item.product.colors.indexOf(item.color)] || item.product.images[0]
  return <li className="flex gap-4 border-b border-line py-6 first:pt-0 sm:gap-6">
    <Link to={`/product/${item.product.id}`} tabIndex={-1} aria-hidden="true" className="product-image-surface aspect-product w-24 shrink-0 sm:w-32">
      {image && <img src={image} alt="" className="h-full w-full object-contain product-image-blend" />}
    </Link>
    <div className="flex min-w-0 flex-1 flex-col">
      <div className="flex justify-between gap-4">
        <div className="min-w-0">
          <Link to={`/product/${item.product.id}`} className="inline-flex min-h-6 items-center text-body-sm font-medium hover:underline hover:underline-offset-4">{name}</Link>
          <p className="mt-1 text-caption text-ink-muted">{colorName(item.product, item.color, lang)}{item.size && ` / ${item.size}`}</p>
          {item.tried3D && (
            <p className="mt-1.5">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 border border-emerald-200/80">
                <span className="size-1.5 rounded-full bg-emerald-500" />
                {vi ? 'Đã thử 3D · Rất vừa vặn' : '3D Verified · Perfect fit'}
              </span>
            </p>
          )}
          <p className="mt-1 text-caption text-ink-muted tabular-nums"><span className="sr-only">{vi ? 'Đơn giá' : 'Unit price'}: </span>{formatPrice(item.product.price)}</p>
        </div>
        <p className="shrink-0 text-body-sm font-medium tabular-nums"><span className="sr-only">{vi ? 'Thành tiền' : 'Line total'}: </span>{formatPrice(item.product.price * item.quantity)}</p>
      </div>
      <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-4">
        <div className="flex items-center border border-line-strong">
          <button type="button" disabled={locked || item.quantity <= 1} onClick={() => update(item.key, item.quantity - 1)} aria-label={vi ? `Giảm số lượng ${name}` : `Decrease quantity of ${name}`} className="grid size-10 place-items-center disabled:opacity-30">−</button>
          <label className="sr-only" htmlFor={`qty-${item.key}`}>{vi ? `Số lượng ${name}` : `Quantity of ${name}`}</label>
          <input id={`qty-${item.key}`} type="number" inputMode="numeric" min="1" max={Math.max(1, limit)} disabled={locked} value={item.quantity} onChange={e => update(item.key, e.target.value)}
            className="h-10 w-11 bg-transparent text-center text-body-sm tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none" />
          <button type="button" disabled={locked || item.quantity >= limit} onClick={() => update(item.key, item.quantity + 1)} aria-label={vi ? `Tăng số lượng ${name}` : `Increase quantity of ${name}`} className="grid size-10 place-items-center disabled:opacity-30">+</button>
        </div>
        <button type="button" disabled={!!pending || checking} onClick={() => remove(item.key)} aria-label={vi ? `Xóa ${name} khỏi giỏ` : `Remove ${name} from bag`} className="min-h-10 text-caption text-ink-muted text-link disabled:opacity-40">{vi ? 'Xóa' : 'Remove'}</button>
      </div>
      {limit === 0 && <p className="mt-2 text-caption text-danger">{vi ? 'Lựa chọn này hiện hết hàng hoặc không còn khả dụng.' : 'This option is out of stock or no longer available.'}</p>}
    </div>
  </li>
}

export default function Cart() {
  const { items, update, remove, ready, refresh, checking, inventoryError, unavailable, pending } = useCart()
  const { lang } = useLang()
  const vi = lang === 'vi'
  useEffect(() => { if (ready && !pending) refresh().catch(() => {}) }, [ready, pending])
  if (!ready) return <main className="shop-shell" role="status">{vi ? 'Đang tải giỏ hàng…' : 'Loading your bag…'}</main>
  const blocked = !pending && (checking || inventoryError || unavailable)
  return <main className="shop-shell max-w-checkout">
    <title>{`${vi ? 'Giỏ hàng' : 'Your bag'} – N&B`}</title>
    <h1 className="font-display text-title">{vi ? 'Giỏ hàng' : 'Your bag'}</h1>
    {pending && <p className="mt-6 border border-warning/30 bg-warning-soft px-4 py-3 text-body-sm text-warning">{vi ? 'Có đơn đang chờ xác nhận. Vào thanh toán để kiểm tra lại trước khi sửa giỏ.' : 'An order is awaiting confirmation. Go to checkout to check it before editing your bag.'}</p>}
    {inventoryError && <p role="alert" className="mt-6 border border-danger/30 bg-danger-soft px-4 py-3 text-body-sm text-danger">{vi ? 'Không thể cập nhật giá và tồn kho.' : 'Could not update prices and stock.'} <button onClick={() => refresh().catch(() => {})} className="text-link">{vi ? 'Thử lại' : 'Retry'}</button></p>}
    {unavailable && !pending && <p role="alert" className="mt-6 border border-danger/30 bg-danger-soft px-4 py-3 text-body-sm text-danger">{vi ? 'Một số sản phẩm không đủ số lượng hoặc lựa chọn không còn khả dụng. Vui lòng giảm số lượng hoặc xóa sản phẩm.' : 'Some quantities or options are unavailable. Reduce the quantity or remove the item.'}</p>}
    {!items.length ? <EmptyCart /> : <div className="mt-10 grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-16">
      <div className="min-w-0">
        <ul>{items.map(item => <CartLine key={item.key} item={item} items={items} pending={pending} checking={checking} update={update} remove={remove} lang={lang} vi={vi} />)}</ul>
        <Link to="/products" className="mt-6 inline-flex min-h-11 items-center text-body-sm text-link">{vi ? 'Tiếp tục mua sắm' : 'Continue shopping'}</Link>
      </div>
      <OrderSummary>
        <Link to="/checkout" aria-disabled={blocked} onClick={e => { if (blocked) e.preventDefault() }} className="button button--primary mt-8 w-full">{vi ? 'Tiến hành thanh toán' : 'Checkout'}</Link>
        <p className="mt-4 text-caption text-ink-muted">{vi ? 'Tồn kho và giá được kiểm tra lại khi đặt hàng.' : 'Stock and prices are checked again when you place your order.'}</p>
      </OrderSummary>
    </div>}
  </main>
}
