'use client';
// Spec S7 주문 카드(전체 화면): 흰 배경, 한국어 큰 글씨, 알레르기 띠, 충돌 경고(한국어 + 손님 언어), 역번역
import { BACK_PREFIX, CONFIRMED_CLEAR_KO, t } from '@/lib/i18n/strings';
import type { OrderCard, PublishedMenu } from '@/lib/types';
import { useEffect } from 'react';

export function OrderCardView({ card, menu, onClose, onEdit }: { card: OrderCard; menu: PublishedMenu; onClose: () => void; onEdit: () => void }) {
  const lang = card.lang;
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);
  const confirmed = card.conflicts.filter((c) => c.source === 'store_confirmed');
  const estimated = card.conflicts.filter((c) => c.source === 'ai_estimated');
  // 단가·합계·상태는 build_order_card와 같은 규칙: 충돌이 있으면 "직원 확인 필요", 가격 미정이 있으면 합계 확정 불가
  const priced = card.lines_ko.map((l) => {
    const item = l.item_id ? menu.items.find((i) => i.item_id === l.item_id) : undefined;
    const unit = item ? item.price_krw : null;
    return { ...l, unit, subtotal: unit !== null && l.qty != null ? unit * l.qty : null };
  });
  const matched = priced.filter((l) => l.item_id);
  const total = matched.length && matched.every((l) => l.subtotal !== null) ? matched.reduce((a, l) => a + (l.subtotal ?? 0), 0) : null;
  const needsStaff = card.conflicts.length > 0;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-paper text-ink" role="dialog" aria-modal data-testid="order-card" data-mode={card.mode}>
      <div className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-5 px-5 pb-8 pt-5">
        <p className="text-center font-mono text-xs font-bold uppercase tracking-widest text-paper-muted">{t('showStaff', lang)} · 직원분께 보여 주세요</p>
        <div className={`rounded-2xl px-4 py-2 text-center text-base font-bold ${needsStaff ? 'bg-pink text-white' : 'bg-ink text-lime'}`} data-testid="card-status" data-status={needsStaff ? 'staff_confirmation_required' : 'request_only'}>
          <span lang="ko">{needsStaff ? '⚠ 직원 확인 필요 (주문 확정 전)' : '주문 요청 (주문 접수 아님)'}</span>
          <span className="ml-2 font-normal opacity-80">{t(needsStaff ? 'statusConfirm' : 'statusRequest', lang)}</span>
        </div>

        <div lang="ko" className="grid gap-3">
          {card.lines_ko.length > 0 ? (
            priced.map((l, i) => (
              <div key={i} className="flex flex-wrap items-baseline justify-between gap-x-3 font-display text-[38px] leading-tight sm:text-[48px]">
                <span>
                  {l.text_ko}
                  {l.qty != null && <span className="ml-3 text-paper-muted">{l.qty}개</span>}
                  {l.item_id === null && <span className="ml-2 align-middle font-sans text-base font-bold text-pink">(메뉴에 없음 · {t('noMatch', lang)})</span>}
                </span>
                {l.item_id && <span className="font-mono text-xl font-bold text-paper-muted">{l.subtotal !== null ? `${l.subtotal.toLocaleString('ko-KR')}원` : '시가'}</span>}
              </div>
            ))
          ) : null}
          {card.requests_ko.map((r, i) => (
            <div key={i} className="font-display text-[32px] leading-tight sm:text-[40px]">{r}</div>
          ))}
          {card.allergy_alert_ko && (
            <div className="rounded-3xl bg-pink px-5 py-4 font-display text-[32px] leading-tight text-white sm:text-[40px]" data-testid="allergy-alert">
              ⚠ {card.allergy_alert_ko}
            </div>
          )}
          {matched.length > 0 && (
            <div className="flex items-baseline justify-between border-t-2 border-ink/80 pt-2 text-2xl font-extrabold" data-testid="card-total">
              <span>합계 · {t('total', lang)}</span>
              <span className="font-mono">{total !== null ? `${total.toLocaleString('ko-KR')}원` : `확정 불가 · ${t('totalUnknown', lang)}`}</span>
            </div>
          )}
          {card.lines_ko.length === 0 && card.requests_ko.length === 0 && !card.allergy_alert_ko && <div className="font-display text-[32px] text-paper-muted">—</div>}
        </div>

        {card.conflicts.length > 0 && (
          <div className="grid gap-2" data-testid="conflicts">
            {card.conflicts_scope === 'whole_menu' && <p className="text-sm font-bold text-paper-muted">이 가게에서 주의할 메뉴 · {t('cautionMenus', lang)}</p>}
            {confirmed.map((c, i) => (
              <div key={'c' + i} className="rounded-3xl border-4 border-pink bg-pink/10 px-5 py-4" data-source="store_confirmed">
                <div lang="ko" className="text-2xl font-extrabold text-pink">⚠ {c.message_ko}</div>
                <div className="mt-1 text-base font-semibold text-ink">{c.message_local}</div>
              </div>
            ))}
            {estimated.map((c, i) => (
              <div key={'e' + i} className="rounded-3xl border-2 border-dashed border-ink/40 bg-lime/30 px-5 py-4" data-source="ai_estimated">
                <div lang="ko" className="text-xl font-bold text-ink">{c.message_ko}</div>
                <div className="mt-1 text-sm text-paper-muted">{c.message_local}</div>
              </div>
            ))}
          </div>
        )}
        {card.confirmed_clear_item_ids && card.confirmed_clear_item_ids.length > 0 && card.allergy_alert_ko && (
          <p lang="ko" className="rounded-2xl bg-paper-line/60 px-4 py-2 text-base text-paper-muted">
            {card.confirmed_clear_item_ids.map((id) => menu.items.find((i) => i.item_id === id)?.name_ko).filter(Boolean).join(', ')}: {CONFIRMED_CLEAR_KO}
          </p>
        )}

        <div className="mt-auto grid gap-2 border-t border-paper-line pt-4 text-sm text-paper-muted">
          <div><span className="font-semibold">{t('staffSees', lang)}:</span> {card.back_translation.replace(BACK_PREFIX[lang], '').replace(/^[^:：]{0,12}[:：]\s*/, (m) => (/(staff|店員|店员|personal)/i.test(m) ? '' : m))}</div>
          {card.transcript && <div><span className="font-semibold">{t('transcript', lang)}:</span> “{card.transcript}”</div>}
          {card.unmatched_note && <div className="font-semibold text-ink">{card.unmatched_note}</div>}
          {card.fallback_note && <div className="font-bold text-pink" data-testid="fallback-note">{card.fallback_note}</div>}
          <div className="font-mono text-xs text-paper-muted">
            {card.mode === 'rule' ? 'rule' : 'AI'} · {card.latency_ms.total}ms{card.latency_ms.stt != null ? ` (stt ${card.latency_ms.stt}ms, llm ${card.latency_ms.llm}ms)` : ''}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button onClick={onEdit} className="rounded-2xl border-2 border-ink px-4 py-4 text-lg font-bold">{t('speakAgain', lang)}</button>
          <button onClick={onClose} className="rounded-2xl bg-ink px-4 py-4 text-lg font-bold text-lime" data-testid="card-close">{t('close', lang)}</button>
        </div>
      </div>
    </div>
  );
}
