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

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-white text-black" role="dialog" aria-modal data-testid="order-card" data-mode={card.mode}>
      <div className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-5 px-5 pb-8 pt-5">
        <p className="text-center text-sm font-semibold text-neutral-500">{t('showStaff', lang)} · 직원분께 보여 주세요</p>

        <div lang="ko" className="grid gap-3">
          {card.lines_ko.length > 0 ? (
            card.lines_ko.map((l, i) => (
              <div key={i} className="text-[34px] font-extrabold leading-tight sm:text-[44px]">
                {l.text_ko}
                {l.qty != null && <span className="ml-3 text-neutral-500">{l.qty}개</span>}
                {l.item_id === null && <span className="ml-2 align-middle text-base font-semibold text-amber-700">(메뉴에 없음 · {t('noMatch', lang)})</span>}
              </div>
            ))
          ) : null}
          {card.requests_ko.map((r, i) => (
            <div key={i} className="text-[30px] font-bold leading-tight sm:text-[38px]">{r}</div>
          ))}
          {card.allergy_alert_ko && (
            <div className="rounded-2xl bg-danger px-4 py-3 text-[30px] font-extrabold leading-tight text-white sm:text-[38px]" data-testid="allergy-alert">
              ⚠ {card.allergy_alert_ko}
            </div>
          )}
          {card.lines_ko.length === 0 && card.requests_ko.length === 0 && !card.allergy_alert_ko && <div className="text-[32px] font-bold text-neutral-400">—</div>}
        </div>

        {card.conflicts.length > 0 && (
          <div className="grid gap-2" data-testid="conflicts">
            {card.conflicts_scope === 'whole_menu' && <p className="text-sm font-semibold text-neutral-600">이 가게에서 주의할 메뉴 · {t('cautionMenus', lang)}</p>}
            {confirmed.map((c, i) => (
              <div key={'c' + i} className="rounded-2xl border-4 border-danger bg-red-50 px-4 py-3" data-source="store_confirmed">
                <div lang="ko" className="text-2xl font-extrabold text-red-700">⚠ {c.message_ko}</div>
                <div className="mt-1 text-base font-semibold text-red-800">{c.message_local}</div>
              </div>
            ))}
            {estimated.map((c, i) => (
              <div key={'e' + i} className="rounded-2xl border-2 border-dashed border-warn bg-orange-50 px-4 py-3" data-source="ai_estimated">
                <div lang="ko" className="text-xl font-bold text-orange-700">{c.message_ko}</div>
                <div className="mt-1 text-sm text-orange-800">{c.message_local}</div>
              </div>
            ))}
          </div>
        )}
        {card.confirmed_clear_item_ids && card.confirmed_clear_item_ids.length > 0 && card.allergy_alert_ko && (
          <p lang="ko" className="rounded-xl bg-neutral-100 px-4 py-2 text-base text-neutral-600">
            {card.confirmed_clear_item_ids.map((id) => menu.items.find((i) => i.item_id === id)?.name_ko).filter(Boolean).join(', ')}: {CONFIRMED_CLEAR_KO}
          </p>
        )}

        <div className="mt-auto grid gap-2 border-t border-neutral-200 pt-4 text-sm text-neutral-600">
          <div><span className="font-semibold">{t('staffSees', lang)}:</span> {card.back_translation.replace(BACK_PREFIX[lang], '').replace(/^[^:：]{0,12}[:：]\s*/, (m) => (/(staff|店員|店员|personal)/i.test(m) ? '' : m))}</div>
          {card.transcript && <div><span className="font-semibold">{t('transcript', lang)}:</span> “{card.transcript}”</div>}
          {card.unmatched_note && <div className="text-amber-700">{card.unmatched_note}</div>}
          {card.fallback_note && <div className="font-semibold text-amber-700" data-testid="fallback-note">{card.fallback_note}</div>}
          <div className="text-xs text-neutral-400">
            {card.mode === 'rule' ? 'rule' : 'AI'} · {card.latency_ms.total}ms{card.latency_ms.stt != null ? ` (stt ${card.latency_ms.stt}ms, llm ${card.latency_ms.llm}ms)` : ''}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button onClick={onEdit} className="rounded-2xl border-2 border-black px-4 py-4 text-lg font-bold">{t('speakAgain', lang)}</button>
          <button onClick={onClose} className="rounded-2xl bg-black px-4 py-4 text-lg font-bold text-white" data-testid="card-close">{t('close', lang)}</button>
        </div>
      </div>
    </div>
  );
}
