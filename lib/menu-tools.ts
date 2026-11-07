// Guuey 작업지시서 6장 도구 계약: search_menu / check_dietary_constraints / build_order_card
// - 순수 함수(네트워크·Next 의존 없음). Guuey worker와 Next 앱이 같은 코드를 쓴다.
// - 가격·알레르기 비교·합계·카드 구성은 코드가 한다. 모델에게 맡기지 않는다.
// - 알 수 없는 메뉴 ID·알레르기 코드·잘못된 수량은 명시적으로 거절한다(ToolInputError).
import { z } from 'zod';
import { ALLERGENS, ALLERGEN_CODES, type AllergenCode } from './allergens';
import type { MenuItemBase } from './types';

export interface ToolMenuItem extends Omit<MenuItemBase, 'confidence' | 'unreadable_note'> {
  name_en?: string | null;
}

export interface ToolMenu {
  store_name: string;
  items: ToolMenuItem[];
}

export class ToolInputError extends Error {
  constructor(
    public code: 'UNKNOWN_ITEM' | 'UNKNOWN_ALLERGEN' | 'BAD_QUANTITY' | 'TOO_MANY_ITEMS' | 'BAD_INPUT',
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export const LIMITS = { maxQtyPerItem: 10, maxLines: 18, maxRequests: 5, maxRequestLen: 100, maxQueryLen: 60 };

export type AllergenInfoStatus = 'store_confirmed' | 'ai_estimated' | 'unknown';

/** 근거 표시: 가게 확인 / AI 추정 / 정보 없음(추정 목록이 비어 있음) */
export function allergenInfoStatus(item: ToolMenuItem): AllergenInfoStatus {
  if (item.allergens_source === 'store_confirmed') return 'store_confirmed';
  if (item.allergens.length === 0) return 'unknown';
  return 'ai_estimated';
}

const STATUS_KO: Record<AllergenInfoStatus, string> = { store_confirmed: '가게 확인', ai_estimated: 'AI 추정', unknown: '정보 없음' };
const STATUS_EN: Record<AllergenInfoStatus, string> = {
  store_confirmed: 'confirmed by the restaurant',
  ai_estimated: 'AI estimate, not confirmed by the restaurant',
  unknown: 'no allergen information',
};

function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const r = schema.safeParse(input ?? {});
  if (!r.success) {
    const issue = r.error.issues[0];
    if (issue && issue.path.some((p) => p === 'allergies')) {
      throw new ToolInputError('UNKNOWN_ALLERGEN', `Unknown allergen code. Use one of: ${ALLERGEN_CODES.join(', ')}`, r.error.issues.slice(0, 3));
    }
    if (issue && issue.path.some((p) => p === 'quantity')) {
      throw new ToolInputError('BAD_QUANTITY', `Quantity must be a whole number from 1 to ${LIMITS.maxQtyPerItem}`, r.error.issues.slice(0, 3));
    }
    throw new ToolInputError('BAD_INPUT', issue ? `${issue.path.join('.')}: ${issue.message}` : 'Invalid input', r.error.issues.slice(0, 3));
  }
  return r.data;
}

const zAllergies = z.array(z.enum(ALLERGEN_CODES)).max(23).default([]);

function findItem(menu: ToolMenu, id: string): ToolMenuItem {
  const it = menu.items.find((i) => i.item_id === id);
  if (!it) throw new ToolInputError('UNKNOWN_ITEM', `No menu item with id "${id}". Use search_menu to get valid ids.`, { itemId: id });
  return it;
}

function evidence(item: ToolMenuItem) {
  const status = allergenInfoStatus(item);
  return { allergensSource: status, allergensSourceKo: STATUS_KO[status], allergensSourceEn: STATUS_EN[status] };
}

// ---------------------------------------------------------------- search_menu
export const searchMenuInput = z.object({
  query: z.string().trim().max(LIMITS.maxQueryLen).optional(),
  maxPriceKrw: z.number().int().positive().max(10_000_000).optional(),
  maxSpiceLevel: z.number().int().min(0).max(3).optional(),
});

export function searchMenu(menu: ToolMenu, rawInput: unknown) {
  const input = parse(searchMenuInput, rawInput);
  const q = input.query?.toLowerCase();
  const matchesQuery = (i: ToolMenuItem) =>
    !q ||
    i.name_ko.toLowerCase().includes(q) ||
    (i.name_en ?? '').toLowerCase().includes(q) ||
    i.main_ingredients_ko.some((g) => g.toLowerCase().includes(q)) ||
    (i.section_ko ?? '').toLowerCase().includes(q) ||
    i.category === q;

  const matched: ReturnType<typeof present>[] = [];
  const priceUnknown: ReturnType<typeof present>[] = [];
  for (const i of menu.items) {
    if (!matchesQuery(i)) continue;
    if (input.maxSpiceLevel !== undefined && i.spice_level > input.maxSpiceLevel) continue;
    if (input.maxPriceKrw !== undefined) {
      if (i.price_krw === null) {
        priceUnknown.push(present(i));
        continue;
      }
      if (i.price_krw > input.maxPriceKrw) continue;
    }
    matched.push(present(i));
  }
  return {
    store: menu.store_name,
    budgetInterpretation:
      input.maxPriceKrw !== undefined
        ? `maxPriceKrw is applied per item (each dish ≤ ₩${input.maxPriceKrw.toLocaleString('en-US')}), not as a total budget. Ask the guest if they meant a total or per person.`
        : null,
    count: matched.length,
    items: matched,
    priceUnknownItems: priceUnknown,
    note: 'Allergen lists are ingredient data, not a safety guarantee. Cross-contact and ingredient removal must be confirmed by staff.',
  };
}

function present(i: ToolMenuItem) {
  return {
    itemId: i.item_id,
    nameKo: i.name_ko,
    nameEn: i.name_en ?? null,
    priceKrw: i.price_krw,
    priceNote: i.price_note,
    category: i.category,
    section: i.section_ko,
    spiceLevel: i.spice_level,
    mainIngredientsKo: i.main_ingredients_ko,
    allergens: i.allergens,
    ...evidence(i),
  };
}

// ---------------------------------------------------- check_dietary_constraints
export const checkDietaryInput = z.object({
  itemIds: z.array(z.string()).min(1).max(LIMITS.maxLines),
  allergies: zAllergies,
});

export interface ItemCheck {
  itemId: string;
  nameKo: string;
  conflicts: AllergenCode[];
  allergensSource: AllergenInfoStatus;
  allergensSourceKo: string;
  hasOtherIngredient: boolean;
  requiresStaffConfirmation: boolean;
  reason: string;
}

function checkItem(item: ToolMenuItem, allergies: AllergenCode[]): ItemCheck {
  const declared = allergies.filter((a) => a !== 'other');
  const conflicts = item.allergens.filter((a) => a !== 'other' && declared.includes(a));
  const status = allergenInfoStatus(item);
  const hasOther = item.allergens.includes('other');
  // 충돌이 있거나, 알레르기를 밝혔는데 가게가 확인하지 않은 정보이거나, '기타' 재료가 있으면 직원 확인
  const requiresStaffConfirmation = conflicts.length > 0 || (allergies.length > 0 && (status !== 'store_confirmed' || hasOther));
  let reason: string;
  if (conflicts.length) {
    reason = `Contains ${conflicts.map((a) => ALLERGENS[a].names.en.toLowerCase()).join(', ')} (${STATUS_EN[status]}).`;
  } else if (allergies.length === 0) {
    reason = 'No allergies declared. This is not a safety check.';
  } else if (status === 'store_confirmed') {
    reason = hasOther
      ? 'Not in the restaurant-confirmed list, but it has other ingredients outside the allergen codes. Ask staff.'
      : 'Not in the restaurant-confirmed allergen list. Cross-contact is still possible; ask staff.';
  } else if (status === 'unknown') {
    reason = 'No allergen information for this dish. Do not assume it is safe; ask staff.';
  } else {
    reason = 'Not in the AI-estimated list, which the restaurant has not confirmed. Do not assume it is safe; ask staff.';
  }
  return { itemId: item.item_id, nameKo: item.name_ko, conflicts, allergensSource: status, allergensSourceKo: STATUS_KO[status], hasOtherIngredient: hasOther, requiresStaffConfirmation, reason };
}

export function checkDietaryConstraints(menu: ToolMenu, rawInput: unknown) {
  const input = parse(checkDietaryInput, rawInput);
  const allergies = [...new Set(input.allergies)];
  const items = [...new Set(input.itemIds)].map((id) => checkItem(findItem(menu, id), allergies));
  return {
    allergies,
    items,
    anyConflict: items.some((i) => i.conflicts.length > 0),
    requiresStaffConfirmation: items.some((i) => i.requiresStaffConfirmation),
    note: 'An empty conflict list is not a safety guarantee.',
  };
}

// ---------------------------------------------------------- build_order_card
export const buildOrderCardInput = z.object({
  items: z
    .array(z.object({ itemId: z.string(), quantity: z.number().int().min(1).max(LIMITS.maxQtyPerItem) }))
    .min(1)
    .max(50),
  allergies: zAllergies,
  requests: z.array(z.string().trim().min(1).max(LIMITS.maxRequestLen)).max(LIMITS.maxRequests).default([]),
});

export type OrderCardStatus = 'request_only' | 'staff_confirmation_required';

export function buildOrderCard(menu: ToolMenu, rawInput: unknown) {
  const input = parse(buildOrderCardInput, rawInput);
  // 중복 ID는 합친 뒤 상한 검증
  const merged = new Map<string, number>();
  for (const l of input.items) merged.set(l.itemId, (merged.get(l.itemId) ?? 0) + l.quantity);
  if (merged.size > LIMITS.maxLines) throw new ToolInputError('TOO_MANY_ITEMS', `At most ${LIMITS.maxLines} different dishes per card`);
  for (const [id, qty] of merged) {
    findItem(menu, id);
    if (qty > LIMITS.maxQtyPerItem) throw new ToolInputError('BAD_QUANTITY', `Quantity for ${id} exceeds ${LIMITS.maxQtyPerItem} after merging duplicates`, { itemId: id, quantity: qty });
  }
  const allergies = [...new Set(input.allergies)];

  const lines = [...merged].map(([id, qty]) => {
    const it = findItem(menu, id);
    return {
      itemId: id,
      nameKo: it.name_ko,
      nameEn: it.name_en ?? null,
      quantity: qty,
      unitPriceKrw: it.price_krw,
      subtotalKrw: it.price_krw === null ? null : it.price_krw * qty,
      priceNote: it.price_note,
    };
  });
  const priceUnknown = lines.filter((l) => l.unitPriceKrw === null).map((l) => l.nameKo);
  const totalKrw = priceUnknown.length ? null : lines.reduce((s, l) => s + (l.subtotalKrw ?? 0), 0);

  // 카드 생성 시 충돌을 다시 계산한다(이전 대화의 판정을 믿지 않는다)
  const checks = lines.map((l) => checkItem(findItem(menu, l.itemId), allergies));
  const conflicts = checks.flatMap((c) =>
    c.conflicts.map((a) => ({
      itemId: c.itemId,
      allergen: a,
      source: c.allergensSource,
      messageKo:
        c.allergensSource === 'store_confirmed'
          ? `가게 확인: ${c.nameKo}에 ${ALLERGENS[a].names.ko}${josa(ALLERGENS[a].names.ko)} 들어갑니다`
          : `AI 추정: ${c.nameKo}에 ${ALLERGENS[a].names.ko}${josa(ALLERGENS[a].names.ko)} 들어갈 수 있습니다`,
      messageEn: `${c.allergensSource === 'store_confirmed' ? 'Restaurant confirmed' : 'AI estimate'}: ${lines.find((l) => l.itemId === c.itemId)?.nameEn ?? c.nameKo} contains ${ALLERGENS[a].names.en.toLowerCase()}`,
    })),
  );
  const needsConfirmation = checks.filter((c) => c.requiresStaffConfirmation && c.conflicts.length === 0).map((c) => ({ itemId: c.itemId, nameKo: c.nameKo, reason: c.reason }));
  const status: OrderCardStatus = conflicts.length > 0 ? 'staff_confirmation_required' : 'request_only';

  const allergyLinesKo = allergies.map((a) => (a === 'other' ? '기타 음식 알레르기가 있어요' : `${ALLERGENS[a].names.ko} 알레르기가 있어요`));
  const requestsKo = input.requests; // 자유 요청: 가게가 수락한 것으로 바꾸지 않는다

  const cardTextKo = [
    status === 'staff_confirmation_required' ? '⚠ 직원 확인 필요 (주문 확정 전)' : '주문 요청 (주문 접수 아님)',
    '',
    ...lines.map((l) => `· ${l.nameKo} ${l.quantity}개 — ${l.subtotalKrw === null ? (l.priceNote ?? '가격 미정') : `${l.subtotalKrw.toLocaleString('ko-KR')}원`}`),
    `합계: ${totalKrw === null ? `확정 불가 (${priceUnknown.join(', ')} 가격 미정)` : `${totalKrw.toLocaleString('ko-KR')}원`}`,
    ...(allergyLinesKo.length ? ['', ...allergyLinesKo.map((s) => `⚠ ${s}`)] : []),
    ...conflicts.map((c) => `⚠ ${c.messageKo}`),
    ...needsConfirmation.map((n) => `· ${n.nameKo}: 알레르기 정보를 직원에게 확인해 주세요`),
    ...(requestsKo.length ? ['', '손님 요청(가게 확인 필요):', ...requestsKo.map((r) => `· ${r}`)] : []),
  ].join('\n');

  return {
    status,
    statusKo: status === 'staff_confirmation_required' ? '직원 확인 필요' : '주문 요청',
    lines,
    totalKrw,
    totalNote: totalKrw === null ? `Total cannot be confirmed: price unknown for ${priceUnknown.join(', ')}` : null,
    allergies,
    allergyLinesKo,
    conflicts,
    needsConfirmation,
    requestsKo,
    cardTextKo,
    disclaimer: 'This card is a request for staff. No order has been placed or sent to the kitchen.',
  };
}

function josa(word: string): string {
  const c = word.charCodeAt(word.length - 1);
  if (c < 0xac00 || c > 0xd7a3) return '이(가)';
  return (c - 0xac00) % 28 === 0 ? '가' : '이';
}

export const TOOL_DEFINITIONS = [
  {
    name: 'search_menu',
    description:
      'Look up dishes on the 한끼식당 menu. Filter by free-text query (dish name in Korean or English, ingredient, section), maxPriceKrw (applied PER ITEM, not total) and maxSpiceLevel (0-3). Returns prices, ingredients, allergen codes and whether the allergen data is restaurant-confirmed, AI-estimated or unknown.',
    input: searchMenuInput,
  },
  {
    name: 'check_dietary_constraints',
    description:
      'Check chosen item ids against the guest allergies (allergen codes). Returns per-item conflicts, allergen data source and whether staff confirmation is required. An empty conflict list is NOT a safety guarantee.',
    input: checkDietaryInput,
  },
  {
    name: 'build_order_card',
    description:
      'Build the Korean card the guest shows to staff: dishes, quantities, unit prices, total, allergy warnings (recomputed here) and free-text requests. status is staff_confirmation_required when any allergen conflict exists, otherwise request_only. This does NOT place an order.',
    input: buildOrderCardInput,
  },
] as const;

export function runTool(menu: ToolMenu, name: string, input: unknown) {
  switch (name) {
    case 'search_menu':
      return searchMenu(menu, input);
    case 'check_dietary_constraints':
      return checkDietaryConstraints(menu, input);
    case 'build_order_card':
      return buildOrderCard(menu, input);
    default:
      throw new ToolInputError('BAD_INPUT', `Unknown tool ${name}`);
  }
}
