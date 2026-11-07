// Spec 6.7 POST /api/order-card — 모델 모드(텍스트 또는 음성). 규칙 모드는 브라우저에서만.
import { buildAllergyAlertKo, computeConflicts } from '@/lib/allergy';
import { isAllergenCode, type AllergenCode } from '@/lib/allergens';
import { CHIP_KO, TRANSCRIBE_LANG } from '@/lib/i18n/strings';
import { isLangCode } from '@/lib/lang';
import { callStructured } from '@/lib/openai/structured';
import { newCardId } from '@/lib/order/rule-card';
import { orderCardSchema, zOrderModel } from '@/lib/schemas';
import { EFFORT, flags, MODELS } from '@/lib/server/env';
import { ApiError, errorResponse } from '@/lib/server/http';
import { loadPublished } from '@/lib/server/menus';
import { mapUpstream } from '@/lib/server/upstream';
import { transcribe } from '@/lib/transcribe';
import { CHIP_CODES, type CartLine, type ChipCode, type OrderCard, type PublishedMenu } from '@/lib/types';
import { orderInstructions, TRANSCRIBE_PROMPT } from '@/prompts/order';

export const runtime = 'nodejs';
export const maxDuration = 60;

const MAX_AUDIO = 1024 * 1024;
const AUDIO_EXT = ['mp4', 'webm', 'm4a', 'mp3', 'wav'];

function parseJson<T>(v: FormDataEntryValue | null, fallback: T): T {
  if (typeof v !== 'string' || !v) return fallback;
  try {
    return JSON.parse(v) as T;
  } catch {
    return fallback;
  }
}

function compactMenu(menu: PublishedMenu, lang: string): string {
  const loc = menu.locales[lang as keyof PublishedMenu['locales']] ?? {};
  return menu.items.map((i) => `${i.item_id}|${i.name_ko}|${loc[i.item_id]?.name ?? ''}|${i.category}|spice${i.spice_level}`).join('\n');
}

export async function POST(req: Request) {
  const started = Date.now();
  try {
    if (!flags.orderModelEnabled()) throw new ApiError(503, 'MODEL_DISABLED', 'Model mode disabled');
    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      throw new ApiError(400, 'BAD_REQUEST', 'multipart/form-data required');
    }
    const menuId = String(form.get('menuId') ?? '');
    const lang = String(form.get('lang') ?? '');
    if (!isLangCode(lang)) throw new ApiError(400, 'UNSUPPORTED_LANG', 'Unsupported language');
    const r = await loadPublished(menuId);
    if (!r) throw new ApiError(404, 'MENU_NOT_FOUND', 'Menu not found');
    const menu = r.menu;

    const cart = parseJson<CartLine[]>(form.get('cart'), []).filter((c) => c && typeof c.itemId === 'string').slice(0, 30);
    const chips = parseJson<string[]>(form.get('chips'), []).filter((c): c is ChipCode => (CHIP_CODES as readonly string[]).includes(c));
    const chipAllergens = parseJson<string[]>(form.get('guestAllergens'), []).filter(isAllergenCode);
    const text = typeof form.get('text') === 'string' ? String(form.get('text')).trim() : '';
    if ([...text].length > 300) throw new ApiError(400, 'TEXT_TOO_LONG', 'Text must be 300 characters or less');
    const file = form.get('file');
    const mime = typeof form.get('mime') === 'string' ? String(form.get('mime')) : '';

    if (!flags.hasOpenAiKey()) throw new ApiError(503, 'MODEL_UNAVAILABLE', 'OpenAI key is not configured');

    let transcript: string | null = null;
    let sttMs: number | undefined;
    if (file && typeof file !== 'string') {
      if (file.size > MAX_AUDIO) throw new ApiError(400, 'AUDIO_TOO_LARGE', 'Audio must be 1MB or smaller');
      const ext = (file.name.split('.').pop() || '').toLowerCase();
      if (!AUDIO_EXT.includes(ext)) throw new ApiError(400, 'UNSUPPORTED_AUDIO', 'Unsupported audio format');
      const loc = menu.locales[lang] ?? {};
      const keywords = menu.items.map((i) => loc[i.item_id]?.name?.replace(/[（(].*?[）)]/g, '').trim() || '').filter(Boolean);
      try {
        const t = await transcribe({
          file: Buffer.from(await file.arrayBuffer()),
          fileName: `req.${ext}`,
          mime: mime || file.type,
          languages: [TRANSCRIBE_LANG[lang]],
          prompt: TRANSCRIBE_PROMPT,
          keywords,
        });
        transcript = t.text;
        sttMs = t.latencyMs;
      } catch (e) {
        throw mapUpstream(e);
      }
      if (!transcript) throw new ApiError(422, 'EMPTY_TRANSCRIPT', 'Empty transcript');
    }
    const utterance = [transcript, text].filter(Boolean).join(' / ');
    if (!utterance) throw new ApiError(400, 'NO_INPUT', 'text or file is required');

    const input = [
      `MENU:\n${compactMenu(menu, lang)}`,
      `CART: ${JSON.stringify(cart.map((c) => ({ item_id: c.itemId, qty: c.qty })))}`,
      `CHIPS: ${JSON.stringify(chips.map((c) => `${c} (${CHIP_KO[c]})`))}`,
      `UTTERANCE: ${utterance}`,
    ].join('\n\n');

    let m;
    try {
      m = await callStructured({
        kind: 'order_card',
        model: MODELS.order,
        effort: EFFORT.order,
        instructions: orderInstructions(lang),
        input: [{ type: 'input_text', text: input }],
        schemaName: 'order_card',
        schema: orderCardSchema as unknown as Record<string, unknown>,
        maxOutputTokens: EFFORT.order === 'none' ? 4000 : 25_000,
        zod: zOrderModel,
        timeoutMs: 30_000,
      });
    } catch (e) {
      throw mapUpstream(e);
    }

    // 서버 후처리: 실제 id인지 확인, 아니면 null + unmatched_note
    const ids = new Set(menu.items.map((i) => i.item_id));
    const unmatched: string[] = [];
    const lines_ko = m.data.lines_ko.map((l) => {
      if (l.item_id && !ids.has(l.item_id)) {
        unmatched.push(l.text_ko);
        return { ...l, item_id: null };
      }
      if (l.item_id) return { ...l, text_ko: menu.items.find((i) => i.item_id === l.item_id)!.name_ko };
      return l;
    });
    const guest: AllergenCode[] = [...new Set([...chipAllergens, ...m.data.guest_allergens])];
    const targets = lines_ko.map((l) => l.item_id).filter((x): x is string => Boolean(x));
    const cr = computeConflicts(menu, targets, guest, lang);

    const card: OrderCard = {
      card_id: newCardId(),
      lang,
      transcript,
      lines_ko,
      requests_ko: m.data.requests_ko,
      allergy_alert_ko: buildAllergyAlertKo(guest, m.data.allergy_note_ko),
      conflicts: cr.conflicts,
      confirmed_clear_item_ids: cr.confirmed_clear_item_ids,
      conflicts_scope: cr.scope,
      back_translation: m.data.back_translation,
      unmatched_note: [m.data.unmatched_note, ...unmatched].filter(Boolean).join(' / ') || null,
      mode: 'model',
      latency_ms: { stt: sttMs, llm: m.latencyMs, total: Date.now() - started },
    };
    return Response.json(card);
  } catch (e) {
    return errorResponse(e);
  }
}
