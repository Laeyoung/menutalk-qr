import { describe, expect, it } from 'vitest';
import fixture from '../fixtures/demo-menu.draft.json';
import demoLocales from '../fixtures/demo-locales.json';
import overrides from '../fixtures/demo-overrides.json';
import { computeConflicts, conflictLevel } from '../lib/allergy';
import { resolveLang } from '../lib/lang';
import { buildRuleCard } from '../lib/order/rule-card';
import { buildPublished, normalizeExtractedItems, validatePublish } from '../lib/publish';
import { zExtraction } from '../lib/schemas';
import { buildTtsText, normalizeName } from '../lib/tts-text';
import { LANGS, type LangCode, type LocalizedItem, type MenuItemBase } from '../lib/types';

function demoMenu(langs: LangCode[] = [...LANGS]) {
  const items: MenuItemBase[] = normalizeExtractedItems(zExtraction.parse(fixture).items).map((i) => {
    const o = (overrides.items as Record<string, { allergens: string[]; allergens_source: string }>)[i.name_ko];
    return o ? { ...i, allergens: o.allergens as MenuItemBase['allergens'], allergens_source: 'store_confirmed' } : i;
  });
  const table = demoLocales.items as Record<string, Record<string, Omit<LocalizedItem, 'item_id'>>>;
  const locales: Record<string, LocalizedItem[]> = {};
  for (const l of langs) locales[l] = items.map((i) => ({ item_id: i.item_id, ...table[i.name_ko][l] }));
  return { items, locales, published: buildPublished('abcdefghjk', { store_name: '테스트' }, { langs, items, locales }) };
}

describe('fixtures', () => {
  it('every fixture item has all 5 localizations', () => {
    const table = demoLocales.items as Record<string, Record<string, unknown>>;
    for (const it of fixture.items) for (const l of LANGS) expect(table[it.name_ko]?.[l], `${it.name_ko}/${l}`).toBeTruthy();
  });
  it('normalizes extraction: ids, spice numbers, ai_estimated', () => {
    const items = normalizeExtractedItems(zExtraction.parse(fixture).items);
    expect(items[0].item_id).toBe('i01');
    expect(items[15].item_id).toBe('i16');
    expect(typeof items[0].spice_level).toBe('number');
    expect(items.every((i) => i.allergens_source === 'ai_estimated')).toBe(true);
  });
});

describe('allergy conflicts (Spec 5.3)', () => {
  const { published } = demoMenu();
  const bibim = published.items.find((i) => i.name_ko === '비빔밥')!;
  const jeyuk = published.items.find((i) => i.name_ko === '제육볶음')!;

  it('store_confirmed → red, ai_estimated → orange', () => {
    expect(conflictLevel(bibim, ['sesame'])).toBe('red');
    expect(conflictLevel(jeyuk, ['sesame'])).toBe('orange');
    expect(conflictLevel(bibim, ['peanut'])).toBeNull();
  });

  it('cart conflict message in Korean and guest language', () => {
    const r = computeConflicts(published, [bibim.item_id], ['sesame'], 'zh-Hans');
    expect(r.conflicts).toHaveLength(1);
    expect(r.conflicts[0].message_ko).toBe('가게 확인: 비빔밥에 참깨가 들어갑니다');
    expect(r.conflicts[0].message_local).toContain('芝麻');
    expect(r.conflicts[0].message_local).toContain('店家确认');
  });

  it('empty cart → whole menu scope, confirmed first', () => {
    const r = computeConflicts(published, [], ['sesame'], 'en');
    expect(r.scope).toBe('whole_menu');
    expect(r.conflicts.length).toBeGreaterThan(2);
    expect(r.conflicts[0].source).toBe('store_confirmed');
  });

  it('never says safe: confirmed-without-hit is listed separately, estimated is not', () => {
    const naeng = published.items.find((i) => i.name_ko === '물냉면')!; // confirmed, no sesame
    const r = computeConflicts(published, [naeng.item_id, jeyuk.item_id], ['peanut'], 'en');
    expect(r.conflicts).toHaveLength(0);
    expect(r.confirmed_clear_item_ids).toEqual([naeng.item_id]);
  });

  it('other is ignored for conflicts', () => {
    expect(computeConflicts(published, [bibim.item_id], ['other'], 'en').conflicts).toHaveLength(0);
  });
});

