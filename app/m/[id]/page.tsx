// Spec S4: 서버 컴포넌트가 published.json을 읽어 렌더. 실패 + 데모 메뉴면 정적 사본(AC-27).
import { loadPublished } from '@/lib/server/menus';
import type { Metadata } from 'next';
import { GuestMenu } from './guest-menu';

export const dynamic = 'force-dynamic';

export async function generateMetadata(props: PageProps<'/m/[id]'>): Promise<Metadata> {
  const { id } = await props.params;
  const r = await loadPublished(id).catch(() => null);
  return { title: r?.menu.store_name ? `${r.menu.store_name} — Menu` : 'Menu', robots: { index: false } };
}

export default async function MenuPage(props: PageProps<'/m/[id]'>) {
  const { id } = await props.params;
  const r = await loadPublished(id).catch(() => null);
  if (!r) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
        <p className="text-xl font-bold">메뉴를 찾을 수 없어요</p>
        <p className="text-muted">Menu not found · メニューが見つかりません · 找不到菜单</p>
      </main>
    );
  }
  return <GuestMenu menu={r.menu} source={r.source} />;
}
