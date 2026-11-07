'use client';
// Spec S5 메뉴 상세 시트: ▶ + "AI voice". error → 메뉴 재조회 → 다시 시도 → 브라우저 음성
import { conflictLevel, itemConflicts } from '@/lib/allergy';
import { ALLERGENS, type AllergenCode } from '@/lib/allergens';
import { SPEECH_LANG, SPICE_LABEL, t } from '@/lib/i18n/strings';
import { buildTtsText } from '@/lib/tts-text';
import type { LangCode, PublishedItem, PublishedMenu } from '@/lib/types';
import { useEffect, useState } from 'react';
import { speakWithBrowser, useAudio } from './audio';
import { AllergenBadges, Sheet } from './ui';

export function DetailSheet({
  menu, item, lang, allergies, inCart, onToggle, onClose, refreshMenu,
}: {
  menu: PublishedMenu; item: PublishedItem; lang: LangCode; allergies: AllergenCode[]; inCart: boolean;
  onToggle: () => void; onClose: () => void; refreshMenu: () => Promise<PublishedMenu | null>;
}) {
  const loc = menu.locales[lang]?.[item.item_id];
  const audio = useAudio();
  const key = `${item.item_id}.${lang}`;
  const mine = audio.current === key;
  const [failCount, setFailCount] = useState(0);
  const [slow, setSlow] = useState(false);
  const level = conflictLevel(item, allergies);
  const hits = itemConflicts(item, allergies);
  const ttsText = loc?.tts_text ?? (loc ? buildTtsText(loc, lang) : item.name_ko);

  // error 이벤트 → 메뉴 JSON 1회 재조회(tts_hash 갱신) 후 "다시 시도"
  useEffect(() => {
    if (!mine || audio.state !== 'error') return;
    setFailCount((n) => n + 1);
    void refreshMenu();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mine, audio.state]);

  useEffect(() => {
    if (!(mine && audio.state === 'loading')) {
      setSlow(false);
      return;
    }
    const tm = setTimeout(() => setSlow(true), 3000);
    return () => clearTimeout(tm);
  }, [mine, audio.state]);

  useEffect(() => () => audio.stop(), []); // eslint-disable-line react-hooks/exhaustive-deps

  const onPlay = () => {
    if (!loc) return;
    if (mine && audio.state === 'playing') {
      audio.stop();
      return;
    }
    // 동기적으로 src 지정 + play() (iOS 제스처 유지)
    audio.play(key, `/api/audio/${menu.menu_id}/${item.item_id}/${lang}?h=${loc.tts_hash}`);
  };
  const onBrowser = () => {
    audio.stop();
    speakWithBrowser(ttsText, SPEECH_LANG[lang]);
  };

  const label =
    mine && audio.state === 'loading' ? (slow ? t('voicePreparing', lang) : '…') : mine && audio.state === 'playing' ? '■' : mine && (audio.state === 'error' || audio.state === 'blocked') ? `▶ ${t('retry', lang)}` : `▶ ${t('play', lang)}`;

  return (
    <Sheet onClose={onClose}>
      <div className="grid gap-4" data-testid="detail-sheet">
        <div>
          <h2 className="text-2xl font-bold leading-snug">{loc?.name ?? item.name_ko}</h2>
          <p className="text-muted">{item.name_ko}</p>
        </div>
        {level && (
          <div className={`rounded-xl px-4 py-2 text-sm font-bold text-white ${level === 'red' ? 'bg-danger' : 'bg-warn'}`}>
            ⚠ {t('conflictWarn', lang)}: {hits.map((a) => ALLERGENS[a].names[lang]).join(', ')}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={onPlay} className="rounded-full bg-foreground px-5 py-3 font-bold text-background" data-testid="play-btn">{label}</button>
          <span className="rounded-full border border-line px-2 py-0.5 text-xs text-muted">{t('aiVoice', lang)}</span>
          {failCount >= 2 && (
            <button onClick={onBrowser} className="rounded-full border border-line px-4 py-2 text-sm" data-testid="browser-voice-btn">🔈 {t('playBrowser', lang)}</button>
          )}
        </div>
        {loc?.detail && <p className="text-base leading-relaxed">{loc.detail}</p>}
        {loc?.how_to_eat && (
          <div>
            <h3 className="text-sm font-semibold text-muted">{t('howToEat', lang)}</h3>
            <p>{loc.how_to_eat}</p>
          </div>
        )}
        <div className="flex flex-wrap gap-2 text-sm">
          {item.spice_level > 0 && <span className="rounded-full bg-red-50 px-2 py-0.5 text-red-700">{'🌶'.repeat(item.spice_level)} {SPICE_LABEL[lang][item.spice_level]}</span>}
          <span className="font-semibold">{item.price_krw != null ? `₩${item.price_krw.toLocaleString('en-US')}` : t('priceMarket', lang)}</span>
        </div>
        {item.main_ingredients_ko.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-muted">{t('ingredients', lang)}</h3>
            <p className="text-sm">{item.main_ingredients_ko.join(', ')}</p>
          </div>
        )}
        <div>
          <h3 className="text-sm font-semibold text-muted">{t('allergyInfo', lang)}</h3>
          {item.allergens.length ? <AllergenBadges item={item} lang={lang} /> : <p className="text-sm text-muted">—</p>}
          <p className="mt-2 text-xs text-muted">{t('staffConfirm', lang)}</p>
        </div>
        <button onClick={onToggle} className={`rounded-2xl px-4 py-3 font-bold ${inCart ? 'bg-foreground text-background' : 'border border-foreground'}`}>
          {inCart ? t('added', lang) : `+ ${t('add', lang)}`}
        </button>
        <button onClick={onClose} className="text-sm text-muted underline">{t('close', lang)}</button>
      </div>
    </Sheet>
  );
}
