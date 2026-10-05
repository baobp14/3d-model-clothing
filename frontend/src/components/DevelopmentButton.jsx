import { useState } from 'react'
import { useLang } from '../i18n'
import Popup from './Popup'

export default function DevelopmentButton({ children, feature = '3d', ...props }) {
  const [open, setOpen] = useState(false)
  const { lang } = useLang()
  const vi = lang === 'vi'
  return <>
    <button {...props} type="button" onClick={() => setOpen(true)}>{children}</button>
    {open && <Popup title={vi ? 'Đang phát triển' : 'Under development'} close={() => setOpen(false)}>
      <p className="text-sm leading-7">{feature === '3d' ? (vi ? 'Tính năng 3D đang được phát triển. Vui lòng quay lại sau.' : 'The 3D feature is under development. Please check back later.') : (vi ? 'Tính năng này đang được phát triển. Vui lòng quay lại sau.' : 'This feature is under development. Please check back later.')}</p>
      <button type="button" onClick={() => setOpen(false)} className="button mt-6 w-full bg-obsidian text-white">{vi ? 'Đã hiểu' : 'Got it'}</button>
    </Popup>}
  </>
}
