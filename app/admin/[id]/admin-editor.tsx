'use client';
// Spec S3 확인·공개. 편집 상태는 브라우저가 들고 있다가 공개 요청 본문에 전부 싣는다(Spec 2.3-4).
import { QrPanel } from '@/components/QrPanel';
import { ALLERGENS, ALLERGEN_CODES, type AllergenCode } from '@/lib/allergens';
import { LANG_LABEL } from '@/lib/i18n/strings';
import { localizeBundle, makeBundles, runPool, toInput } from '@/lib/localize-client';
import { hashKey, keys, lsGet, lsSet } from '@/lib/storage';
import { CATEGORIES, LANGS, type Category, type LangCode, type LocalizedItem, type MenuItemBase, type SpiceLevel } from '@/lib/types';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const CATEGORY_KO: Record<Category, string> = { main: '식사', side: '곁들임', drink: '음료', alcohol: '주류', dessert: '디저트', set: '세트', other: '기타' };

type Status = 'loading' | 'editing' | 'publishing' | 'published' | 'error';
type BundleStatus = 'pending' | 'running' | 'done' | 'error';

interface Stored {
  menuId: string;
  storeName: string | null;
  warnings: string[];
  items: MenuItemBase[];
  fixture: boolean;
  locales?: Partial<Record<LangCode, Record<string, LocalizedItem>>>;
  locNames?: Partial<Record<LangCode, Record<number, string>>>;
}

/** 묶음 안 항목 이름들의 스냅숏. 다르면 "갱신 필요" */
const namesKey = (items: MenuItemBase[], ids: string[]) => ids.map((id) => items.find((i) => i.item_id === id)?.name_ko ?? '').join('\u0001');

