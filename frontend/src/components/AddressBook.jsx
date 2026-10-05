import { normalizeInputSpacing, normalizeSpacingEvent } from '../lib/inputSpacing'
import { useEffect, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useAddresses } from '../hooks/useAddresses'
import { useLang } from '../i18n'
import { MAX_ADDRESSES, needsDefaultConfirmation, validateAddress } from '../lib/addressBook'
import Popup from './Popup'

const messages = {
  NB_ADDRESS_LIMIT: ['Bạn đã lưu đủ 5 địa chỉ. Hãy sửa hoặc xóa một địa chỉ để thêm mới.', 'You have saved 5 addresses. Edit or delete one before adding another.'],
  NB_ADDRESS_CONFLICT: ['Danh sách địa chỉ đã thay đổi ở phiên khác. Đã tải lại; vui lòng kiểm tra và xác nhận lại.', 'Your addresses changed in another session. The list has been refreshed; please review and confirm again.'],
  NB_ADDRESS_NOT_FOUND: ['Địa chỉ này không còn tồn tại. Vui lòng chọn lại.', 'This address no longer exists. Please select another.'],
  NB_INVALID_ADDRESS: ['Vui lòng điền các trường bắt buộc, email hợp lệ và số điện thoại gồm đúng 10 chữ số, bắt đầu bằng 0.', 'Complete all required fields, use a valid email and a 10-digit phone number starting with 0.'],
  NB_AUTH_REQUIRED: ['Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.', 'Your session has expired. Please sign in again.'],
  'address-setup-required': ['Chức năng lưu địa chỉ chưa được kết nối. Vui lòng thử lại sau.', 'Saved addresses are not available yet. Please try again later.'],
  'address-request-failed': ['Không thể tải hoặc lưu địa chỉ. Kiểm tra kết nối và thử lại.', 'Could not load or save addresses. Check your connection and try again.'],
}

export function AddressDetails({ address }) {
  return <div className="space-y-1 text-sm leading-6"><p className="font-medium">{address.name} · {address.phone}</p><p className="break-words">{address.address}, {address.city}</p><p className="break-words text-slate">{address.email}</p>{address.notes && <p className="whitespace-pre-wrap break-words text-slate">{address.notes}</p>}</div>
}

