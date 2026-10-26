/** Khối giữ chỗ khi tải; nhấp nháy nhẹ (tắt khi giảm chuyển động nhờ khối reduced-motion toàn cục). */
export function Skeleton({ className = '' }) {
  return <div aria-hidden="true" className={`animate-[pulse-soft_1.6s_ease-in-out_infinite] bg-cream ${className}`} />
}

/** Trang đang tải: có nhãn cho trình đọc màn hình. */
export function PageSkeleton({ label }) {
  // min-h-svh: footer không lộ ra rồi bị đẩy xuống khi trang thật tải xong (tránh layout shift)
  return <main className="shop-shell min-h-svh" role="status" aria-busy="true">
    <span className="sr-only">{label}</span>
    <Skeleton className="h-4 w-40" />
    <Skeleton className="mt-6 h-10 w-2/3 max-w-md" />
    <div className="mt-10 grid grid-cols-2 gap-x-(--grid-gap-x) gap-y-(--grid-gap-y) md:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 4 }, (_, i) => <div key={i}><Skeleton className="aspect-product" /><Skeleton className="mt-4 h-3 w-3/4" /><Skeleton className="mt-2 h-3 w-1/3" /></div>)}
    </div>
  </main>
}