describe('rule card (Spec S6/8.5)', () => {
  const { published } = demoMenu();
  const bibim = published.items.find((i) => i.name_ko === '비빔밥')!;
  it('builds Korean card with requests, alert, conflict, back translation', () => {
    const c = buildRuleCard({ menu: published, lang: 'ja', cart: [{ itemId: bibim.item_id, qty: 1 }], chips: ['less_spicy'], guestAllergens: ['sesame'] });
    expect(c.mode).toBe('rule');
    expect(c.lines_ko).toEqual([{ item_id: bibim.item_id, text_ko: '비빔밥', qty: 1 }]);
    expect(c.requests_ko).toEqual(['덜 맵게 해 주세요']);
    expect(c.allergy_alert_ko).toBe('참깨 알레르기가 있어요');
    expect(c.conflicts[0].source).toBe('store_confirmed');
    expect(c.back_translation).toContain('辛さ控えめ');
    expect(c.back_translation).toContain('ごまアレルギー');
    expect(c.fallback_note).toBeNull();
  });
  it('fallback note when model failed', () => {
    const c = buildRuleCard({ menu: published, lang: 'en', cart: [], chips: [], guestAllergens: [], fallback: true });
    expect(c.fallback_note).toMatch(/could not/);
  });
});

describe('tts_text (Spec 5.2)', () => {
  it('normalizes bracketed names', () => {
    expect(normalizeName('プデチゲ（部隊チゲ）', 'ja')).toBe('プデチゲ、部隊チゲ');
    expect(normalizeName('Budae-jjigae (Army Stew)', 'en')).toBe('Budae-jjigae, Army Stew');
    expect(normalizeName('Soju', 'en')).toBe('Soju');
  });
  it('joins name, short, detail and respects limits', () => {
    const t = buildTtsText({ name: 'Bibimbap (Mixed Rice)', short: 'Rice with vegetables ★', detail: 'Warm rice. ' + 'Very long sentence here. '.repeat(20) }, 'en');
    expect(t.startsWith('Bibimbap, Mixed Rice. Rice with vegetables.')).toBe(true);
    expect(t.length).toBeLessThanOrEqual(260);
    expect(t).not.toContain('★');
    const j = buildTtsText({ name: 'ビビンバ', short: 'ナムル', detail: 'あ'.repeat(200) }, 'ja');
    expect([...j].length).toBeLessThanOrEqual(130);
  });
});

describe('publish validation (Spec 6.4)', () => {
  it('accepts full body and computes tts hash', () => {
    const { items, locales, published } = demoMenu(['en', 'ja']);
    expect(validatePublish({ items }, { langs: ['en', 'ja'], items, locales })).toEqual({ ok: true });
    const loc = published.locales.en![items[0].item_id];
    expect(loc.tts_hash).toMatch(/^[0-9a-f]{8}$/);
    expect(loc.tts_text).toContain('Bibimbap');
  });
  it('reports missing locales and items', () => {
    const { items, locales } = demoMenu(['en']);
    const r = validatePublish({ items }, { langs: ['en', 'ja'], items: items.slice(1), locales });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.details.missingItems).toEqual(['i01']);
      expect(r.details.missingLocales?.ja?.length).toBe(15);
    }
  });
});

describe('language resolution (AC-20)', () => {
  const all = [...LANGS];
  it('maps browser languages', () => {
    expect(resolveLang(['ja-JP'], all)).toBe('ja');
    expect(resolveLang(['zh-TW'], all)).toBe('zh-Hant');
    expect(resolveLang(['zh-CN'], all)).toBe('zh-Hans');
    expect(resolveLang(['ko-KR', 'en-US'], all)).toBe('en');
    expect(resolveLang(['es-MX'], all)).toBe('es');
    expect(resolveLang(['fr-FR'], all)).toBe('en');
    expect(resolveLang(['es-ES'], ['en', 'ja', 'zh-Hans'])).toBe('en');
  });
});
