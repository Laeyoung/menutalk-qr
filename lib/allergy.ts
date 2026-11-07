// Spec 5.3 알레르기 충돌 계산. 브라우저(규칙 카드·카드 띠)와 서버(모델 카드)가 같은 함수를 쓴다.
// 원칙: 판단은 코드가 한다. 교집합이 없어도 "안전"이라고 쓰지 않는다.
import { ALLERGENS, type AllergenCode } from './allergens';
import {
  allergyAlertKo,
  allergyAlertLocal,
  conflictKo,
  conflictLocal,
  OTHER_ALLERGEN_KO,
} from './i18n/strings';
import type { LangCode, OrderConflict, PublishedItem, PublishedMenu } from './types';

export function itemConflicts(item: Pick<PublishedItem, 'allergens'>, guest: Iterable<AllergenCode>): AllergenCode[] {
  const g = new Set(guest);
  return item.allergens.filter((a) => g.has(a) && a !== 'other');
}

/** 카드 띠 색: 가게 확인 = red, AI 추정 = orange, 없음 = null */
export function conflictLevel(item: PublishedItem, guest: Iterable<AllergenCode>): 'red' | 'orange' | null {
  if (itemConflicts(item, guest).length === 0) return null;
  return item.allergens_source === 'store_confirmed' ? 'red' : 'orange';
}

export function localName(menu: PublishedMenu, itemId: string, lang: LangCode): string {
  const loc = menu.locales[lang]?.[itemId];
  const item = menu.items.find((i) => i.item_id === itemId);
  return loc?.name ?? item?.name_ko ?? itemId;
}

export interface ConflictResult {
  conflicts: OrderConflict[];
  confirmed_clear_item_ids: string[];
  scope: 'cart' | 'whole_menu';
}

/**
 * 대상 메뉴(카드에 들어간 메뉴)와 손님 알레르기의 충돌을 계산한다.
 * 대상 메뉴가 없으면 전체 메뉴를 보고 "이 가게에서 주의할 메뉴"로 돌려준다.
 */
export function computeConflicts(
  menu: PublishedMenu,
  targetItemIds: string[],
  guestAllergens: AllergenCode[],
  lang: LangCode,
): ConflictResult {
  const guest = guestAllergens.filter((a) => a !== 'other');
  const scope = targetItemIds.length > 0 ? 'cart' : 'whole_menu';
  const ids = scope === 'cart' ? [...new Set(targetItemIds)] : menu.items.map((i) => i.item_id);
  const conflicts: OrderConflict[] = [];
  const clear: string[] = [];
  if (guest.length === 0) return { conflicts, confirmed_clear_item_ids: clear, scope };

  for (const id of ids) {
    const item = menu.items.find((i) => i.item_id === id);
    if (!item) continue;
    const hits = itemConflicts(item, guest);
    if (hits.length === 0) {
      if (scope === 'cart' && item.allergens_source === 'store_confirmed') clear.push(id);
      continue;
    }
    for (const a of hits) {
      conflicts.push({
        item_id: id,
        allergen: a,
        source: item.allergens_source,
        message_ko: conflictKo(item.allergens_source, item.name_ko, ALLERGENS[a].names.ko),
        message_local: conflictLocal[lang](item.allergens_source, localName(menu, id, lang), ALLERGENS[a].names[lang]),
      });
    }
  }
  // 가게 확인(빨강)을 먼저 보여 준다
  conflicts.sort((x, y) => (x.source === y.source ? 0 : x.source === 'store_confirmed' ? -1 : 1));
  return { conflicts, confirmed_clear_item_ids: clear, scope };
}

/** allergy_alert_ko: 손님 알레르기 코드마다 사전 문장 + 모델의 allergy_note_ko */
export function buildAllergyAlertKo(guest: AllergenCode[], note?: string | null): string | null {
  const parts = [...new Set(guest)].map((a) => (a === 'other' ? OTHER_ALLERGEN_KO : allergyAlertKo(ALLERGENS[a].names.ko)));
  if (note && note.trim()) parts.push(note.trim());
  return parts.length ? parts.join(' / ') : null;
}

export function buildAllergyAlertLocal(guest: AllergenCode[], lang: LangCode): string[] {
  return [...new Set(guest)].filter((a) => a !== 'other').map((a) => allergyAlertLocal[lang](ALLERGENS[a].names[lang]));
}
