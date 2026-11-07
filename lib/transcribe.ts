import 'server-only';
// Spec 7.5: gpt-transcribe. languages 배열(단수 language와 함께 보내지 않는다), keywords는 금지 문자 제거.
import { toFile } from 'openai';
import { openai, toStructuredError } from './openai/structured';
import { MODELS } from './server/env';
import { logUsage } from './usage-log';

export function cleanKeywords(words: string[], max = 25): string[] {
  const out: string[] = [];
  for (const w of words) {
    const c = w.replace(/[<>\r\n]/g, ' ').replace(/\s+/g, ' ').trim();
    if (c && !out.includes(c)) out.push(c);
    if (out.length >= max) break;
  }
  return out;
}

export async function transcribe(args: {
  file: Buffer;
  fileName: string;
  mime: string;
  languages: string[];
  prompt: string;
  keywords: string[];
}): Promise<{ text: string; latencyMs: number }> {
  const started = Date.now();
  try {
    const file = await toFile(args.file, args.fileName, { type: args.mime || undefined });
    const request = { file, model: MODELS.stt, prompt: args.prompt };
    const keywords = cleanKeywords(args.keywords);
    // 공식 예시 형식: 두 번째 인자 body에 request를 펼친 뒤 languages·keywords를 더한다(Spec 7.5).
    // SDK 7.50 타입에도 두 필드가 있어 첫 인자에도 같이 넣는다.
    const res = await openai().audio.transcriptions.create(
      { ...request, languages: args.languages, keywords } as Parameters<ReturnType<typeof openai>['audio']['transcriptions']['create']>[0],
      { timeout: 30_000 },
    );
    const text = (typeof res === 'string' ? res : (res as { text?: string }).text ?? '').trim();
    const latencyMs = Date.now() - started;
    logUsage({ kind: 'stt', model: MODELS.stt, latency_ms: latencyMs, extra: { mime: args.mime, bytes: args.file.length, chars: text.length } });
    return { text, latencyMs };
  } catch (e) {
    throw toStructuredError(e);
  }
}
