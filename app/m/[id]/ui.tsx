'use client';
import { ALLERGENS } from '@/lib/allergens';
import { t } from '@/lib/i18n/strings';
import type { LangCode, PublishedItem } from '@/lib/types';
import { useEffect } from 'react';

export function AllergenBadges({ item, lang }: { item: PublishedItem; lang: LangCode }) {
  if (!item.allergens.length) return null;
  const confirmed = item.allergens_source === 'store_confirmed';
  return (
    <span className="flex flex-wrap items-center gap-1">
      {item.allergens.map((a) => (
        <span key={a} className={`rounded-full px-2 py-0.5 text-xs ${confirmed ? 'badge-confirmed text-pink' : 'badge-estimated text-lime'}`} data-source={item.allergens_source}>
          {ALLERGENS[a].names[lang]}
        </span>
      ))}
      <span className={`text-[11px] ${confirmed ? 'font-bold text-pink' : 'text-lime'}`}>{confirmed ? `✓ ${t('storeConfirmed', lang)}` : t('estimated', lang)}</span>
    </span>
  );
}

export function Sheet({ children, onClose, full = false }: { children: React.ReactNode; onClose: () => void; full?: boolean }) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/70" onClick={onClose} role="dialog" aria-modal>
      <div className={`w-full max-w-xl overflow-y-auto rounded-t-3xl border-t border-line bg-card p-5 pb-8 ${full ? 'h-[92dvh]' : 'max-h-[88dvh]'}`} onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