export function AdminEditor({ menuId }: { menuId: string }) {
  const [status, setStatus] = useState<Status>('loading');
  const [error, setError] = useState<string | null>(null);
  const [adminKey, setAdminKey] = useState<string>('');
  const [storeName, setStoreName] = useState<string>('');
  const [warnings, setWarnings] = useState<string[]>([]);
  const [items, setItems] = useState<MenuItemBase[]>([]);
  const [fixture, setFixture] = useState(false);
  const [useFixtureLoc, setUseFixtureLoc] = useState(false);
  const [langs, setLangs] = useState<LangCode[]>([...LANGS]);
  const [locales, setLocales] = useState<Partial<Record<LangCode, Record<string, LocalizedItem>>>>({});
  const [locNames, setLocNames] = useState<Partial<Record<LangCode, Record<number, string>>>>({});
  const [bstat, setBstat] = useState<Partial<Record<LangCode, Record<number, BundleStatus>>>>({});
  const [published, setPublished] = useState<{ publicUrl: string; shortUrl: string; rev: number } | null>(null);
  const [publishErr, setPublishErr] = useState<string | null>(null);
  const [locTiming, setLocTiming] = useState<{ startedAt: number; doneAt?: number } | null>(null);
  const [firstMeasure, setFirstMeasure] = useState<string | null>(null);
  const started = useRef(false);
  const itemsRef = useRef(items);
  const localesRef = useRef(locales);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);
  useEffect(() => {
    localesRef.current = locales;
  }, [locales]);

  const bundles = useMemo(() => makeBundles(items), [items.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- 로드: 브라우저 상태 → localStorage → GET draft ----------
  useEffect(() => {
    const key = hashKey() || lsGet<string>(keys.adminKey(menuId), '');
    if (!key) {
      setStatus('error');
      setError('관리 키가 없습니다. 메뉴를 만든 기기에서 관리 링크로 열어 주세요.');
      return;
    }
    setAdminKey(key);
    lsSet(keys.adminKey(menuId), key);
    const stored = lsGet<Stored | null>(keys.draft(menuId), null);
    if (stored && stored.items?.length) {
      apply(stored);
      return;
    }
    fetch(`/api/menus/${menuId}/draft`, { headers: { 'x-admin-key': key } })
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j?.error?.code === 'BAD_ADMIN_KEY' ? '관리 키가 맞지 않습니다.' : '메뉴를 찾을 수 없어요.');
        apply({ menuId, storeName: j.store_name, warnings: j.warnings, items: j.items, fixture: Boolean(j.source?.fixture) });
      })
      .catch((e) => {
        setStatus('error');
        setError(e.message);
      });

    function apply(s: Stored) {
      setStoreName(s.storeName ?? '');
      setWarnings(s.warnings ?? []);
      setItems(s.items);
      setFixture(Boolean(s.fixture));
      setUseFixtureLoc(Boolean(s.fixture));
      setLocales(s.locales ?? {});
      setLocNames(s.locNames ?? {});
      setStatus('editing');
    }
  }, [menuId]);

  // ---------- localStorage 백업 ----------
  useEffect(() => {
    if (status !== 'editing' && status !== 'published') return;
    lsSet(keys.draft(menuId), { menuId, storeName, warnings, items, fixture, locales, locNames, savedAt: Date.now() } satisfies Stored & { savedAt: number });
  }, [menuId, storeName, warnings, items, fixture, locales, locNames, status]);

  // ---------- 현지화 ----------
  const runBundles = useCallback(
    async (jobs: { lang: LangCode; bundle: number }[]) => {
      if (!jobs.length) return true;
      setBstat((prev) => {
        const n = structuredClone(prev);
        for (const j of jobs) (n[j.lang] ??= {})[j.bundle] = 'running';
        return n;
      });
      const bs = makeBundles(itemsRef.current);
      const results = await runPool(
        jobs.map((j) => async () => {
          const snapItems = itemsRef.current;
          const ids = bs[j.bundle];
          const input = ids.map((id) => toInput(snapItems.find((i) => i.item_id === id)!));
          const r = await localizeBundle({ menuId, adminKey, lang: j.lang, items: input, fixture: useFixtureLoc });
          setLocales((prev) => {
            const n = { ...prev, [j.lang]: { ...(prev[j.lang] ?? {}) } };
            for (const it of r.items) n[j.lang]![it.item_id] = it;
            localesRef.current = n;
            return n;
          });
          setLocNames((prev) => ({ ...prev, [j.lang]: { ...(prev[j.lang] ?? {}), [j.bundle]: namesKey(snapItems, ids) } }));
          setBstat((prev) => ({ ...prev, [j.lang]: { ...(prev[j.lang] ?? {}), [j.bundle]: 'done' } }));
          return { ...j, ...r };
        }),
      );
      let allOk = true;
      results.forEach((r, i) => {
        if (r.status === 'rejected') {
          allOk = false;
          const j = jobs[i];
          setBstat((prev) => ({ ...prev, [j.lang]: { ...(prev[j.lang] ?? {}), [j.bundle]: 'error' } }));
        }
      });
      // 첫 측정(Plan 13:15): ja 1묶음 출력 토큰·지연
      const ja = results.find((r, i) => r.status === 'fulfilled' && jobs[i].lang === 'ja');
      if (ja && ja.status === 'fulfilled') setFirstMeasure(`ja 1묶음: ${ja.value.latencyMs}ms, output_tokens ${ja.value.outputTokens ?? '-'}`);
      return allOk;
    },
    [adminKey, menuId, useFixtureLoc],
  );

  // 마운트 시 모든 (언어, 묶음)을 한꺼번에 보낸다(이미 저장된 번역이 있으면 그 묶음은 건너뛴다)
  useEffect(() => {
    if (status !== 'editing' || started.current || !adminKey || items.length === 0) return;
    started.current = true;
    const jobs: { lang: LangCode; bundle: number }[] = [];
    const initial: Partial<Record<LangCode, Record<number, BundleStatus>>> = {};
    for (const lang of LANGS) {
      initial[lang] = {};
      bundles.forEach((ids, b) => {
        const have = ids.every((id) => locales[lang]?.[id]) && locNames[lang]?.[b] === namesKey(items, ids);
        initial[lang]![b] = have ? 'done' : 'pending';
        if (!have) jobs.push({ lang, bundle: b });
      });
    }
    setBstat(initial);
    setLocTiming({ startedAt: performance.now() });
    void runBundles(jobs).then(() => setLocTiming((t) => (t ? { ...t, doneAt: performance.now() } : t)));
  }, [status, adminKey, items, bundles, locales, locNames, runBundles]);

  const bundleState = (lang: LangCode, b: number): BundleStatus | 'stale' => {
    const s = bstat[lang]?.[b] ?? 'pending';
    if (s === 'done' && locNames[lang]?.[b] !== namesKey(items, bundles[b] ?? [])) return 'stale';
    return s;
  };

  const progress = (lang: LangCode) => {
    const total = bundles.length;
    const done = bundles.filter((_, b) => bundleState(lang, b) === 'done').length;
    const err = bundles.some((_, b) => bundleState(lang, b) === 'error');
    const stale = bundles.some((_, b) => bundleState(lang, b) === 'stale');
    return { total, done, err, stale };
  };

  const activeLangs = langs;
  const allJobs = activeLangs.flatMap((lang) => bundles.map((_, b) => ({ lang, b, s: bundleState(lang, b) })));
  const running = allJobs.filter((j) => j.s === 'running' || j.s === 'pending').length;
  const failedLangs = activeLangs.filter((l) => progress(l).err);
  const doneCount = allJobs.filter((j) => j.s === 'done' || j.s === 'stale').length;
  const canPublish = (status === 'editing' || status === 'published') && running === 0 && failedLangs.length === 0 && activeLangs.length > 0;

  // ---------- 편집 ----------
  const update = (id: string, patch: Partial<MenuItemBase>) => setItems((prev) => prev.map((i) => (i.item_id === id ? { ...i, ...patch } : i)));
  const toggleAllergen = (id: string, a: AllergenCode) =>
    setItems((prev) => prev.map((i) => (i.item_id === id ? { ...i, allergens: i.allergens.includes(a) ? i.allergens.filter((x) => x !== a) : [...i.allergens, a] } : i)));

  async function publish() {
    setPublishErr(null);
    setStatus('publishing');
    // 갱신 필요 묶음만 다시 요청한 뒤 공개(AC-15)
    const stale = activeLangs.flatMap((lang) => bundles.map((_, b) => ({ lang, bundle: b })).filter((j) => bundleState(j.lang, j.bundle) === 'stale'));
    if (stale.length) {
      const ok = await runBundles(stale);
      if (!ok) {
        setStatus('editing');
        setPublishErr('일부 번역을 갱신하지 못했어요. 다시 시도하거나 해당 언어를 빼고 공개해 주세요.');
        return;
      }
    }
    const cur = itemsRef.current;
    const latest = localesRef.current;
    const loc: Record<string, LocalizedItem[]> = {};
    for (const lang of activeLangs) loc[lang] = cur.map((i) => latest[lang]?.[i.item_id]).filter(Boolean) as LocalizedItem[];
    try {
      const res = await fetch(`/api/menus/${menuId}/publish`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-admin-key': adminKey },
        body: JSON.stringify({ storeName: storeName.trim() || null, langs: activeLangs, items: cur, locales: loc }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error?.code === 'INVALID_PUBLISH' ? '번역이 빠진 항목이 있어요: ' + JSON.stringify(j.error.details?.missingLocales ?? j.error.details) : j?.error?.message ?? '공개하지 못했어요');
      setPublished({ publicUrl: j.publicUrl, shortUrl: j.shortUrl, rev: j.rev });
      setStatus('published');
    } catch (e) {
      setStatus('editing');
      setPublishErr(e instanceof Error ? e.message : '공개하지 못했어요');
    }
  }

  if (status === 'loading') return <main className="p-8 text-center text-muted">불러오는 중…</main>;
  if (status === 'error') return <main className="mx-auto max-w-xl p-8 text-center"><p className="font-semibold text-danger">{error}</p></main>;

  const lowCount = items.filter((i) => i.confidence === 'low').length;
  const confirmedCount = items.filter((i) => i.allergens_source === 'store_confirmed').length;

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-40 pt-6">
      <header className="grid gap-3">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-2xl font-bold">메뉴 확인·공개</h1>
          {fixture && <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">데모 정답표 초안</span>}
        </div>
        <label className="grid gap-1">
          <span className="text-sm font-semibold">가게 이름</span>
          <input value={storeName} onChange={(e) => setStoreName(e.target.value)} maxLength={60} className="rounded-xl border border-line bg-card px-4 py-2" />
        </label>

        <div className="flex flex-wrap gap-2" aria-label="번역 진행">
          {LANGS.map((lang) => {
            const p = progress(lang);
            const on = langs.includes(lang);
            return (
              <button
                key={lang}
                type="button"
                onClick={() => setLangs((prev) => (prev.includes(lang) ? prev.filter((l) => l !== lang) : LANGS.filter((l) => prev.includes(l) || l === lang)))}
                className={`rounded-full border px-3 py-1 text-sm ${on ? 'border-brand bg-card' : 'border-line bg-transparent text-muted line-through'} ${p.err ? 'text-danger' : ''}`}
                title="눌러서 공개 언어에서 빼거나 넣기"
              >
                {LANG_LABEL[lang]} {p.err ? '⚠ 다시' : p.done === p.total ? (p.stale ? '↻' : '✓') : `${p.done}/${p.total}`}
              </button>
            );
          })}
        </div>
        {failedLangs.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-danger">번역 실패: {failedLangs.map((l) => LANG_LABEL[l]).join(', ')}</span>
            <button className="rounded-full border border-line px-3 py-1" onClick={() => runBundles(failedLangs.flatMap((lang) => bundles.map((_, b) => ({ lang, bundle: b })).filter((j) => bundleState(j.lang, j.bundle) === 'error')))}>다시 시도</button>
            <button className="rounded-full border border-line px-3 py-1" onClick={() => setLangs((prev) => prev.filter((l) => !failedLangs.includes(l)))}>이 언어 빼고 공개</button>
          </div>
        )}
        <label className="flex items-center gap-2 text-xs text-muted">
          <input type="checkbox" checked={useFixtureLoc} onChange={(e) => setUseFixtureLoc(e.target.checked)} />
          데모 번역(사람이 쓴 fixture) 사용 — 다음 요청부터 적용
        </label>
        {(warnings.length > 0 || lowCount > 0) && (
          <ul className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
            {warnings.map((w, i) => <li key={i}>• {w}</li>)}
            {lowCount > 0 && <li>• 판독이 불확실한 메뉴 {lowCount}개 (노란 칸)</li>}
          </ul>
        )}
        <p className="text-sm text-muted">
          AI가 추정한 알레르기는 점선으로 손님에게 보입니다. 메뉴마다 재료를 확인하고 <b>&ldquo;이 메뉴 알레르기 확인함&rdquo;</b>을 체크한 것만 &ldquo;가게 확인&rdquo;으로 나갑니다. ({confirmedCount}/{items.length} 확인)
        </p>
      </header>

      <ol className="mt-5 grid gap-3">
        {items.map((it) => (
          <ItemEditor key={it.item_id} item={it} onChange={(p) => update(it.item_id, p)} onToggleAllergen={(a) => toggleAllergen(it.item_id, a)} stale={langs.some((l) => { const b = bundles.findIndex((ids) => ids.includes(it.item_id)); return bundleState(l, b) === 'stale'; })} />
        ))}
      </ol>

      <footer className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-background/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto grid max-w-3xl gap-2">
          {publishErr && <p className="text-sm text-danger">{publishErr}</p>}
          {firstMeasure && <p className="text-xs text-muted">첫 측정 — {firstMeasure}{locTiming?.doneAt ? ` · 전체 현지화 ${Math.round((locTiming.doneAt - locTiming.startedAt) / 100) / 10}초` : ''}</p>}
          <button
            onClick={publish}
            disabled={!canPublish}
            className="w-full rounded-2xl bg-brand px-6 py-4 text-lg font-bold text-brand-ink disabled:opacity-50"
            data-testid="publish-btn"
          >
            {status === 'publishing' ? '공개하는 중…' : running > 0 ? `번역 마무리 중 (${doneCount}/${allJobs.length})` : status === 'published' ? '다시 공개하기' : '공개하기'}
          </button>
        </div>
      </footer>

      {published && (
        <section className="mt-8 grid gap-3 rounded-2xl bg-card p-5 shadow-sm" data-testid="published-panel">
          <h2 className="text-lg font-bold">공개 완료 — 테이블에 이 QR을 붙이세요</h2>
          <QrPanel url={published.publicUrl} shortUrl={published.shortUrl} size={320} storeName={storeName.trim() || null} />
          <p className="text-xs text-muted">손님 화면 반영은 재공개 후 최대 약 60초 늦을 수 있습니다. 관리 링크(이 페이지 주소)는 이 기기에 저장돼 있습니다.</p>
          <button className="justify-self-start text-sm underline" onClick={() => setStatus('editing')}>계속 고치기</button>
        </section>
      )}
    </main>
  );
}

