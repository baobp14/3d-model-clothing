import Link from 'next/link';

const PAGES = [
  ['/avatar-test', 'Avatar 3D', 'Dựng người theo số đo, kiểm tra sai số từng vòng.'],
  ['/garment-test', 'Mặc thử áo', 'Mesh áo thật theo bảng size, mô phỏng vải.'],
  ['/mask-test', 'Tách nền ảnh áo', 'Chạy hàm tách nền của phần mặc thử, soi mép cắt.'],
  ['/ai-shots', 'Ảnh người mẫu bằng AI', 'Từ ảnh áo trước/sau, tạo ảnh người mẫu mặc đúng món đó ở nhiều góc.'],
  ['/outfit-demo', 'Gợi ý phối đồ', 'Chọn một món, xem các món hợp nhất kèm lý do, mặc thử cả bộ 3D.'],
];

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-start justify-center gap-6 px-6">
      <h1 className="text-2xl font-semibold">Đồ án tốt nghiệp — Avatar 3D &amp; Try-on</h1>
      <ul className="w-full space-y-3">
        {PAGES.map(([href, title, note]) => (
          <li key={href}>
            <Link
              href={href}
              className="block rounded border border-stone-200 bg-white px-4 py-3 transition hover:border-stone-400"
            >
              <div className="font-medium">{title}</div>
              <div className="text-sm text-stone-500">{note}</div>
              <div className="mt-0.5 text-xs text-stone-400">{href}</div>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
