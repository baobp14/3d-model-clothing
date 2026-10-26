import { useLang } from '../i18n'
import { colors } from '../data/products'
import { getProductDescription } from '../data/productDescriptions'

export default function ProductDescription({ product, className = 'text-body-sm text-ink', productColors = colors }) {
  const { lang } = useLang()
  return <p className={`whitespace-pre-wrap wrap-break-word leading-relaxed ${className}`}>{getProductDescription(product, lang, productColors)}</p>
}
