import type { Metadata, Viewport } from 'next';
import { Black_Han_Sans, Noto_Sans_KR, Roboto_Mono } from 'next/font/google';
import './globals.css';

// 행사 발표 테마와 같은 글꼴(DECISIONS D-14). next/font가 빌드 시 받아 셀프 호스팅하므로
// 런타임 외부 요청은 없다(Spec 9.4). 대신 빌드에는 네트워크가 필요하다.
const blackHan = Black_Han_Sans({ weight: '400', subsets: ['latin'], variable: '--font-black-han', display: 'swap', preload: false });
const noto = Noto_Sans_KR({ weight: ['400', '700'], subsets: ['latin'], variable: '--font-noto', display: 'swap', preload: false });
const robotoMono = Roboto_Mono({ weight: ['400', '700'], subsets: ['latin'], variable: '--font-roboto-mono', display: 'swap' });

export const metadata: Metadata = {
  title: '메뉴톡 QR — 말하는 메뉴판',
  description: '한국어 메뉴판 사진 한 장으로 외국인용 다국어 음성 메뉴와 QR을 만듭니다.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0b0b10',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="ko" className={`${blackHan.variable} ${noto.variable} ${robotoMono.variable} h-full antialiased`}>
      <body className="flex min-h-dvh flex-col">{children}</body>
    </html>
  );
}
