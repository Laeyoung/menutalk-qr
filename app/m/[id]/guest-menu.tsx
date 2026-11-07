'use client';
// Spec S4 손님 메뉴 + S5 상세 시트 + S6 요청 시트 + S7 주문 카드
import { conflictLevel, itemConflicts } from '@/lib/allergy';
import { ALLERGENS, GUEST_CHIP_ORDER, isAllergenCode, type AllergenCode } from '@/lib/allergens';
import { LANG_LABEL, SPICE_LABEL, t } from '@/lib/i18n/strings';
import { isLangCode, resolveLang } from '@/lib/lang';
import { keys, lsGet, lsSet } from '@/lib/storage';
import type { CartLine, LangCode, OrderCard, PublishedItem, PublishedMenu } from '@/lib/types';
import { useEffect, useMemo, useState } from 'react';
import { AudioProvider } from './audio';
import { DetailSheet } from './detail-sheet';
import { OrderCardView } from './order-card-view';
import { RequestSheet } from './request-sheet';
import { AllergenBadges, Sheet } from './ui';

export function GuestMenu({ menu: initialMenu, source }: { menu: PublishedMenu; source: 'blob' | 'static' }) {
  const [menu, setMenu] = useState(initialMenu);
  const [lang, setLangState] = useState<LangCode>(() => (initialMenu.langs.includes('en') ? 'en' : initialMenu.langs[0]));
  const [langOpen, setLangOpen] = useState(false);
  const [allergies, setAllergies] = useState<AllergenCode[]>([]);
  const [allergyOpen, setAllergyOpen] = useState(false);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [requestOpen, setRequestOpen] = useState(false);
  const [card, setCard] = useState<OrderCard | null>(null);
  const [showSamples, setShowSamples] = useState(false);

  // 언어 결정·저장값 복원·hit 비콘(마운트 1회)
  useEffect(() => {
    const saved = lsGet<string | null>(keys.lang, null);
    const l = saved && isLangCode(saved) && menu.langs.includes(saved) ? saved : resolveLang(navigator.languages ?? [navigator.language], menu.langs);
    setLangState(l);
    const a = lsGet<string[]>(keys.allergies, []).filter(isAllergenCode);
    setAllergies(a);
    if (!lsGet<boolean>(keys.allergiesAsked, false)) setAllergyOpen(true);
    const sp = new URLSearchParams(window.location.search);
    setShowSamples(sp.get('samples') === '1' || lsGet<boolean>(keys.samples, false));
    try {
      navigator.sendBeacon?.('/api/hit', menu.menu_id);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = (l: LangCode) => {
    setLangState(l);
    lsSet(keys.lang, l);
  };
  const saveAllergies = (a: AllergenCode[]) => {
    setAllergies(a);
    lsSet(keys.allergies, a);
    lsSet(keys.allergiesAsked, true);
  };

  const sections = useMemo(() => {
    const out: { title: string | null; items: PublishedItem[] }[] = [];
    for (const it of menu.items) {
      const last = out[out.length - 1];
      if (last && last.title === it.section_ko) last.items.push(it);
      else out.push({ title: it.section_ko, items: [it] });
    }
    return out;
  }, [menu.items]);

  const toggleCart = (id: string) => setCart((c) => (c.some((x) => x.itemId === id) ? c.filter((x) => x.itemId !== id) : [...c, { itemId: id, qty: 1 }]));
  const loc = menu.locales[lang] ?? {};
  const detailItem = detailId ? menu.items.find((i) => i.item_id === detailId) ?? null : null;

  const refreshMenu = async (): Promise<PublishedMenu | null> => {
    try {
      const r = await fetch(`/api/menus/${menu.menu_id}`, { cache: 'no-store' });
      if (!r.ok) return null;
      const m = (await r.json()) as PublishedMenu;
      setMenu(m);
      return m;
    } catch {
      return null;
    }
  };

  return (
    <AudioProvider>
      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-line bg-background/95 px-4 py-3 backdrop-blur">
          <div className="min-w-0 flex-1">
            <div className="truncate text-lg font-bold">{menu.store_name ?? 'Menu'}</div>
          </div>
          <button onClick={() => setAllergyOpen(true)} className={`shrink-0 rounded-full border px-3 py-2 text-sm font-semibold ${allergies.length ? 'border-danger text-danger' : 'border-line'}`} data-testid="my-allergies-btn">
            ⚠ {t('myAllergies', lang)}{allergies.length ? ` (${allergies.length})` : ''}
          </button>
          <button onClick={() => setLangOpen(true)} className="shrink-0 rounded-full bg-foreground px-3 py-2 text-sm font-bold text-background" aria-label={t('language', lang)} data-testid="lang-btn">
            🌐 {LANG_LABEL[lang]}
          </button>
        </header>

        {langOpen && (
          <Sheet onClose={() => setLangOpen(false)}>
            <div className="grid gap-2">
              {menu.langs.map((l) => (
                <button key={l} onClick={() => { setLang(l); setLangOpen(false); }} className={`rounded-xl px-4 py-4 text-left text-xl font-bold ${l === lang ? 'bg-foreground text-background' : 'bg-card'}`} data-testid={`lang-${l}`}>
                  {LANG_LABEL[l]}
                </button>
              ))}
            </div>
          </Sheet>
        )}

        {allergyOpen && (
          <AllergySheet lang={lang} initial={allergies} onDone={(a) => { saveAllergies(a); setAllergyOpen(false); }} onSkip={() => { lsSet(keys.allergiesAsked, true); setAllergyOpen(false); }} />
        )}

        <main className="flex-1 px-4 pb-32 pt-2">
          {sections.map((sec, si) => (
            <section key={si} className="mt-4">
              {sec.title && <h2 className="mb-2 text-sm font-semibold text-muted">{sec.title}</h2>}
              <ul className="grid gap-3">
                {sec.items.map((it) => (
                  <MenuCard key={it.item_id} item={it} lang={lang} name={loc[it.item_id]?.name ?? it.name_ko} short={loc[it.item_id]?.short ?? ''} allergies={allergies} inCart={cart.some((c) => c.itemId === it.item_id)} onToggle={() => toggleCart(it.item_id)} onOpen={() => setDetailId(it.item_id)} />
                ))}
              </ul>
            </section>
          ))}
          <p className="mt-8 rounded-xl bg-card p-4 text-center text-sm font-semibold" data-testid="staff-confirm">⚠ {t('staffConfirm', lang)}</p>
          {source === 'static' && <p className="mt-2 text-center text-xs text-muted">offline copy</p>}
        </main>

        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-background/95 px-4 py-3 backdrop-blur">
          <div className="mx-auto max-w-xl">
            <button onClick={() => setRequestOpen(true)} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-brand px-6 py-4 text-lg font-bold text-brand-ink" data-testid="request-btn">
              🗣 {t('request', lang)}
              {cart.length > 0 && <span className="rounded-full bg-white px-2 text-sm text-brand">{cart.length}</span>}
            </button>
          </div>
        </div>

        {detailItem && (
          <DetailSheet menu={menu} item={detailItem} lang={lang} allergies={allergies} inCart={cart.some((c) => c.itemId === detailItem.item_id)} onToggle={() => toggleCart(detailItem.item_id)} onClose={() => setDetailId(null)} refreshMenu={refreshMenu} />
        )}

        {requestOpen && (
          <RequestSheet
            menu={menu}
            lang={lang}
            cart={cart}
            allergies={allergies}
            showSamples={showSamples}
            onRemove={(id) => setCart((c) => c.filter((x) => x.itemId !== id))}
            onLang={setLang}
            onClose={() => setRequestOpen(false)}
            onCard={(c) => { setCard(c); setRequestOpen(false); }}
          />
        )}

        {card && <OrderCardView card={card} menu={menu} onClose={() => setCard(null)} onEdit={() => { setCard(null); setRequestOpen(true); }} />}
      </div>
    </AudioProvider>
  );
}

function MenuCard({ item, lang, name, short, allergies, inCart, onToggle, onOpen }: { item: PublishedItem; lang: LangCode; name: string; short: string; allergies: AllergenCode[]; inCart: boolean; onToggle: () => void; onOpen: () => void }) {
  const level = conflictLevel(item, allergies);
  const hits = itemConflicts(item, allergies);
  return (
    <li className={`overflow-hidden rounded-2xl border bg-card shadow-sm ${level === 'red' ? 'border-danger' : level === 'orange' ? 'border-warn' : 'border-line'}`} data-testid={`card-${item.item_id}`} data-conflict={level ?? 'none'}>
      {level && (
        <div className={`px-4 py-1.5 text-sm font-bold text-white ${level === 'red' ? 'bg-danger' : 'bg-warn'}`}>
          ⚠ {t('conflictWarn', lang)}: {hits.map((a) => ALLERGENS[a].names[lang]).join(', ')} · {level === 'red' ? t('storeConfirmed', lang) : t('estimated', lang)}
        </div>
      )}
      <div className="grid gap-2 p-4">
        <button onClick={onOpen} className="grid gap-1 text-left">
          <div className="flex items-start justify-between gap-3">
            <span className="text-lg font-bold leading-snug">{name}</span>
            <span className="shrink-0 font-semibold">{item.price_krw != null ? `₩${item.price_krw.toLocaleString('en-US')}` : t('priceMarket', lang)}</span>
          </div>
          <span className="text-sm text-muted">{item.name_ko}{item.price_note ? ` · ${item.price_note}` : ''}</span>
          {short && <span className="text-sm">{short}</span>}
        </button>
        <div className="flex flex-wrap items-center gap-1.5">
          {item.spice_level > 0 && (
            <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-700" title={SPICE_LABEL[lang][item.spice_level]}>
              {'🌶'.repeat(item.spice_level)} {SPICE_LABEL[lang][item.spice_level]}
            </span>
          )}
          <AllergenBadges item={item} lang={lang} />
          <button onClick={onToggle} aria-pressed={inCart} className={`ml-auto rounded-full px-4 py-2 text-sm font-bold ${inCart ? 'bg-foreground text-background' : 'border border-foreground'}`} data-testid={`add-${item.item_id}`}>
            {inCart ? t('added', lang) : `+ ${t('add', lang)}`}
          </button>
        </div>
      </div>
    </li>
  );
}

function AllergySheet({ lang, initial, onDone, onSkip }: { lang: LangCode; initial: AllergenCode[]; onDone: (a: AllergenCode[]) => void; onSkip: () => void }) {
  const [sel, setSel] = useState<AllergenCode[]>(initial);
  return (
    <Sheet onClose={onSkip}>
      <h2 className="text-xl font-bold">{t('chooseAllergies', lang)}</h2>
      <div className="mt-4 flex flex-wrap gap-2">
        {GUEST_CHIP_ORDER.map((a) => {
          const on = sel.includes(a);
          return (
            <button key={a} onClick={() => setSel((s) => (on ? s.filter((x) => x !== a) : [...s, a]))} aria-pressed={on} className={`rounded-full px-4 py-2 text-base ${on ? 'bg-danger font-bold text-white' : 'border border-line bg-card'}`} data-testid={`allergy-${a}`}>
              {ALLERGENS[a].emoji} {ALLERGENS[a].names[lang]}
            </button>
          );
        })}
      </div>
      <div className="mt-6 grid grid-cols-2 gap-2">
        <button onClick={onSkip} className="rounded-2xl border border-line px-4 py-3 font-semibold">{t('skip', lang)}</button>
        <button onClick={() => onDone(sel)} className="rounded-2xl bg-foreground px-4 py-3 font-bold text-background" data-testid="allergy-done">{t('done', lang)}</button>
      </div>
    </Sheet>
  );
}
