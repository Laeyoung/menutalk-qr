// 규칙 모드 주문 카드(Spec S6·8.5): 칩·담기·내 알레르기만으로 브라우저에서 즉시 만든다(네트워크 0건).
import { buildAllergyAlertKo, buildAllergyAlertLocal, computeConflicts, localName } from '../allergy';
import type { AllergenCode } from '../allergens';
import { BACK_PREFIX, CHIP_KO, CHIP_LOCAL, t } from '../i18n/strings';
import type { CartLine, ChipCode, LangCode, OrderCard, PublishedMenu } from '../types';

export function newCardId(): string {
  return 'c_' + Math.random().toString(36).slice(2, 6);
}

export function buildRuleCard(args: {
  menu: PublishedMenu;
  lang: LangCode;
  cart: CartLine[];
  chips: ChipCode[];
  guestAllergens: AllergenCode[];
  fallback?: boolean;
}): OrderCard {
  const started = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const { menu, lang, cart, chips, guestAllergens } = args;
  const lines = cart
    .filter((c) => menu.items.some((i) => i.item_id === c.itemId))
    .map((c) => ({
      item_id: c.itemId,
      text_ko: menu.items.find((i) => i.item_id === c.itemId)!.name_ko,
      qty: c.qty,
    }));
  const uniqChips = [...new Set(chips)];
  const requests_ko = uniqChips.map((c) => CHIP_KO[c]);
  const cr = computeConflicts(menu, lines.map((l) => l.item_id), guestAllergens, lang);

  const back: string[] = [
    ...cart.map((c) => `${localName(menu, c.itemId, lang)} ${c.qty}`),
    ...uniqChips.map((c) => CHIP_LOCAL[c][lang]),
    ...buildAllergyAlertLocal(guestAllergens, lang),
  ];

  const ended = typeof performance !== 'undefined' ? performance.now() : Date.now();
  return {
    card_id: newCardId(),
    lang,
    transcript: null,
    lines_ko: lines,
    requests_ko,
    allergy_alert_ko: buildAllergyAlertKo(guestAllergens),
    conflicts: cr.conflicts,
    confirmed_clear_item_ids: cr.confirmed_clear_item_ids,
    conflicts_scope: cr.scope,
    back_translation: BACK_PREFIX[lang] + (back.length ? back.join(' / ') : '—'),
    unmatched_note: null,
    fallback_note: args.fallback ? t('fallbackNote', lang) : null,
    mode: 'rule',
    latency_ms: { total: Math.round(ended - started) },
  };
}
