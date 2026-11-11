import type { Metadata } from 'next';
import './globals.css';
import './login-theme.css';
export const metadata: Metadata = { title: 'Live Hub', description: 'ศูนย์จัดการงานไลฟ์ของทีม' };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}
