import 'server-only';
// Spec 7.4 / 12.1: TTS 호출은 이 파일 한 곳에 모은다(2027-01-06 모델 종료 대비).
// getOrCreateSpeech: 불변 경로(텍스트 해시) → 있으면 URL, 없으면 생성·저장 후 URL.
import { TTS_INSTRUCTIONS } from '@/prompts/order';
import { BlobExistsError, headUrl, putBinary } from './blob-json';
import { openai, toStructuredError } from './openai/structured';
import { MODELS, TTS_VOICE } from './server/env';
import { logUsage } from './usage-log';

export async function synthesize(text: string, opts: { voice?: string; instructions?: string } = {}): Promise<Buffer> {
  const started = Date.now();
  try {
    const res = await openai().audio.speech.create(
      {
        model: MODELS.tts,
        voice: (opts.voice ?? TTS_VOICE) as 'marin',
        input: text,
        instructions: opts.instructions ?? TTS_INSTRUCTIONS,
        response_format: 'mp3',
      },
      { timeout: 50_000 },
    );
    const buf = Buffer.from(await res.arrayBuffer());
    logUsage({ kind: 'tts', model: MODELS.tts, latency_ms: Date.now() - started, extra: { chars: text.length, bytes: buf.length } });
    return buf;
  } catch (e) {
    throw toStructuredError(e);
  }
}

export async function getOrCreateSpeech(args: { key: string; text: string; voice?: string; instructions?: string }): Promise<string> {
  const existing = await headUrl(args.key);
  if (existing) return existing;
  const audio = await synthesize(args.text, args);
  try {
    return await putBinary(args.key, audio, 'audio/mpeg');
  } catch (e) {
    // 같은 키 동시 생성: 두 번째 put 오류는 성공으로 간주(Spec 5.1)
    if (e instanceof BlobExistsError) {
      const url = await headUrl(args.key);
      if (url) return url;
    }
    throw e;
  }
}
