// Guuey 작업지시서 10장 수용 기준 중 순수 계산 도구 부분
import { describe, expect, it } from 'vitest';
import draft from '../fixtures/demo-menu.draft.json';
import { applyOverrides, buildHankkiToolMenu, loadFixtureDraft } from '../lib/fixture-menu';
import { buildOrderCard, checkDietaryConstraints, searchMenu, ToolInputError, type ToolMenu } from '../lib/menu-tools';

const menu = buildHankkiToolMenu();
const byName = (n: string) => menu.items.find((i) => i.name_ko === n)!;

function expectToolError(fn: () => unknown, code: string) {
  try {
    fn();
  } catch (e) {
    expect(e).toBeInstanceOf(ToolInputError);
    expect((e as ToolInputError).code).toBe(code);
    return;
  }
  throw new Error('expected ToolInputError ' + code);
}

describe('data (AC: 18 items, unique ids, 3 overrides)', () => {
  it('has 18 unique items and exactly 3 store-confirmed overrides', () => {
    expect(menu.items).toHaveLength(18);
    expect(new Set(menu.items.map((i) => i.item_id)).size).toBe(18);
    expect(menu.items.filter((i) => i.allergens_source === 'store_confirmed').map((i) => i.name_ko).sort()).toEqual(['부대찌개', '비빔밥', '해물파전']);
    expect(menu.store_name).toBe('한끼식당');
  });
  it('부대찌개 confirmed list keeps fish and shrimp (not the short Spec example)', () => {
    expect(byName('부대찌개').allergens).toEqual(expect.arrayContaining(['fish', 'shrimp', 'pork', 'wheat', 'soy', 'milk']));
  });
  it('rejects duplicate ids and unknown override names', () => {
    const dup = structuredClone(draft) as { items: { item_id: string }[] };
    dup.items[1].item_id = dup.items[0].item_id;
    expect(() => loadFixtureDraft(dup)).toThrow(/duplicate/);
    expect(() => applyOverrides(loadFixtureDraft().items, { match: 'name_ko', items: { 없는메뉴: { allergens: [], allergens_source: 'store_confirmed' } } })).toThrow(/unknown menu/);
  });
});

describe('search_menu', () => {
  it('filters per-item budget and reports unknown prices separately', () => {
    const r = searchMenu(menu, { maxPriceKrw: 10000 });
    expect(r.items.every((i) => i.priceKrw !== null && i.priceKrw <= 10000)).toBe(true);
    expect(r.items.some((i) => i.nameKo === '비빔밥')).toBe(true);
    expect(r.items.some((i) => i.nameKo === '갈비탕')).toBe(false);
    expect(r.priceUnknownItems.map((i) => i.nameKo)).toEqual(['낙지볶음']);
    expect(r.budgetInterpretation).toMatch(/per item/);
  });
  it('finds by English name and returns evidence', () => {
    const r = searchMenu(menu, { query: 'bibimbap' });
    expect(r.items[0].nameKo).toBe('비빔밥');
    expect(r.items[0].priceKrw).toBe(9000);
    expect(r.items[0].allergensSource).toBe('store_confirmed');
  });
});

describe('check_dietary_constraints', () => {
  it('sesame + 비빔밥 → conflict, store confirmed, staff confirmation', () => {
    const r = checkDietaryConstraints(menu, { itemIds: [byName('비빔밥').item_id], allergies: ['sesame'] });
    expect(r.items[0].conflicts).toEqual(['sesame']);
    expect(r.items[0].allergensSource).toBe('store_confirmed');
    expect(r.items[0].requiresStaffConfirmation).toBe(true);
  });
  it('AI-estimated item without a hit is never declared safe', () => {
    const r = checkDietaryConstraints(menu, { itemIds: [byName('갈비탕').item_id], allergies: ['peanut'] });
    expect(r.items[0].conflicts).toEqual([]);
    expect(r.items[0].allergensSource).toBe('ai_estimated');
    expect(r.items[0].requiresStaffConfirmation).toBe(true);
    expect(r.items[0].reason).toMatch(/Do not assume it is safe/);
  });
  it('unknown allergen info (test copy) requires staff confirmation and is labelled unknown', () => {
    const copy: ToolMenu = structuredClone(menu);
    const kimbap = copy.items.find((i) => i.name_ko === '계란말이')!;
    kimbap.allergens = [];
    const r = checkDietaryConstraints(copy, { itemIds: [kimbap.item_id], allergies: ['egg'] });
    expect(r.items[0].allergensSource).toBe('unknown');
    expect(r.items[0].requiresStaffConfirmation).toBe(true);
    expect(r.items[0].reason).toMatch(/Do not assume it is safe/);
  });
  it('rejects unknown ids and allergen codes', () => {
    expectToolError(() => checkDietaryConstraints(menu, { itemIds: ['i99'], allergies: [] }), 'UNKNOWN_ITEM');
    expectToolError(() => checkDietaryConstraints(menu, { itemIds: ['i01'], allergies: ['sesame-seed'] }), 'UNKNOWN_ALLERGEN');
  });
});

