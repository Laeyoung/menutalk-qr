'use client';
// Spec S2 업로드: idle → resizing → extracting(경과 초, 10초마다 문구) → done(S3 이동) / error(재시도 선택지)
import { resizeToJpeg, UnsupportedImageError } from '@/lib/image/resize';
import { hashKey, keys, lsGet, lsSet } from '@/lib/storage';
import type { MenuItemBase } from '@/lib/types';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

type Phase = 'idle' | 'resizing' | 'extracting' | 'done' | 'error';

const WAIT_MESSAGES = [
  '메뉴판 글씨를 읽고 있어요',
  '가격과 메뉴 이름을 정리하고 있어요',
  '맵기와 알레르기 재료를 추정하고 있어요',
  '거의 다 됐어요. 손글씨는 조금 더 걸려요',
];

export interface DraftState {
  menuId: string;
  storeName: string | null;
  warnings: string[];
  items: MenuItemBase[];
  fixture: boolean;
}

export function UploadForm() {
  const router = useRouter();
  const [storeName, setStoreName] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<{ message: string; retryable: boolean } | null>(null);
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [demoKey, setDemoKey] = useState<string>('');
  const [resizeMs, setResizeMs] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const k = hashKey() || lsGet<string>(keys.demoKey, '');
    if (k) {
      setDemoKey(k);
      lsSet(keys.demoKey, k);
    }
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, []);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    setPhase('resizing');
    const t0 = performance.now();
    try {
      const r = await resizeToJpeg(file);
      setResizeMs(Math.round(performance.now() - t0));
      setDataUrl(r.dataUrl);
      await extract({ imageDataUrl: r.dataUrl });
    } catch (e) {
      setPhase('error');
      setError({ message: e instanceof UnsupportedImageError ? 'JPEG로 다시 올려 주세요' : '사진을 처리하지 못했어요. 다시 시도해 주세요', retryable: false });
    }
  }

  async function extract(body: { imageDataUrl?: string; retryWith?: 'sol'; detail?: 'original'; fixture?: boolean }) {
    setPhase('extracting');
    setError(null);
    setElapsed(0);
    const t0 = Date.now();
    if (timer.current) clearInterval(timer.current);
    timer.current = setInterval(() => setElapsed(Math.floor((Date.now() - t0) / 1000)), 500);
    try {
      let res: Response | null = null;
      let json: { error?: { code: string; message: string; retryable: boolean } } & Record<string, unknown> = {};
      // 타임아웃·5xx는 1회 자동 재시도(Spec 10.1)
      for (let attempt = 0; attempt < 2; attempt++) {
        res = await fetch('/api/menus', {
          method: 'POST',
          headers: { 'content-type': 'application/json', ...(demoKey ? { 'x-demo-key': demoKey } : {}) },
          body: JSON.stringify({ storeName: storeName.trim() || null, ...body }),
        });
        json = await res.json().catch(() => ({}));
        if (res.ok || !(res.status === 502 || res.status === 504) || body.fixture) break;
      }
      if (!res || !res.ok) {
        const code = json.error?.code;
        const msg =
          code === 'NO_MENU_FOUND'
            ? '메뉴를 찾지 못했어요. 메뉴판이 화면에 꽉 차게 다시 찍어 주세요'
            : code === 'IMAGE_TOO_LARGE'
              ? '사진이 너무 커요. 다시 찍어 주세요'
              : code === 'UNSUPPORTED_IMAGE'
                ? 'JPEG로 다시 올려 주세요'
                : code === 'STORAGE_FAILED'
                  ? '저장하지 못했습니다. 다시 읽기를 눌러 주세요'
                : code === 'CREATE_DISABLED'
                  ? '지금은 새 메뉴를 만들 수 없어요(행사 종료)'
                  : code === 'MODEL_UNAVAILABLE'
                    ? 'AI 연결이 설정되지 않았어요. 데모 키가 있으면 "데모 메뉴판으로 만들기"를 눌러 주세요'
                    : '메뉴판을 읽지 못했어요. 다시 읽기를 눌러 주세요';
        setPhase('error');
        setError({ message: msg, retryable: code !== 'NO_MENU_FOUND' && code !== 'CREATE_DISABLED' });
        return;
      }
      const ok = json as unknown as { menuId: string; adminKey: string; draft: { store_name: string | null; warnings: string[]; items: MenuItemBase[] }; meta: { fixture: boolean; latencyMs: number } };
      const state: DraftState = { menuId: ok.menuId, storeName: ok.draft.store_name, warnings: ok.draft.warnings, items: ok.draft.items, fixture: ok.meta.fixture };
      lsSet(keys.draft(ok.menuId), { ...state, savedAt: Date.now() });
      lsSet(keys.adminKey(ok.menuId), ok.adminKey);
      try {
        sessionStorage.setItem('menutalk:lastExtractMs', String(ok.meta.latencyMs));
      } catch {}
      setPhase('done');
      router.push(`/admin/${ok.menuId}#k=${ok.adminKey}`);
    } catch {
      setPhase('error');
      setError({ message: '네트워크가 불안정해요. 다시 읽기를 눌러 주세요', retryable: true });
    } finally {
      if (timer.current) clearInterval(timer.current);
    }
  }

  const busy = phase === 'resizing' || phase === 'extracting';

  return (
    <div className="mt-6 grid gap-5">
      <label className="grid gap-1">
        <span className="text-sm font-semibold">가게 이름 (선택)</span>
        <input value={storeName} onChange={(e) => setStoreName(e.target.value)} maxLength={60} placeholder="예: 을지로 영순식당" className="rounded-xl border border-line bg-card px-4 py-3" disabled={busy} />
      </label>

      <label className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line bg-card px-4 py-10 text-center ${busy ? 'opacity-60' : ''}`}>
        <span className="text-4xl" aria-hidden>📷</span>
        <span className="text-lg font-bold">메뉴판 사진 선택</span>
        <span className="text-sm text-muted">카메라로 찍거나 앨범에서 고르세요 (JPEG·PNG·WEBP)</span>
        <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={busy} onChange={(e) => onFile(e.target.files?.[0])} data-testid="menu-photo" />
      </label>

      {phase === 'resizing' && <p className="text-center text-muted">사진을 줄이는 중…</p>}
      {phase === 'extracting' && (
        <div className="rounded-2xl bg-card p-5 text-center shadow-sm" role="status">
          <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-4 border-line border-t-brand" />
          <p className="font-semibold">{WAIT_MESSAGES[Math.min(WAIT_MESSAGES.length - 1, Math.floor(elapsed / 10))]}</p>
          <p className="mt-1 text-sm text-muted">{elapsed}초 경과 · 보통 20초 안팎</p>
        </div>
      )}
      {phase === 'error' && error && (
        <div className="grid gap-3 rounded-2xl border border-danger/30 bg-red-50 p-4" role="alert">
          <p className="font-semibold text-danger">{error.message}</p>
          {error.retryable && dataUrl && (
            <div className="flex flex-wrap gap-2">
              <button className="rounded-full bg-brand px-4 py-2 text-sm font-bold text-brand-ink" onClick={() => extract({ imageDataUrl: dataUrl })}>다시 읽기</button>
              <button className="rounded-full border border-line bg-card px-4 py-2 text-sm" onClick={() => extract({ imageDataUrl: dataUrl, detail: 'original' })}>원본 해상도로 다시 읽기</button>
              <button className="rounded-full border border-line bg-card px-4 py-2 text-sm" onClick={() => extract({ imageDataUrl: dataUrl, retryWith: 'sol' })}>다른 모델로 다시 읽기</button>
            </div>
          )}
        </div>
      )}
      {resizeMs !== null && phase !== 'idle' && <p className="text-xs text-muted">리사이즈 {resizeMs}ms</p>}

      <details className="rounded-xl border border-line bg-card p-4 text-sm">
        <summary className="cursor-pointer font-semibold">데모·개발 도구</summary>
        <p className="mt-2 text-muted">모델 없이 정답표(fixture)로 초안을 만듭니다. 프로덕션에서는 데모 키가 필요합니다.</p>
        <input value={demoKey} onChange={(e) => { setDemoKey(e.target.value); lsSet(keys.demoKey, e.target.value); }} placeholder="데모 키 (x-demo-key)" className="mt-2 w-full rounded-lg border border-line px-3 py-2" type="password" />
        <button className="mt-2 rounded-full border border-line px-4 py-2" disabled={busy} onClick={() => extract({ fixture: true })} data-testid="fixture-btn">
          데모 메뉴판으로 만들기
        </button>
      </details>
    </div>
  );
}
