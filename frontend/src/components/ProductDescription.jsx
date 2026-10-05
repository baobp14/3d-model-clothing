import { useLang } from '../i18n'
import { colors } from '../data/products'
import { getProductDescription } from '../data/productDescriptions'

export default function ProductDescription({ product, className = '', productColors = colors }) {
  const { lang } = useLang()
  return <p className={`whitespace-pre-wrap break-words text-xs leading-6 text-stone ${className}`}>{getProductDescription(product, lang, productColors)}</p>
}
