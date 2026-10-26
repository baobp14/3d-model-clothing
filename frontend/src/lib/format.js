// Định dạng tiền theo locale thay vì viết cứng vị trí ký hiệu (vi-VN cho ra "35.000.000 ₫").
const vnd = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' })

export function formatVnd(value) {
  const amount = Number(value)
  return vnd.format(Number.isFinite(amount) ? amount : 0)
}

// Tên cũ, dùng ở nhiều trang (kể cả admin).
export const formatPrice = formatVnd
