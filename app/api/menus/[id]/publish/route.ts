// Spec 6.4 POST /api/menus/{id}/publish — 브라우저가 가진 최신 상태 전부를 받아 published.json을 쓴다
import { paths, writeJson } from '@/lib/blob-json';
import { buildPublished, validatePublish } from '@/lib/publish';
import { zPublishBody } from '@/lib/schemas';
import { DEMO_MENU_ID, siteOrigin } from '@/lib/server/env';
import { ApiError, errorResponse } from '@/lib/server/http';
import { requireAdmin } from '@/lib/server/menus';
import type { LangCode, MenuItemBase } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: Request, ctx: RouteContext<'/api/menus/[id]/publish'>) {
  try {
    const { id } = await ctx.params;
    const draft = await requireAdmin(req, id);
    const parsed = zPublishBody.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      throw new ApiError(400, 'INVALID_PUBLISH', 'Invalid publish body', false, { issues: parsed.error.issues.slice(0, 10).map((i) => ({ path: i.path.join('.'), message: i.message })) });
    }
    const body = {
      storeName: parsed.data.storeName ?? null,
      langs: parsed.data.langs as LangCode[],
      items: parsed.data.items as MenuItemBase[],
      locales: parsed.data.locales,
    };
    const check = validatePublish(draft, body);
    if (!check.ok) throw new ApiError(400, 'INVALID_PUBLISH', 'Missing items or localizations', false, check.details);

    const published = buildPublished(id, draft, body);
    await writeJson(paths.published(id), published, { overwrite: true, maxAge: 60 });

    const origin = siteOrigin(req);
    const publicUrl = `${origin}/m/${id}`;
    const shortUrl = id === DEMO_MENU_ID() ? `${origin.replace(/^https?:\/\//, '')}/d` : publicUrl.replace(/^https?:\/\//, '');
    return Response.json({ publicUrl, shortUrl, rev: published.rev, published });
  } catch (e) {
    return errorResponse(e);
  }
}
