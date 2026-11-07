// Spec 5.2 tts_text 생성 규칙. 서버 publish와 브라우저(speechSynthesis)가 같은 함수를 쓴다.
// 해시는 서버에서만 계산한다(lib/server/hash.ts).
import { isCjk } from './i18n/strings';
import type { LangCode, LocalizedItem } from './types';

const LIMIT = { latin: 260, cjk: 130, ko: 150 };

const EMOJI_RE = /[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu;
const SYMBOL_RE = /[★☆※•·▶►♪♥♡◆◇■□●○→←↑↓~^*#_|<>\[\]{}]/g;

/** `プデチゲ（部隊チゲ）` → `プデチゲ、部隊チゲ`, `Budae-jjigae (Army Stew)` → `Budae-jjigae, Army Stew` */
export function normalizeName(name: string, lang: LangCode): string {
  const cjk = isCjk(lang);
  const sep = cjk ? '、' : ', ';
  const m = name.match(/^(.*?)[\s]*[（(]([^）)]*)[）)]\s*(.*)$/);
  if (!m) return name.trim();
  const [, head, inner, tail] = m;
  const parts = [head.trim()];
  if (inner.trim() && inner.trim() !== head.trim()) parts.push(inner.trim());
  if (tail.trim()) parts.push(tail.trim());
  return parts.join(sep);
}

function clean(s: string): string {
  return s.replace(EMOJI_RE, '').replace(SYMBOL_RE, ' ').replace(/\s+/g, ' ').trim();
}

function endSentence(s: string, cjk: boolean): string {
  const t = s.trim();
  if (!t) return '';
  if (/[.!?。！？]$/.test(t)) return t;
  return t + (cjk ? '。' : '.');
}

/** 문장 경계에서 자른다. 경계가 없으면 글자 수로 자른다. */
function truncate(s: string, max: number, cjk: boolean): string {
  if ([...s].length <= max) return s;
  const chars = [...s].slice(0, max).join('');
  const re = cjk ? /[。！？]/g : /[.!?](\s|$)/g;
  let last = -1;
  let m: RegExpExecArray | null;
  while ((m = re.exec(chars))) last = m.index + 1;
  if (last > max * 0.4) return chars.slice(0, last).trim();
  return chars.trim();
}

export function buildTtsText(item: Pick<LocalizedItem, 'name' | 'short' | 'detail'>, lang: LangCode): string {
  const cjk = isCjk(lang);
  const joiner = cjk ? '' : ' ';
  const text = [
    endSentence(clean(normalizeName(item.name, lang)), cjk),
    endSentence(clean(item.short), cjk),
    endSentence(clean(item.detail), cjk),
  ]
    .filter(Boolean)
    .join(joiner);
  return truncate(text, cjk ? LIMIT.cjk : lang === 'ko' ? LIMIT.ko : LIMIT.latin, cjk);
}
