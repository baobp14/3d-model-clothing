import { useNavigate } from 'react-router-dom'
import { useWishlist } from '../hooks/useWishlist'
import { useLang } from '../i18n'
import Icon from './Icon'
import { loginPath } from '../lib/customerSession'

export default function WishlistButton({ productId, className = '' }) {
  const wishlist = useWishlist()
  const navigate = useNavigate()
  const { lang } = useLang()
  const vi = lang === 'vi'
  const saved = wishlist?.ids.includes(productId) || false
  return <button type="button" className={className} disabled={wishlist?.busy || wishlist?.loading} aria-pressed={saved}
    aria-label={saved ? (vi ? 'Bỏ yêu thích' : 'Remove from wishlist') : (vi ? 'Thêm vào yêu thích' : 'Save to wishlist')}
    onClick={async () => {
      if (!wishlist?.owner) { navigate(loginPath(`/product/${productId}`)); return }
      if (wishlist.error) { navigate('/account/wishlist'); return }
      if (!await wishlist.toggle(productId)) navigate('/account/wishlist')
    }}><Icon name="heart" size={20} className={saved ? 'fill-current' : ''} /></button>
}
