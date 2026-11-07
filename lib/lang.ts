// Spec S4 언어 결정 규칙
import { LANGS, type LangCode } from './types';

export function isLangCode(v: unknown): v is LangCode {
  return typeof v === 'string' && (LANGS as readonly string[]).includes(v);
}

export function mapBrowserLang(tag: string): LangCode | null {
  const l = tag.toLowerCase();
  if (l.startsWith('ja')) return 'ja';
  if (l === 'zh-tw' || l === 'zh-hk' || l === 'zh-mo' || l.startsWith('zh-hant')) return 'zh-Hant';
  if (l.startsWith('zh')) return 'zh-Hans';
  if (l.startsWith('es')) return 'es';
  if (l.startsWith('en')) return 'en';
  return null;
}

/** navigator.languages를 순서대로 보며 매핑. ko 포함 나머지는 en으로 연다. 공개 언어에 없으면 en(없으면 첫 언어). */
export function resolveLang(browserLangs: readonly string[], published: readonly LangCode[]): LangCode {
  const fallback: LangCode = published.includes('en') ? 'en' : published[0] ?? 'en';
  for (const tag of browserLangs) {
    const m = mapBrowserLang(tag);
    if (m === null) {
      // ko 등 지원하지 않는 언어가 첫 선호면 영어로 연다(Spec 5.2 손님 1)
      return fallback;
    }
    if (published.includes(m)) return m;
    return fallback;
  }
  return fallback;
}
