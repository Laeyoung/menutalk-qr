// Spec 6.5 GET /api/menus/{id} — 공개 메뉴(클라이언트 재조회용)
import { errorResponse } from '@/lib/server/http';
import { loadPublished } from '@/lib/server/menus';

export const runtime = 'nodejs';

export async function GET(_req: Request, ctx: RouteContext<'/api/menus/[id]'>) {
  try {
    const { id } = await ctx.params;
    const r = await loadPublished(id, { fresh: true });
    if (!r) {
      return Response.json({ error: { code: 'MENU_NOT_FOUND', message: 'Menu not found', retryable: false } }, { status: 404, headers: { 'Cache-Control': 'no-store' } });
    }
    return Response.json(r.menu, { headers: { 'Cache-Control': 'no-store', 'x-menu-source': r.source } });
  } catch (e) {
    return errorResponse(e);
  }
}
