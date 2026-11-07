// Spec 6.4 publish 검증과 published.json 합본 생성(순수 함수, 서버 전용 사용)
import { createHash } from 'node:crypto';
import { buildTtsText } from './tts-text';
import type { LangCode, LocalizedItem, MenuDraft, MenuItemBase, PublishedLocalizedItem, PublishedMenu } from './types';

export function ttsHash(text: string): string {
  return createHash('sha256').update(text).digest('hex').slice(0, 8);
}

export interface PublishInput {
  storeName?: string | null;
  langs: LangCode[];
  items: MenuItemBase[];
  locales: Record<string, LocalizedItem[]>;
}

export type PublishCheck = { ok: true } | { ok: false; details: { missingItems?: string[]; extraItems?: string[]; missingLocales?: Record<string, string[]> } };

export function validatePublish(draft: Pick<MenuDraft, 'items'>, body: PublishInput): PublishCheck {
  const draftIds = new Set(draft.items.map((i) => i.item_id));
  const bodyIds = new Set(body.items.map((i) => i.item_id));
  const missingItems = [...draftIds].filter((id) => !bodyIds.has(id));
  const extraItems = [...bodyIds].filter((id) => !draftIds.has(id));
  const missingLocales: Record<string, string[]> = {};
  for (const lang of new Set(body.langs)) {
    const have = new Set((body.locales[lang] ?? []).map((l) => l.item_id));
    const miss = [...bodyIds].filter((id) => !have.has(id));
    if (miss.length) missingLocales[lang] = miss;
  }
  if (missingItems.length || extraItems.length || Object.keys(missingLocales).length || bodyIds.size !== body.items.length) {
    return { ok: false, details: { missingItems, extraItems, missingLocales } };
  }
  return { ok: true };
}

export function buildPublished(menuId: string, draft: Pick<MenuDraft, 'store_name'>, body: PublishInput, now = new Date()): PublishedMenu {
  const langs = [...new Set(body.langs)];
  const locales: PublishedMenu['locales'] = {};
  const itemIds = new Set(body.items.map((i) => i.item_id));
  for (const lang of langs) {
    const map: Record<string, PublishedLocalizedItem> = {};
    for (const loc of body.locales[lang] ?? []) {
      if (!itemIds.has(loc.item_id)) continue;
      const tts_text = buildTtsText(loc, lang);
      map[loc.item_id] = {
        item_id: loc.item_id,
        name: loc.name,
        short: loc.short,
        detail: loc.detail,
        how_to_eat: loc.how_to_eat,
        tts_text,
        tts_hash: ttsHash(tts_text),
      };
    }
    locales[lang] = map;
  }
  return {
    menu_id: menuId,
    store_name: body.storeName ?? draft.store_name ?? null,
    published_at: now.toISOString(),
    rev: Math.floor(now.getTime() / 1000),
    langs,
    items: body.items.map((i) => ({
      item_id: i.item_id,
      name_ko: i.name_ko,
      price_krw: i.price_krw,
      price_note: i.price_note,
      category: i.category,
      section_ko: i.section_ko,
      spice_level: i.spice_level,
      main_ingredients_ko: i.main_ingredients_ko,
      allergens: [...new Set(i.allergens)],
      allergens_source: i.allergens_source,
    })),
    locales,
  };
}

/** 모델 추출 결과 → MenuItemBase[] (spice 문자열→숫자, item_id i01부터, allergens_source 모두 ai_estimated) */
export function normalizeExtractedItems(
  items: {
    name_ko: string; price_krw: number | null; price_note: string | null; category: MenuItemBase['category'];
    section_ko: string | null; spice_level: '0' | '1' | '2' | '3'; main_ingredients_ko: string[];
    allergens: MenuItemBase['allergens']; confidence: MenuItemBase['confidence']; unreadable_note: string | null;
  }[],
): MenuItemBase[] {
  return items.map((it, idx) => ({
    item_id: 'i' + String(idx + 1).padStart(2, '0'),
    name_ko: it.name_ko.trim().slice(0, 60),
    price_krw: it.price_krw,
    price_note: it.price_note,
    category: it.category,
    section_ko: it.section_ko,
    spice_level: Number(it.spice_level) as MenuItemBase['spice_level'],
    main_ingredients_ko: it.main_ingredients_ko.slice(0, 20).map((s) => s.slice(0, 30)),
    allergens: [...new Set(it.allergens)],
    allergens_source: 'ai_estimated',
    confidence: it.confidence,
    unreadable_note: it.unreadable_note,
  }));
}
