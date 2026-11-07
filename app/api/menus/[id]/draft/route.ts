// Spec 6.2 GET /api/menus/{id}/draft — S3 새로고침 복구용(원본 추출본)
import { errorResponse } from '@/lib/server/http';
import { requireAdmin } from '@/lib/server/menus';

export const runtime = 'nodejs';

export async function GET(req: Request, ctx: RouteContext<'/api/menus/[id]/draft'>) {
  try {
    const { id } = await ctx.params;
    const d = await requireAdmin(req, id);
    return Response.json({ store_name: d.store_name, warnings: d.warnings, items: d.items, source: { fixture: d.source.fixture } }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return errorResponse(e);
  }
}
