// localStorage 래퍼: 사생활 보호 모드 등에서 예외가 나도 앱이 멈추지 않게(Spec S2·S4)
export function lsGet<T>(key: string, fallback: T): T {
  try {
    const v = window.localStorage.getItem(key);
    return v == null ? fallback : (JSON.parse(v) as T);
  } catch {
    return fallback;
  }
}

export function lsSet(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

export function lsDel(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export const keys = {
  draft: (id: string) => `menutalk:draft:${id}`,
  adminKey: (id: string) => `menutalk:admin:${id}`,
  lang: 'menutalk:lang',
  allergies: 'menutalk:allergies',
  allergiesAsked: 'menutalk:allergiesAsked',
  samples: 'menutalk:samples',
  demoKey: 'menutalk:demoKey',
  demoAdminUrl: 'menutalk:demoAdminUrl',
};

/** URL 해시 #k=... 읽기 (관리 키·데모 키는 서버 로그와 Referer에 남지 않게 해시로 받는다) */
export function hashKey(): string | null {
  if (typeof window === 'undefined') return null;
  const m = window.location.hash.match(/[#&]k=([^&]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}
