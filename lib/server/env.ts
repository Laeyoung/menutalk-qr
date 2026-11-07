import 'server-only';

// 모델 이름은 env로 바꿀 수 있다(DECISIONS D-04). 기본값은 Spec 7.1.
export const MODELS = {
  extract: process.env.MODEL_EXTRACT || 'gpt-6.1-terra',
  extractRetry: process.env.MODEL_EXTRACT_RETRY || 'gpt-6.1-sol',
  localize: process.env.MODEL_LOCALIZE || process.env.MODEL_EXTRACT || 'gpt-6.1-terra',
  order: process.env.MODEL_ORDER || 'gpt-6-luna',
  tts: process.env.MODEL_TTS || 'gpt-4o-mini-tts',
  stt: process.env.MODEL_STT || 'gpt-transcribe',
};

export const EFFORT = {
  extract: (process.env.EFFORT_EXTRACT || 'low') as Effort,
  localize: (process.env.EFFORT_LOCALIZE || 'none') as Effort,
  order: (process.env.EFFORT_ORDER || 'none') as Effort,
};

export type Effort = 'none' | 'minimal' | 'low' | 'medium' | 'high';

export const TTS_VOICE = process.env.TTS_VOICE || 'marin';

export const flags = {
  createEnabled: () => process.env.CREATE_ENABLED !== 'false',
  orderModelEnabled: () => process.env.ORDER_MODEL_ENABLED !== 'false',
  hasOpenAiKey: () => Boolean(process.env.OPENAI_API_KEY),
  isProd: () => process.env.VERCEL_ENV === 'production',
  isDev: () => process.env.NODE_ENV !== 'production' || process.env.VERCEL_ENV === 'development',
};

export const DEMO_MENU_ID = () => process.env.DEMO_MENU_ID || '';
export const DEMO_KEY = () => process.env.DEMO_KEY || '';

/** 공개 URL 기준(QR에 넣는 주소). 요청 헤더로 판단하고, env가 있으면 그것을 쓴다. */
export function siteOrigin(req: Request): string {
  if (process.env.PUBLIC_ORIGIN) return process.env.PUBLIC_ORIGIN.replace(/\/$/, '');
  const h = req.headers;
  const host = h.get('x-forwarded-host') || h.get('host') || 'localhost:3000';
  const proto = h.get('x-forwarded-proto') || (host.startsWith('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}
