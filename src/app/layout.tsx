import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Đồ án tốt nghiệp — 3D Avatar & Try-on',
  description: 'Avatar 3D dựng từ số đo cơ thể, kèm mặc thử quần áo bằng texture 3D.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