export default function AddressBook({ selectedId, onSelect, onReady, disabled = false, popupOnly = false }) {
  const { book, loading, error: loadError, busy: saving, reload, mutate } = useAddresses()
  const busy = saving || disabled
  const { user } = useAuth()
  const { lang } = useLang()
  const vi = lang === 'vi'
  const [chooserOpen, setChooserOpen] = useState(false)
  const [editor, setEditor] = useState(null)
  const [pending, setPending] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const selected = book.addresses.find(a => a.id === selectedId) || book.addresses.find(a => a.id === book.default_address_id)
  const errorMessage = code => (messages[code] || messages['address-request-failed'])[vi ? 0 : 1]

  useEffect(() => {
    if (!loading && onSelect) onSelect(loadError ? null : selected || null)
  }, [loading, loadError, selected, onSelect])
  useEffect(() => { onReady?.(!loading && !loadError && !busy && !editor && !pending && !chooserOpen) }, [loading, loadError, busy, editor, pending, chooserOpen, onReady])

  const closeEditor = () => { if (!busy) { setEditor(null); setError('') } }
  const openEditor = address => {
    setError(''); setNotice('')
    setEditor({ id: address?.id || null, initial: address || { name: user?.user_metadata?.name || '', email: user?.email || '' }, makeDefault: !book.addresses.length || address?.id === book.default_address_id })
  }
  async function perform(operation) {
    setError(''); setNotice('')
    try {
      const result = await mutate(operation)
      if (!result) return
      if (operation.action === 'save' && onSelect) onSelect(result.addresses.find(a => a.id === result.saved_address_id))
      setEditor(null); setPending(null)
      setNotice(vi ? 'Đã lưu thay đổi địa chỉ.' : 'Address changes saved.')
    } catch (failure) {
      setError(errorMessage(failure.message))
      // A stale confirmation must be reviewed again against the refreshed list.
      if (['NB_ADDRESS_CONFLICT', 'NB_ADDRESS_NOT_FOUND'].includes(failure.message)) setPending(null)
    }
  }
  function save(e) {
    e.preventDefault()
    const data = new FormData(e.currentTarget)
    try {
      const address = validateAddress(Object.fromEntries(data))
      const makeDefault = editor.id === book.default_address_id || !book.addresses.length || data.get('makeDefault') === 'on'
      const operation = { action: 'save', address, id: editor.id, makeDefault, expectedRevision: book.revision }
      setEditor(current => ({ ...current, initial: address, makeDefault }))
      setError('')
      if (needsDefaultConfirmation(book, editor.id, makeDefault)) setPending(operation)
      else perform(operation)
    } catch (failure) { setError(errorMessage(failure.message)) }
  }

  const addressList = <>
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 id="address-book-heading" className="font-display text-xl uppercase">{vi ? 'Địa chỉ nhận hàng' : 'Delivery addresses'}</h2><span className="text-xs text-slate">{book.addresses.length}/{MAX_ADDRESSES} {vi ? 'địa chỉ' : 'addresses'}</span></div>
    <p className="mt-3 text-xs leading-6 text-slate">{vi ? 'Lưu tối đa 5 địa chỉ, gồm 1 địa chỉ mặc định.' : 'Save up to 5 addresses, including one default.'}{onSelect && (vi ? ' Chọn địa chỉ giao hàng cho đơn này bên dưới.' : ' Select the delivery address for this order.')}</p>
    {loading && <p role="status" className="mt-5 text-sm">{vi ? 'Đang tải địa chỉ…' : 'Loading addresses…'}</p>}
    {loadError && <div role="alert" className="mt-5 border border-red-200 p-4 text-sm text-red-700"><p>{errorMessage(loadError)}</p><button type="button" onClick={reload} className="mt-3 underline">{vi ? 'Thử lại' : 'Retry'}</button></div>}
    {!loading && !loadError && <>
      {!book.addresses.length && <p className="mt-5 border border-dashed border-feather p-5 text-sm text-slate">{vi ? 'Bạn chưa có địa chỉ. Địa chỉ đầu tiên sẽ được lưu làm mặc định.' : 'No saved addresses. Your first address will become the default.'}</p>}
      <div className="mt-5 space-y-3">{book.addresses.map(address => {
        const isDefault = address.id === book.default_address_id
        return <article key={address.id} className={`border p-4 sm:p-5 ${onSelect && selected?.id === address.id ? 'border-obsidian bg-alabaster' : 'border-feather'}`}>
          <div className="flex items-start gap-3">{onSelect && <input type="radio" name="delivery-address" aria-label={`${vi ? 'Giao đến' : 'Deliver to'} ${address.address}, ${address.city}`} checked={selected?.id === address.id} onChange={() => onSelect(address)} disabled={busy} className="mt-1.5 h-4 w-4 shrink-0 accent-obsidian" />}<div className="min-w-0 flex-1"><AddressDetails address={address} />{isDefault && <span className="mt-2 inline-block border border-champagne px-2 py-1 text-[10px] text-champagne">{vi ? 'Mặc định' : 'Default'}</span>}</div></div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-feather pt-3"><label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={isDefault} disabled={busy || isDefault} onChange={() => { setError(''); setNotice(''); setPending({ action: 'default', id: address.id, address, expectedRevision: book.revision }) }} className="h-4 w-4 accent-obsidian" />{vi ? 'Đặt làm địa chỉ mặc định' : 'Set as default address'}</label><div className="flex gap-4 text-xs"><button type="button" disabled={busy} onClick={() => openEditor(address)} className="underline underline-offset-4">{vi ? 'Sửa' : 'Edit'}</button><button type="button" disabled={busy} onClick={() => { setError(''); setNotice(''); setPending({ action: 'delete', id: address.id, address, expectedRevision: book.revision }) }} className="text-red-700 underline underline-offset-4">{vi ? 'Xóa' : 'Delete'}</button></div></div>
        </article>
      })}</div>
      <button type="button" disabled={busy || book.addresses.length >= MAX_ADDRESSES} onClick={() => openEditor(null)} className="button mt-5 disabled:cursor-not-allowed disabled:opacity-40">{vi ? '+ Thêm địa chỉ mới' : '+ Add new address'}</button>
      {book.addresses.length >= MAX_ADDRESSES && <p className="mt-2 text-xs leading-6 text-slate">{vi ? 'Đã đủ 5 địa chỉ. Bạn có thể sửa hoặc xóa địa chỉ hiện có.' : 'All 5 slots are filled. You can edit or delete an existing address.'}</p>}
    </>}
    {!editor && !pending && error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
    {notice && <p role="status" className="mt-4 text-sm text-slate">{notice}</p>}
    {popupOnly && <button type="button" disabled={loading || !!loadError || busy || !selected} onClick={() => setChooserOpen(false)} className="button mt-6 w-full bg-obsidian text-white disabled:opacity-40">{vi ? 'Xác nhận địa chỉ' : 'Confirm address'}</button>}
  </>

  return <section aria-label={vi ? 'Địa chỉ nhận hàng' : 'Delivery address'}>
    {popupOnly ? <>
      <h2 className="font-display text-xl uppercase">{vi ? 'Địa chỉ nhận hàng' : 'Delivery address'}</h2>
      {!loading && !loadError && selected && <div className="mt-4 border border-feather p-4"><AddressDetails address={selected} />{selected.id === book.default_address_id && <p className="mt-2 text-xs text-slate">{vi ? 'Mặc định' : 'Default'}</p>}</div>}
      <button type="button" disabled={busy} onClick={() => setChooserOpen(true)} className="button mt-5">{vi ? 'Chọn địa chỉ' : 'Choose address'}</button>
      {loading && <p role="status" className="mt-3 text-sm text-slate">{vi ? 'Đang tải địa chỉ…' : 'Loading addresses…'}</p>}
      {loadError && <p role="alert" className="mt-3 text-sm text-red-700">{errorMessage(loadError)}</p>}
      {chooserOpen && !editor && !pending && <Popup title={vi ? 'Chọn địa chỉ' : 'Choose address'} busy={busy} close={() => setChooserOpen(false)}>{addressList}</Popup>}
    </> : addressList}
    {editor && !pending && <Popup title={editor.id ? (vi ? 'Sửa địa chỉ' : 'Edit address') : (vi ? 'Thêm địa chỉ mới' : 'Add new address')} close={closeEditor} busy={busy}><form onSubmit={save}><fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2">{[
      ['name', vi ? 'Họ và tên' : 'Full name', 'text', 'name'],
      ['email', 'Email', 'email', 'email'],
      ['phone', vi ? 'Số điện thoại' : 'Phone number', 'tel', 'tel'],
      ['city', vi ? 'Tỉnh / Thành phố' : 'City / Province', 'text', 'address-level1'],
      ['address', vi ? 'Số nhà, đường, phường/xã' : 'Street address', 'text', 'street-address'],
    ].map(([name, label, type, auto]) => <label key={name} className={`text-sm ${name === 'address' ? 'sm:col-span-2' : ''}`}>{label} <span aria-hidden="true" className="text-red-700">*</span><input name={name} type={type} autoComplete={auto} defaultValue={normalizeInputSpacing(editor.initial[name] || '')} required maxLength={name === 'address' ? 300 : name === 'phone' ? 10 : 120} minLength={name === 'phone' ? 10 : undefined} inputMode={name === 'phone' ? 'numeric' : undefined} pattern={name === 'phone' ? '0[0-9]{9}' : name === 'email' ? '[^\\s@]+@[^\\s@]+\\.[^\\s@]+' : '.*\\S.*'} onInput={name === 'phone' ? e => { e.currentTarget.value = e.currentTarget.value.replace(/[^0-9]/g, '').slice(0, 10) } : normalizeSpacingEvent} className="shop-input mt-2 w-full" />{name === 'phone' && <span className="mt-1 block text-xs text-slate">{vi ? 'Nhập 10 chữ số, bắt đầu bằng 0 (ví dụ: 0901234567).' : 'Enter 10 digits starting with 0 (e.g. 0901234567).'}</span>}</label>)}<label className="text-sm sm:col-span-2">{vi ? 'Ghi chú (không bắt buộc)' : 'Notes (optional)'}<textarea name="notes" defaultValue={normalizeInputSpacing(editor.initial.notes || '')} onInput={normalizeSpacingEvent} maxLength={500} rows={2} className="shop-input mt-2 w-full" /></label><label className="flex items-center gap-2 text-sm sm:col-span-2"><input name="makeDefault" type="checkbox" defaultChecked={editor.makeDefault} disabled={!book.addresses.length || editor.id === book.default_address_id} className="h-4 w-4 accent-obsidian" />{vi ? 'Đặt làm địa chỉ mặc định' : 'Set as default address'}</label></fieldset>{error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}<button type="submit" disabled={busy} className="button mt-6 w-full bg-obsidian text-white disabled:opacity-50">{busy ? (vi ? 'Đang lưu…' : 'Saving…') : (vi ? 'Lưu địa chỉ' : 'Save address')}</button></form></Popup>}
    {pending && <Popup title={pending.action === 'delete' ? (vi ? 'Xóa địa chỉ?' : 'Delete address?') : (vi ? 'Đổi địa chỉ mặc định?' : 'Change default address?')} busy={busy} close={() => { setPending(null); setError('') }}>
      <AddressDetails address={pending.address} />
      <p className="mt-4 text-sm leading-6">{pending.action === 'delete' ? (vi ? 'Địa chỉ này sẽ bị xóa khỏi tài khoản.' : 'This address will be removed from your account.') : (vi ? 'Địa chỉ này sẽ trở thành mặc định. Địa chỉ mặc định hiện tại vẫn được giữ trong danh sách.' : 'This will become your default. Your current default will remain in your address book.')}</p>
      {pending.action === 'delete' && pending.id === book.default_address_id && <div className="mt-4 border border-feather p-4 text-sm leading-6">{book.addresses.length > 1 ? <><p className="mb-2">{vi ? 'Địa chỉ sau sẽ trở thành mặc định:' : 'The following address will become the default:'}</p><AddressDetails address={book.addresses.find(a => a.id !== pending.id)} /></> : <p>{vi ? 'Đây là địa chỉ cuối cùng. Bạn cần thêm địa chỉ mới trước khi đặt hàng.' : 'This is your last address. Add a new address before placing an order.'}</p>}</div>}
      {error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row"><button type="button" disabled={busy} onClick={() => { setPending(null); setError('') }} className="button">{vi ? 'Hủy' : 'Cancel'}</button><button type="button" disabled={busy} onClick={() => perform(pending)} className="button bg-obsidian text-white disabled:opacity-50">{busy ? (vi ? 'Đang lưu…' : 'Saving…') : (vi ? 'Xác nhận' : 'Confirm')}</button></div>
    </Popup>}
  </section>
}
