// Spec 6.8 GET /d — DEMO_MENU_ID로 302. env가 없으면 정적 사본(/m/demo)이 있으면 그쪽, 아니면 /.
import { DEMO_MENU_ID } from '@/lib/server/env';
import { readStaticDemo } from '@/lib/server/menus';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const id = DEMO_MENU_ID();
  let target = '/';
  if (id) target = `/m/${id}`;
  else if (await readStaticDemo()) target = '/m/demo';
  return new Response(null, { status: 302, headers: { Location: new URL(target, req.url).toString(), 'Cache-Control': 'no-store' } });
}
