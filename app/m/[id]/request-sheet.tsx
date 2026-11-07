'use client';
// Spec S6 요청 시트: 자유 입력이 없으면 브라우저 규칙 카드(네트워크 0건), 있으면 /api/order-card.
// 어떤 실패든 규칙 카드로 즉시 폴백하고 "자유 입력 내용은 반영하지 못했습니다"를 붙인다.
import { pickMime, useRecorder } from '@/hooks/useRecorder';
import { localName } from '@/lib/allergy';
import { ALLERGENS, GUEST_CHIP_ORDER, type AllergenCode } from '@/lib/allergens';
import { CHIP_LOCAL, t } from '@/lib/i18n/strings';
import { buildRuleCard } from '@/lib/order/rule-card';
import { SAMPLES, type Sample } from '@/lib/samples';
import { CHIP_CODES, type CartLine, type ChipCode, type LangCode, type OrderCard, type PublishedMenu } from '@/lib/types';
import { useEffect, useState } from 'react';
import { Sheet } from './ui';

type Phase = 'composing' | 'uploading' | 'error';

export function RequestSheet({
  menu, lang, cart, allergies, showSamples, onRemove, onLang, onClose, onCard,
}: {
  menu: PublishedMenu; lang: LangCode; cart: CartLine[]; allergies: AllergenCode[]; showSamples: boolean;
  onRemove: (id: string) => void; onLang: (l: LangCode) => void; onClose: () => void; onCard: (c: OrderCard) => void;
}) {
  const [chips, setChips] = useState<ChipCode[]>([]);
  const [guestAllergens, setGuestAllergens] = useState<AllergenCode[]>(allergies);
  const [moreAllergies, setMoreAllergies] = useState(false);
  const [text, setText] = useState('');
  const [phase, setPhase] = useState<Phase>('composing');
  const [notice, setNotice] = useState<string | null>(null);
  const rec = useRecorder(15_000);
  const [micSupported, setMicSupported] = useState(true);

  useEffect(() => setMicSupported(Boolean(pickMime()) && Boolean(navigator.mediaDevices?.getUserMedia)), []);

  const ruleCard = (fallback: boolean, l: LangCode = lang) => buildRuleCard({ menu, lang: l, cart, chips, guestAllergens, fallback });

  async function sendModel(input: { text?: string; file?: Blob; fileName?: string; mime?: string; lang?: LangCode }) {
    const l = input.lang ?? lang;
    setPhase('uploading');
    setNotice(null);
    const fd = new FormData();
    fd.set('menuId', menu.menu_id);
    fd.set('lang', l);
    fd.set('cart', JSON.stringify(cart));
    fd.set('chips', JSON.stringify(chips));
    fd.set('guestAllergens', JSON.stringify(guestAllergens));
    if (input.text) fd.set('text', input.text);
    if (input.file) {
      fd.set('file', input.file, input.fileName ?? 'req.webm');
      fd.set('mime', input.mime ?? input.file.type);
    }
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 20_000);
    try {
      const res = await fetch('/api/order-card', { method: 'POST', body: fd, signal: ctrl.signal });
      const json = await res.json().catch(() => null);
      if (res.ok && json) {
        onCard(json as OrderCard);
        return;
      }
      if (json?.error?.code === 'EMPTY_TRANSCRIPT') {
        // AC-46: 3초 안에 "칩으로 골라 주세요" + 규칙 카드
        setNotice(t('notHeard', l));
        setPhase('composing');
        setTimeout(() => onCard(ruleCard(true, l)), 1200);
        return;
      }
      onCard(ruleCard(true, l));
    } catch {
      onCard(ruleCard(true, l));
    } finally {
      clearTimeout(timeout);
    }
  }

  // 녹음이 끝나면 바로 전송
  useEffect(() => {
    if (rec.state === 'stopped' && rec.result) {
      const r = rec.result;
      rec.reset();
      void sendModel({ file: r.blob, fileName: r.fileName, mime: r.mime, text: text.trim() || undefined });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rec.state, rec.result]);

  const onMake = () => {
    const tx = text.trim();
    if (!tx) {
      onCard(ruleCard(false));
      return;
    }
    void sendModel({ text: tx });
  };

  async function onSample(s: Sample) {
    onLang(s.lang); // 화면 언어도 샘플 언어로(Spec S6)
    try {
      const r = await fetch(s.file);
      if (!r.ok) throw new Error('sample missing');
      const blob = await r.blob();
      const ext = s.file.split('.').pop() || 'mp3';
      await sendModel({ file: blob, fileName: `sample.${ext}`, mime: blob.type || `audio/${ext === 'm4a' ? 'mp4' : ext}`, lang: s.lang });
    } catch {
      // 샘플 파일이 없으면 같은 문장을 텍스트로 보낸다
      await sendModel({ text: s.text, lang: s.lang });
    }
  }

  const toggleChip = (c: ChipCode) => setChips((p) => (p.includes(c) ? p.filter((x) => x !== c) : [...p, c]));
  const toggleAllergy = (a: AllergenCode) => setGuestAllergens((p) => (p.includes(a) ? p.filter((x) => x !== a) : [...p, a]));
  const shownAllergies = moreAllergies ? GUEST_CHIP_ORDER : [...new Set([...guestAllergens, 'peanut', 'sesame', 'shrimp', 'shellfish', 'egg', 'milk', 'wheat'] as AllergenCode[])];
  const busy = phase === 'uploading';

  return (
    <Sheet onClose={busy ? () => {} : onClose} full>
      <div className="grid gap-5" data-testid="request-sheet">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">{t('requestTitle', lang)}</h2>
          <button onClick={onClose} disabled={busy} className="text-sm text-muted underline">{t('close', lang)}</button>
        </div>

        <section>
          <h3 className="mb-2 text-sm font-semibold text-muted">{t('cart', lang)}</h3>
          {cart.length === 0 ? (
            <p className="text-sm text-muted">{t('cartEmpty', lang)}</p>
          ) : (
            <ul className="grid gap-1">
              {cart.map((c) => (
                <li key={c.itemId} className="flex items-center justify-between rounded-xl bg-card px-3 py-2">
                  <span className="font-semibold">{localName(menu, c.itemId, lang)} × {c.qty}</span>
                  <button onClick={() => onRemove(c.itemId)} className="text-sm text-muted underline">{t('remove', lang)}</button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h3 className="mb-2 text-sm font-semibold text-muted">{t('quickRequests', lang)}</h3>
          <div className="flex flex-wrap gap-2">
            {CHIP_CODES.map((c) => (
              <button key={c} onClick={() => toggleChip(c)} aria-pressed={chips.includes(c)} className={`rounded-full px-4 py-2 ${chips.includes(c) ? 'bg-foreground font-bold text-background' : 'border border-line bg-card'}`} data-testid={`chip-${c}`}>
                {CHIP_LOCAL[c][lang]}
              </button>
            ))}
          </div>
        </section>

        <section>
          <h3 className="mb-2 text-sm font-semibold text-muted">{t('allergyChips', lang)}</h3>
          <div className="flex flex-wrap gap-2">
            {shownAllergies.map((a) => (
              <button key={a} onClick={() => toggleAllergy(a)} aria-pressed={guestAllergens.includes(a)} className={`rounded-full px-3 py-1.5 text-sm ${guestAllergens.includes(a) ? 'bg-danger font-bold text-white' : 'border border-line bg-card'}`}>
                {ALLERGENS[a].emoji} {ALLERGENS[a].names[lang]}
              </button>
            ))}
            {!moreAllergies && <button onClick={() => setMoreAllergies(true)} className="px-2 text-sm underline">+</button>}
          </div>
        </section>

        <section className="grid gap-2">
          <h3 className="text-sm font-semibold text-muted">{t('freeText', lang)}</h3>
          <textarea value={text} onChange={(e) => setText(e.target.value.slice(0, 300))} rows={2} placeholder={t('freeTextPh', lang)} className="rounded-xl border border-line bg-card px-3 py-2" disabled={busy} data-testid="free-text" />
          <div className="flex flex-wrap items-center gap-2">
            {micSupported && rec.state !== 'unsupported' ? (
              <button onClick={rec.toggle} disabled={busy || rec.state === 'denied'} className={`rounded-full px-5 py-3 font-bold ${rec.state === 'recording' ? 'animate-pulse bg-danger text-white' : 'border border-foreground'}`} data-testid="mic-btn">
                {rec.state === 'recording' ? `■ ${t('stop', lang)} · ${t('recording', lang)} ${rec.elapsed}s` : rec.state === 'requesting' ? '…' : `🎤 ${t('mic', lang)}`}
              </button>
            ) : (
              <span className="text-sm text-muted">{t('micUnsupported', lang)}</span>
            )}
            {rec.state === 'denied' && <span className="text-sm text-danger">{t('micBlocked', lang)}</span>}
          </div>
          <p className="text-xs text-muted" data-testid="voice-notice">{t('voiceNotice', lang)}</p>
        </section>

        {showSamples && (
          <section className="grid gap-2 rounded-xl border border-dashed border-line p-3">
            <h3 className="text-sm font-semibold text-muted">{t('samples', lang)}</h3>
            <div className="flex flex-wrap gap-2">
              {SAMPLES.map((s) => (
                <button key={s.lang} onClick={() => onSample(s)} disabled={busy} className="rounded-full border border-line bg-card px-4 py-2 text-sm" data-testid={`sample-${s.lang}`}>
                  ▶ {s.label}
                </button>
              ))}
            </div>
          </section>
        )}

        {notice && <p className="rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-900" role="alert">{notice}</p>}

        <button onClick={onMake} disabled={busy || rec.state === 'recording'} className="rounded-2xl bg-brand px-6 py-4 text-lg font-bold text-brand-ink disabled:opacity-60" data-testid="make-card-btn">
          {busy ? t('working', lang) : t('makeCard', lang)}
        </button>
      </div>
    </Sheet>
  );
}
