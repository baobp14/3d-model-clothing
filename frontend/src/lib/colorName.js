export function colorName(product, color, lang) {
  if (!color) return ''
  return product.colorNames?.[color]?.[lang] || (lang === 'vi' ? 'Chưa có tên màu' : 'Color name unavailable')
}
