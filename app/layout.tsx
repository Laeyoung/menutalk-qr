import type { Metadata, Viewport } from 'next';
import './globals.css';

// next/font/google 제거: 오프라인 빌드·실행 대비, 시스템 글꼴 사용(Spec 12.2-3)
export const metadata: Metadata = {
  title: '메뉴톡 QR — 말하는 메뉴판',
  description: '한국어 메뉴판 사진 한 장으로 외국인용 다국어 음성 메뉴와 QR을 만듭니다.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#fffaf3',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-dvh flex flex-col">{children}</body>
    </html>
  );
}
