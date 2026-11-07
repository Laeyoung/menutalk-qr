'use client';
// Spec S8 발표자 콘솔: 스키마 워밍업, 데모 메뉴 열기, 녹음 샘플 켜기/끄기, QR 크게, API 상태
import { QrPanel } from '@/components/QrPanel';
import { hashKey, keys, lsGet, lsSet } from '@/lib/storage';
import { useEffect, useState } from 'react';

export function DemoConsole({ demoMenuId }: { demoMenuId: string }) {
  const [demoKey, setDemoKey] = useState('');
  const [health, setHealth] = useState<Record<string, unknown> | null>(null);
  const [warm, setWarm] = useState<string | null>(null);
  const [samples, setSamples] = useState(false);
  const [adminUrl, setAdminUrl] = useState('');
  const [origin, setOrigin] = useState('');

  useEffect(() => {
    const k = hashKey() || lsGet<string>(keys.demoKey, '');
    setDemoKey(k);
    if (k) lsSet(keys.demoKey, k);
    setSamples(lsGet<boolean>(keys.samples, false));
    setAdminUrl(lsGet<string>(keys.demoAdminUrl, ''));
    setOrigin(window.location.origin);
    void loadHealth();
  }, []);

  async function loadHealth() {
    const r = await fetch('/api/health', { cache: 'no-store' }).catch(() => null);
    setHealth(r && r.ok ? await r.json() : { ok: false });
  }

  async function warmup() {
    setWarm('워밍업 중…');
    const t0 = Date.now();
    const r = await fetch('/api/demo/warmup', { method: 'POST', headers: { 'x-demo-key': demoKey } }).catch(() => null);
    const j = r ? await r.json().catch(() => null) : null;
    setWarm(r?.ok ? `추출 ${fmt(j.extraction)} · 현지화 ${fmt(j.localization)} · 주문 카드 ${fmt(j.orderCard)} (전체 ${Date.now() - t0}ms)` : `실패: ${j?.error?.code ?? r?.status ?? 'network'}`);
  }

  const toggleSamples = () => {
    const v = !samples;
    setSamples(v);
    lsSet(keys.samples, v);
  };

  const guestUrl = demoMenuId ? `/m/${demoMenuId}` : '/m/demo';
  const shortUrl = origin ? `${origin.replace(/^https?:\/\//, '')}/d` : '/d';

  return (
    <main className="mx-auto grid w-full max-w-3xl gap-5 px-4 py-6">
      <h1 className="text-2xl font-bold">발표자 콘솔</h1>

      <section className="grid gap-2 rounded-2xl bg-card p-4 shadow-sm">
        <h2 className="font-bold">API 상태</h2>
        <pre className="overflow-x-auto rounded-lg bg-neutral-100 p-3 text-xs">{health ? JSON.stringify(health, null, 2) : '…'}</pre>
        <button onClick={loadHealth} className="justify-self-start rounded-full border border-line px-4 py-2 text-sm">새로고침</button>
      </section>

      <section className="grid gap-2 rounded-2xl bg-card p-4 shadow-sm">
        <h2 className="font-bold">스키마 워밍업 (발표 10분 전)</h2>
        <input value={demoKey} onChange={(e) => { setDemoKey(e.target.value); lsSet(keys.demoKey, e.target.value); }} placeholder="데모 키" type="password" className="rounded-lg border border-line px-3 py-2" />
        <button onClick={warmup} disabled={!demoKey} className="justify-self-start rounded-full bg-brand px-4 py-2 font-bold text-brand-ink disabled:opacity-50">스키마 워밍업</button>
        {warm && <p className="text-sm" data-testid="warmup-result">{warm}</p>}
      </section>

      <section className="grid gap-2 rounded-2xl bg-card p-4 shadow-sm">
        <h2 className="font-bold">데모 메뉴</h2>
        <p className="text-sm text-muted">DEMO_MENU_ID: {demoMenuId || '(미설정 — 정적 사본 /m/demo 사용)'}</p>
        <div className="flex flex-wrap gap-2">
          <a href={guestUrl + (samples ? '?samples=1' : '')} target="_blank" rel="noreferrer" className="rounded-full border border-line px-4 py-2 text-sm">손님 화면 열기</a>
          {adminUrl && <a href={adminUrl} target="_blank" rel="noreferrer" className="rounded-full border border-line px-4 py-2 text-sm">사전 생성본 확인 화면(S3)</a>}
          <a href="/new" target="_blank" rel="noreferrer" className="rounded-full border border-line px-4 py-2 text-sm">사장님 업로드(S2)</a>
        </div>
        <label className="grid gap-1 text-sm">
          <span className="text-muted">사전 생성본 관리 URL(저장해 두면 위 버튼이 생깁니다)</span>
          <input value={adminUrl} onChange={(e) => { setAdminUrl(e.target.value); lsSet(keys.demoAdminUrl, e.target.value); }} placeholder="/admin/xxxx#k=..." className="rounded-lg border border-line px-3 py-2" />
        </label>
      </section>

      <section className="grid gap-2 rounded-2xl bg-card p-4 shadow-sm">
        <h2 className="font-bold">녹음 샘플 버튼</h2>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={samples} onChange={toggleSamples} className="h-5 w-5" />
          이 기기의 손님 화면에 &ldquo;녹음 샘플로 요청&rdquo; 버튼 보이기 (다른 기기는 URL에 ?samples=1)
        </label>
      </section>

      <section className="grid gap-2 rounded-2xl bg-card p-4 shadow-sm">
        <h2 className="font-bold">청중 QR</h2>
        {origin && <QrPanel url={`${origin}/d`} shortUrl={shortUrl} size={360} />}
      </section>
    </main>
  );
}

function fmt(v: unknown) {
  return typeof v === 'number' ? `${v}ms` : String(v);
}
