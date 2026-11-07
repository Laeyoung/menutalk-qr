// 브라우저의 (언어 × 묶음) 병렬 현지화(Spec 7.3, Plan A1/E4 공유). 결과는 저장하지 않고 상태로만 돌려준다.
import type { LangCode, LocalizedItem, LocalizeInputItem, MenuItemBase } from './types';

export const BUNDLE_SIZE = 10;

export function toInput(i: MenuItemBase): LocalizeInputItem {
  return { item_id: i.item_id, name_ko: i.name_ko, category: i.category, main_ingredients_ko: i.main_ingredients_ko, spice_level: i.spice_level };
}

/** 항목을 BUNDLE_SIZE개씩 묶는다. 묶음 번호는 항목 순서로 고정된다. */
export function makeBundles(items: MenuItemBase[], size = BUNDLE_SIZE): string[][] {
  const out: string[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size).map((x) => x.item_id));
  return out;
}

export type BundleState = 'pending' | 'running' | 'done' | 'error' | 'stale';

export interface LocalizeJob {
  lang: LangCode;
  bundle: number;
}

export async function localizeBundle(args: {
  menuId: string;
  adminKey: string;
  lang: LangCode;
  items: LocalizeInputItem[];
  fixture?: boolean;
  signal?: AbortSignal;
}): Promise<{ items: LocalizedItem[]; latencyMs: number; outputTokens: number | null }> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch(`/api/menus/${args.menuId}/localize`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-admin-key': args.adminKey },
      body: JSON.stringify({ lang: args.lang, items: args.items, ...(args.fixture ? { fixture: true } : {}) }),
      signal: args.signal,
    });
    const json = await res.json().catch(() => null);
    if (res.ok) return { items: json.items, latencyMs: json.meta?.latencyMs ?? 0, outputTokens: json.meta?.outputTokens ?? null };
    lastErr = new LocalizeError(json?.error?.code ?? 'HTTP_' + res.status, json?.error?.message ?? 'localize failed', Boolean(json?.error?.retryable));
    if (!json?.error?.retryable) break;
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw lastErr;
}

export class LocalizeError extends Error {
  constructor(public code: string, message: string, public retryable: boolean) {
    super(message);
  }
}

/** 동시 실행 상한을 두고 작업을 돌린다 */
export async function runPool<T>(tasks: (() => Promise<T>)[], concurrency = 15): Promise<PromiseSettledResult<T>[]> {
  const results: PromiseSettledResult<T>[] = new Array(tasks.length);
  let next = 0;
  async function worker() {
    while (next < tasks.length) {
      const i = next++;
      try {
        results[i] = { status: 'fulfilled', value: await tasks[i]() };
      } catch (reason) {
        results[i] = { status: 'rejected', reason };
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, worker));
  return results;
}
