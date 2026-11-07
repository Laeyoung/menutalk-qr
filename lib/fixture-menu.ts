// 데모 정답표(prep/02-talking-menu-qr/demo-menu.draft.json 복사본)를 MenuItemBase[]로 정규화한다.
// 정답표는 이미 Spec 5.2 MenuItemBase 모양(item_id, 숫자 맵기)이다. 가게 확인값은 overrides에만 있으므로
// 여기서는 모두 ai_estimated로 둔다(prep README "정답표를 읽는 법").
import { z } from 'zod';
import overridesJson from '@/fixtures/demo-overrides.json';
import draftJson from '@/fixtures/demo-menu.draft.json';
import localesJson from '@/fixtures/demo-locales.json';
import { zAllergen, zCategory, zSpice } from './schemas';
import type { MenuItemBase } from './types';

const zFixtureItem = z.object({
  item_id: z.string().regex(/^i\d{2,3}$/),
  name_ko: z.string().min(1),
  price_krw: z.number().int().nullable(),
  price_note: z.string().nullable(),
  category: zCategory,
  section_ko: z.string().nullable(),
  spice_level: zSpice,
  main_ingredients_ko: z.array(z.string()),
  allergens: z.array(zAllergen),
  confidence: z.enum(['high', 'medium', 'low']).default('high'),
  unreadable_note: z.string().nullable().default(null),
});

const zFixture = z.object({ store_name: z.string().nullable(), warnings: z.array(z.string()), items: z.array(zFixtureItem).min(1) });

export interface FixtureDraft {
  store_name: string | null;
  warnings: string[];
  items: MenuItemBase[];
}

export function loadFixtureDraft(raw: unknown = draftJson): FixtureDraft {
  const f = zFixture.parse(raw);
  const ids = new Set<string>();
  for (const it of f.items) {
    if (ids.has(it.item_id)) throw new Error(`duplicate item_id ${it.item_id}`);
    ids.add(it.item_id);
  }
  return {
    store_name: f.store_name,
    warnings: f.warnings,
    items: f.items.map((it) => ({ ...it, allergens: [...new Set(it.allergens)], allergens_source: 'ai_estimated' as const })),
  };
}

const zOverrides = z.object({
  match: z.literal('name_ko'),
  items: z.record(z.string(), z.object({ allergens: z.array(zAllergen), allergens_source: z.enum(['ai_estimated', 'store_confirmed']) })),
});

/** name_ko 기준으로 가게 확인값을 적용한다(지시서 3장). 적용 뒤에는 item_id로 처리한다. */
export function applyOverrides(items: MenuItemBase[], raw: unknown = overridesJson): MenuItemBase[] {
  const o = zOverrides.parse(raw);
  const unknown = Object.keys(o.items).filter((name) => !items.some((i) => i.name_ko === name));
  if (unknown.length) throw new Error(`overrides for unknown menu: ${unknown.join(', ')}`);
  return items.map((i) => {
    const hit = o.items[i.name_ko];
    return hit ? { ...i, allergens: [...new Set(hit.allergens)], allergens_source: hit.allergens_source } : i;
  });
}

/** Guuey 도구가 쓰는 한끼식당 데이터: 정답표 + 가게 확인값 + 영어 메뉴명 */
export function buildHankkiToolMenu(locales: { items: Record<string, { en?: { name: string } }> } = localesJson as never): import('./menu-tools').ToolMenu {
  const d = loadFixtureDraft();
  const items = applyOverrides(d.items).map((i) => ({
    item_id: i.item_id,
    name_ko: i.name_ko,
    price_krw: i.price_krw,
    price_note: i.price_note,
    category: i.category,
    section_ko: i.section_ko,
    spice_level: i.spice_level,
    main_ingredients_ko: i.main_ingredients_ko,
    allergens: i.allergens,
    allergens_source: i.allergens_source,
    name_en: locales.items[i.name_ko]?.en?.name ?? null,
  }));
  return { store_name: d.store_name ?? '한끼식당', items };
}
