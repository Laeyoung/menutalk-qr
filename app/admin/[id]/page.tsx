import type { Metadata } from 'next';
import { AdminEditor } from './admin-editor';

export const metadata: Metadata = { title: '메뉴 확인·공개 — 메뉴톡 QR', robots: { index: false } };

export default async function AdminPage(props: PageProps<'/admin/[id]'>) {
  const { id } = await props.params;
  return <AdminEditor menuId={id} />;
}
