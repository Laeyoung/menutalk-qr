// Spec 6.3 POST /api/menus/{id}/localize — (언어 1개, 묶음 1개) 현지화. 저장하지 않는다.
import { callStructured } from '@/lib/openai/structured';
import { menuLocalizationSchema, zLang, zLocalization, zLocalizeInputItem } from '@/lib/schemas';
import { EFFORT, flags, MODELS } from '@/lib/server/env';
import { ApiError, errorResponse, isDemoRequest } from '@/lib/server/http';
import { requireAdmin } from '@/lib/server/menus';
import { mapUpstream } from '@/lib/server/upstream';
import type { LangCode, LocalizedItem } from '@/lib/types';
import { localizeInstructions } from '@/prompts/localize';
import demoLocales from '@/fixtures/demo-locales.json';
import { z } from 'zod';

export const runtime = 'nodejs';
export const maxDuration = 60;

const zBody = z.object({
  lang: z.string(),
  items: z.array(zLocalizeInputItem).min(1).max(10),
  fixture: z.boolean().optional(),
});

type DemoLocales = { items: Record<string, Partial<Record<LangCode, Omit<LocalizedItem, 'item_id'>>>> };

export async function POST(req: Request, ctx: RouteContext<'/api/menus/[id]/localize'>) {
  try {
    const { id } = await ctx.params;
    const draft = await requireAdmin(req, id);
    const parsed = zBody.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new ApiError(400, 'BAD_REQUEST', 'Invalid body', false, parsed.error.issues.slice(0, 5));
    const langP = zLang.safeParse(parsed.data.lang);
    if (!langP.success) throw new ApiError(400, 'UNSUPPORTED_LANG', 'Unsupported language');
    const lang = langP.data;
    const items = parsed.data.items;

    const draftIds = new Set(draft.items.map((i) => i.item_id));
    const unknown = items.filter((i) => !draftIds.has(i.item_id)).map((i) => i.item_id);
    if (unknown.length) throw new ApiError(400, 'UNKNOWN_ITEM', 'Unknown item_id', false, { unknown });

    // fixture 번역(DECISIONS D-06): 사람이 쓴 데모 현지화로 응답. 모델 호출 없음.
    if (parsed.data.fixture) {
      if (!(isDemoRequest(req) || flags.isDev() || draft.source.fixture)) throw new ApiError(403, 'DEMO_ONLY', 'fixture requires x-demo-key');
      const table = (demoLocales as unknown as DemoLocales).items;
      const missing: string[] = [];
      const out: LocalizedItem[] = [];
      for (const it of items) {
        // 이름을 고친 항목은 draft 원래 이름으로 찾는다(데모 번역은 원래 이름 기준)
        const original = draft.items.find((d) => d.item_id === it.item_id)?.name_ko ?? '';
        const loc = table[it.name_ko]?.[lang] ?? table[original]?.[lang];
        if (!loc) missing.push(it.item_id);
        else out.push({ item_id: it.item_id, ...loc, ...(lang === 'ko' ? { name: it.name_ko } : {}) });
      }
      if (missing.length) throw new ApiError(422, 'FIXTURE_MISSING', 'No fixture localization for some items', false, { missing });
      return Response.json({ lang, items: out, meta: { latencyMs: 0, outputTokens: 0, fixture: true } });
    }

    if (!flags.hasOpenAiKey()) throw new ApiError(503, 'MODEL_UNAVAILABLE', 'OpenAI key is not configured');
    const effort = EFFORT.localize;
    let r;
    try {
      r = await callStructured({
        kind: 'localize',
        model: MODELS.localize,
        effort,
        instructions: localizeInstructions(lang),
        input: [{ type: 'input_text', text: JSON.stringify({ items }) }],
        schemaName: 'menu_localization',
        schema: menuLocalizationSchema as unknown as Record<string, unknown>,
        maxOutputTokens: effort === 'none' ? 16_000 : 25_000,
        zod: zLocalization,
        timeoutMs: 55_000,
      });
    } catch (e) {
      throw mapUpstream(e);
    }

    // id 매칭은 코드가 검사한다(Spec 8.4). 입력 순서대로, 없는 것은 오류.
    const byId = new Map(r.data.items.map((i) => [i.item_id, i]));
    const missing = items.filter((i) => !byId.has(i.item_id)).map((i) => i.item_id);
    if (missing.length) throw new ApiError(502, 'UPSTREAM_INCOMPLETE', 'Model skipped some items', true, { missing });
    // 한국어는 메뉴명을 번역하지 않는다: 가게가 쓴 이름(name_ko)을 그대로 쓴다
    const out = items.map((i) => (lang === 'ko' ? { ...byId.get(i.item_id)!, name: i.name_ko } : byId.get(i.item_id)!));

    return Response.json({ lang, items: out, meta: { latencyMs: r.latencyMs, outputTokens: r.usage.output_tokens ?? null } });
  } catch (e) {
    return errorResponse(e);
  }
}
