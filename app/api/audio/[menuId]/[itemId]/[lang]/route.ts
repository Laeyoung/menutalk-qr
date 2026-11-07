// Spec 6.6 GET /api/audio/{menuId}/{itemId}/{lang}?h={tts_hash}
// head → 있으면 302, 없으면 TTS 생성·저장 후 302. TTS 입력은 저장된 tts_text로만 만든다.
import { paths } from '@/lib/blob-json';
import { isLangCode } from '@/lib/lang';
import { errorResponse, ApiError } from '@/lib/server/http';
import { loadPublished } from '@/lib/server/menus';
import { getOrCreateSpeech } from '@/lib/tts';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET(req: Request, ctx: RouteContext<'/api/audio/[menuId]/[itemId]/[lang]'>) {
  try {
    const { menuId, itemId, lang } = await ctx.params;
    if (!isLangCode(lang)) throw new ApiError(404, 'ITEM_NOT_FOUND', 'Unknown language');
    const r = await loadPublished(menuId);
    const loc = r?.menu.locales[lang]?.[itemId];
    if (!r || !loc) throw new ApiError(404, 'ITEM_NOT_FOUND', 'Item not found');
    // ?h=는 캐시 무효화용. 값이 달라도 거절하지 않고 현재 텍스트 기준으로 처리한다.
    let url: string;
    try {
      url = await getOrCreateSpeech({ key: paths.audio(r.menu.menu_id, itemId, lang, loc.tts_hash), text: loc.tts_text });
    } catch (e) {
      console.error('tts failed', e instanceof Error ? e.message : e);
      throw new ApiError(502, 'TTS_FAILED', 'TTS failed', true);
    }
    const location = url.startsWith('/') ? new URL(url, req.url).toString() : url;
    return new Response(null, { status: 302, headers: { Location: location, 'Cache-Control': 'public, max-age=86400' } });
  } catch (e) {
    return errorResponse(e);
  }
}
