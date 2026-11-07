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
  // 상담 링크는 서버 env에서 읽어 넘긴다(빌드 시 번들에 박히지 않게). 비밀값이 아닌 공개 공유 URL이다.
  return <GuestMenu menu={r.menu} source={r.source} consultUrl={process.env.GUUEY_SHARE_URL || null} />;
}