describe('build_order_card', () => {
  const bibim = () => byName('비빔밥').item_id;
  it('1 bibimbap = 9,000원, 2 = 18,000원', () => {
    expect(buildOrderCard(menu, { items: [{ itemId: bibim(), quantity: 1 }] }).totalKrw).toBe(9000);
    expect(buildOrderCard(menu, { items: [{ itemId: bibim(), quantity: 2 }] }).totalKrw).toBe(18000);
  });
  it('sesame conflict → staff_confirmation_required with Korean warning', () => {
    const c = buildOrderCard(menu, { items: [{ itemId: bibim(), quantity: 1 }], allergies: ['sesame'] });
    expect(c.status).toBe('staff_confirmation_required');
    expect(c.conflicts[0]).toMatchObject({ allergen: 'sesame', source: 'store_confirmed', messageKo: '가게 확인: 비빔밥에 참깨가 들어갑니다' });
    expect(c.cardTextKo).toContain('직원 확인 필요');
    expect(c.cardTextKo).not.toContain('주문 확정됨');
  });
  it('"참깨 빼 주세요" request does not remove the conflict', () => {
    const c = buildOrderCard(menu, { items: [{ itemId: bibim(), quantity: 1 }], allergies: ['sesame'], requests: ['참깨 빼 주세요'] });
    expect(c.conflicts).toHaveLength(1);
    expect(c.status).toBe('staff_confirmation_required');
    expect(c.cardTextKo).toContain('손님 요청(가게 확인 필요)');
  });
  it('no conflict → request_only, never "order placed"', () => {
    const c = buildOrderCard(menu, { items: [{ itemId: byName('콜라').item_id, quantity: 2 }] });
    expect(c.status).toBe('request_only');
    expect(c.cardTextKo).toContain('주문 접수 아님');
    expect(c.totalKrw).toBe(4000);
  });
  it('unknown price → total cannot be confirmed', () => {
    const c = buildOrderCard(menu, { items: [{ itemId: byName('낙지볶음').item_id, quantity: 1 }, { itemId: bibim(), quantity: 1 }] });
    expect(c.totalKrw).toBeNull();
    expect(c.cardTextKo).toContain('확정 불가');
  });
  it('merges duplicate ids then checks the cap', () => {
    expect(buildOrderCard(menu, { items: [{ itemId: bibim(), quantity: 2 }, { itemId: bibim(), quantity: 3 }] }).lines[0].quantity).toBe(5);
    expectToolError(() => buildOrderCard(menu, { items: [{ itemId: bibim(), quantity: 6 }, { itemId: bibim(), quantity: 5 }] }), 'BAD_QUANTITY');
  });
  it('rejects missing menu, bad ids and 0 / negative / fractional / over-cap quantities', () => {
    expectToolError(() => buildOrderCard(menu, { items: [{ itemId: 'i99', quantity: 1 }] }), 'UNKNOWN_ITEM');
    for (const q of [0, -1, 1.5, 11]) expectToolError(() => buildOrderCard(menu, { items: [{ itemId: bibim(), quantity: q }] }), 'BAD_QUANTITY');
  });
  it('recomputes on a second turn: "make it two" keeps the item and conflict', () => {
    const turn1 = buildOrderCard(menu, { items: [{ itemId: bibim(), quantity: 1 }], allergies: ['sesame'] });
    const turn2 = buildOrderCard(menu, { items: [{ itemId: turn1.lines[0].itemId, quantity: 2 }], allergies: turn1.allergies });
    expect(turn2.lines[0]).toMatchObject({ nameKo: '비빔밥', quantity: 2, subtotalKrw: 18000 });
    expect(turn2.conflicts).toHaveLength(1);
  });
});