function ItemEditor({ item, onChange, onToggleAllergen, stale }: { item: MenuItemBase; onChange: (p: Partial<MenuItemBase>) => void; onToggleAllergen: (a: AllergenCode) => void; stale: boolean }) {
  const [moreAllergens, setMoreAllergens] = useState(false);
  const confirmed = item.allergens_source === 'store_confirmed';
  const shown = moreAllergens ? ALLERGEN_CODES : (ALLERGEN_CODES.filter((a) => item.allergens.includes(a)) as readonly AllergenCode[]);
  return (
    <li className={`grid gap-3 rounded-2xl border p-4 ${item.confidence === 'low' ? 'border-amber-300 bg-amber-50' : 'border-line bg-card'}`} data-testid={`item-${item.item_id}`}>
      <div className="grid grid-cols-[1fr_auto] items-start gap-2">
        <input value={item.name_ko} onChange={(e) => onChange({ name_ko: e.target.value })} maxLength={60} className="min-w-0 rounded-lg border border-line bg-white px-3 py-2 text-lg font-bold" aria-label="메뉴명" />
        <div className="flex items-center gap-1">
          <input
            inputMode="numeric"
            value={item.price_krw ?? ''}
            placeholder="시가"
            onChange={(e) => {
              const v = e.target.value.replace(/[^0-9]/g, '');
              onChange({ price_krw: v ? Math.min(10_000_000, Number(v)) : null });
            }}
            className="w-28 rounded-lg border border-line bg-white px-3 py-2 text-right"
            aria-label="가격"
          />
          <span className="text-sm text-muted">원</span>
        </div>
      </div>
      {item.confidence === 'low' && item.unreadable_note && <p className="text-sm text-amber-900">⚠ {item.unreadable_note}</p>}
      {stale && <p className="text-xs text-brand">메뉴명이 바뀌어 공개할 때 이 묶음을 다시 번역합니다</p>}
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <select value={item.category} onChange={(e) => onChange({ category: e.target.value as Category })} className="rounded-lg border border-line bg-white px-2 py-1" aria-label="분류">
          {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_KO[c]}</option>)}
        </select>
        <div className="flex overflow-hidden rounded-lg border border-line" role="radiogroup" aria-label="맵기">
          {([0, 1, 2, 3] as SpiceLevel[]).map((s) => (
            <button key={s} type="button" role="radio" aria-checked={item.spice_level === s} onClick={() => onChange({ spice_level: s })} className={`px-2 py-1 ${item.spice_level === s ? 'bg-brand text-brand-ink' : 'bg-white'}`}>
              {s === 0 ? '안 매움' : '🌶'.repeat(s)}
            </button>
          ))}
        </div>
        {item.price_note && <span className="text-muted">{item.price_note}</span>}
      </div>
      <div className="grid gap-2">
        <div className="flex flex-wrap gap-1.5">
          {shown.map((a) => {
            const on = item.allergens.includes(a);
            return (
              <button key={a} type="button" onClick={() => onToggleAllergen(a)} aria-pressed={on} className={`rounded-full px-2.5 py-1 text-sm ${on ? (confirmed ? 'badge-confirmed bg-red-50 text-red-700' : 'badge-estimated bg-orange-50 text-orange-700') : 'border border-line bg-white text-muted'}`}>
                {ALLERGENS[a].names.ko}
              </button>
            );
          })}
          <button type="button" onClick={() => setMoreAllergens((m) => !m)} className="rounded-full px-2.5 py-1 text-sm text-brand underline">
            {moreAllergens ? '접기' : item.allergens.length ? '+ 알레르기 추가' : '알레르기 없음 · + 추가'}
          </button>
        </div>
        <label className={`flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-semibold ${confirmed ? 'bg-red-50 text-red-800' : 'bg-white'}`}>
          <input type="checkbox" checked={confirmed} onChange={(e) => onChange({ allergens_source: e.target.checked ? 'store_confirmed' : 'ai_estimated' })} className="h-5 w-5" data-testid={`confirm-${item.item_id}`} />
          이 메뉴 알레르기 확인함
          {!confirmed && <span className="font-normal text-muted">(지금은 AI 추정)</span>}
        </label>
      </div>
    </li>
  );
}
