import 'server-only';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { DEMO_KEY } from './env';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public retryable = false,
    public details?: unknown,
  ) {
    super(message);
  }
}

export function errorResponse(e: unknown): Response {
  if (e instanceof ApiError) {
    return Response.json(
      { error: { code: e.code, message: e.message, retryable: e.retryable, ...(e.details ? { details: e.details } : {}) } },
      { status: e.status },
    );
  }
  console.error('unhandled', e instanceof Error ? e.message : e);
  return Response.json({ error: { code: 'INTERNAL', message: 'Internal error', retryable: true } }, { status: 500 });
}

export function sha256hex(s: string): string {
  return createHash('sha256').update(s).digest('hex');
}

/** 관리 키 검사: 해시끼리 timingSafeEqual */
export function checkKey(given: string | null, expectedHash: string): boolean {
  if (!given) return false;
  const a = Buffer.from(sha256hex(given), 'hex');
  const b = Buffer.from(expectedHash, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

export function isDemoRequest(req: Request): boolean {
  const k = DEMO_KEY();
  const given = req.headers.get('x-demo-key');
  if (!k || !given) return false;
  const a = Buffer.from(sha256hex(given), 'hex');
  const b = Buffer.from(sha256hex(k), 'hex');
  return timingSafeEqual(a, b);
}

// menuId: 10자, 혼동 문자(0 o 1 l i)를 뺀 31자 알파벳 (Spec 5.1)
const ID_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';

export function newMenuId(): string {
  const bytes = randomBytes(10);
  return [...bytes].map((b) => ID_ALPHABET[b % ID_ALPHABET.length]).join('');
}

export function newAdminKey(): string {
  return randomBytes(24).toString('base64url').slice(0, 32);
}

export function isValidMenuId(id: string): boolean {
  return /^[a-hjkmnp-z2-9]{10}$/.test(id);
}

/**
 * 본문을 maxBytes까지만 읽어 JSON으로 파싱한다. Content-Length가 없거나(chunked) 거짓이어도
 * 실제 읽은 바이트로 끊는다. 초과 시 413, 형식 오류 시 400.
 */
export async function readJsonLimited(req: Request, maxBytes: number): Promise<unknown> {
  const declared = Number(req.headers.get('content-length') || 0);
  if (declared > maxBytes) throw new ApiError(413, 'TOO_LARGE', 'Input too large');
  if (!req.body) return null;
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => {});
      throw new ApiError(413, 'TOO_LARGE', 'Input too large');
    }
    chunks.push(value);
  }
  if (total === 0) return null;
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new ApiError(400, 'BAD_INPUT', 'Body must be JSON');
  }
}
