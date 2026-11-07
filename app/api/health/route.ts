// Spec 6.8 GET /api/health — OpenAI 호출은 하지 않는다
import { blobMode } from '@/lib/blob-json';
import { DEMO_MENU_ID, flags } from '@/lib/server/env';
import { loadPublished } from '@/lib/server/menus';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const demoId = DEMO_MENU_ID();
  let demoMenu: 'published' | 'static' | 'missing' | 'unset' = 'unset';
  if (demoId) {
    const r = await loadPublished(demoId).catch(() => null);
    demoMenu = r ? (r.source === 'blob' ? 'published' : 'static') : 'missing';
  }
  return Response.json(
    {
      ok: true,
      openaiKey: flags.hasOpenAiKey(),
      blob: blobMode() === 'vercel',
      blobMode: blobMode(),
      demoMenu,
      createEnabled: flags.createEnabled(),
      orderModelEnabled: flags.orderModelEnabled(),
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
