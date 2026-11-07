// Spec 6.8 POST /api/demo/warmup — 세 스키마로 최소 입력 호출 1회씩(새 스키마 첫 요청 지연 소진)
import { callStructured } from '@/lib/openai/structured';
import { menuExtractionSchema, menuLocalizationSchema, orderCardSchema, zExtraction, zLocalization, zOrderModel } from '@/lib/schemas';
import { EFFORT, flags, MODELS } from '@/lib/server/env';
import { ApiError, errorResponse, isDemoRequest } from '@/lib/server/http';
import { EXTRACT_INSTRUCTIONS } from '@/prompts/extract';
import { localizeInstructions } from '@/prompts/localize';
import { orderInstructions } from '@/prompts/order';

export const runtime = 'nodejs';
export const maxDuration = 120;

async function timed(fn: () => Promise<unknown>): Promise<number | string> {
  const s = Date.now();
  try {
    await fn();
    return Date.now() - s;
  } catch (e) {
    return 'error: ' + (e instanceof Error ? e.message.slice(0, 120) : 'unknown');
  }
}

export async function POST(req: Request) {
  try {
    if (!isDemoRequest(req)) throw new ApiError(401, 'BAD_DEMO_KEY', 'x-demo-key required');
    if (!flags.hasOpenAiKey()) throw new ApiError(503, 'MODEL_UNAVAILABLE', 'OpenAI key is not configured');
    const [extraction, localization, orderCard] = await Promise.all([
      timed(() =>
        callStructured({
          kind: 'warmup_extract', model: MODELS.extract, effort: EFFORT.extract, instructions: EXTRACT_INSTRUCTIONS,
          input: [{ type: 'input_text', text: '메뉴판 텍스트: 비빔밥 9,000' }],
          schemaName: 'menu_extraction', schema: menuExtractionSchema as unknown as Record<string, unknown>, maxOutputTokens: 25_000, zod: zExtraction,
        }),
      ),
      timed(() =>
        callStructured({
          kind: 'warmup_localize', model: MODELS.localize, effort: EFFORT.localize, instructions: localizeInstructions('en'),
          input: [{ type: 'input_text', text: JSON.stringify({ items: [{ item_id: 'i01', name_ko: '비빔밥', category: 'main', main_ingredients_ko: ['밥', '나물'], spice_level: 1 }] }) }],
          schemaName: 'menu_localization', schema: menuLocalizationSchema as unknown as Record<string, unknown>, maxOutputTokens: 16_000, zod: zLocalization,
        }),
      ),
      timed(() =>
        callStructured({
          kind: 'warmup_order', model: MODELS.order, effort: EFFORT.order, instructions: orderInstructions('en'),
          input: [{ type: 'input_text', text: 'MENU:\ni01|비빔밥|Bibimbap|main|spice1\n\nCART: []\n\nCHIPS: []\n\nUTTERANCE: One bibimbap please' }],
          schemaName: 'order_card', schema: orderCardSchema as unknown as Record<string, unknown>, maxOutputTokens: 4000, zod: zOrderModel,
        }),
      ),
    ]);
    return Response.json({ extraction, localization, orderCard });
  } catch (e) {
    return errorResponse(e);
  }
}
