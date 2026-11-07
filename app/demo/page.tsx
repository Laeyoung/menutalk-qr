import type { Metadata } from 'next';
import { DemoConsole } from './demo-console';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: '발표자 콘솔 — 메뉴톡 QR', robots: { index: false } };

export default function DemoPage() {
  return <DemoConsole demoMenuId={process.env.DEMO_MENU_ID || ''} />;
}
