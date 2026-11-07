import 'server-only';
// Spec 12.1: callStructured — 도메인 무관. refusal·incomplete 처리, zod 재검증, 429 백오프(1초, 3초).
import OpenAI from 'openai';
import type { z } from 'zod';
import { logUsage } from '../usage-log';

let client: OpenAI | null = null;
export function openai(): OpenAI {
  if (!process.env.OPENAI_API_KEY) throw new StructuredError('NO_API_KEY', 'OPENAI_API_KEY is not set', false);
  if (!client) client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, maxRetries: 0 });
  return client;
}

export class StructuredError extends Error {
  constructor(
    public code: 'REFUSAL' | 'INCOMPLETE' | 'SCHEMA_MISMATCH' | 'UPSTREAM_ERROR' | 'UPSTREAM_TIMEOUT' | 'RATE_LIMITED' | 'NO_API_KEY' | 'BAD_REQUEST',
    message: string,
    public retryable: boolean,
    public status?: number,
  ) {
    super(message);
  }
}

type InputContent =
  | { type: 'input_text'; text: string }
  | { type: 'input_image'; image_url: string; detail?: 'auto' | 'low' | 'high' | 'original' };

export interface CallStructuredArgs<T> {
  kind: string;
  model: string;
  effort: string;
  instructions: string;
  input: InputContent[];
  schemaName: string;
  schema: Record<string, unknown>;
  maxOutputTokens: number;
  zod: z.ZodType<T>;
  timeoutMs?: number;
}

export interface StructuredResult<T> {
  data: T;
  usage: { input_tokens?: number; output_tokens?: number; reasoning_tokens?: number };
  latencyMs: number;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function callStructured<T>(args: CallStructuredArgs<T>): Promise<StructuredResult<T>> {
  const backoff = [1000, 3000];
  for (let attempt = 0; ; attempt++) {
    try {
      return await callOnce(args);
    } catch (e) {
      if (e instanceof StructuredError && e.code === 'RATE_LIMITED' && attempt < backoff.length) {
        await sleep(backoff[attempt]);
        continue;
      }
      throw e;
    }
  }
}

async function callOnce<T>(args: CallStructuredArgs<T>): Promise<StructuredResult<T>> {
  const started = Date.now();
  let res: OpenAI.Responses.Response;
  try {
    // input_image의 detail 'original'은 SDK 타입 정의보다 새로울 수 있어 느슨하게 넘긴다(Spec 7.2, Q3)
    const body = {
      model: args.model,
      reasoning: { effort: args.effort },
      max_output_tokens: args.maxOutputTokens,
      store: false,
      instructions: args.instructions,
      input: [{ role: 'user', content: args.input }],
      text: { format: { type: 'json_schema', name: args.schemaName, strict: true, schema: args.schema } },
    } as unknown as OpenAI.Responses.ResponseCreateParamsNonStreaming;
    res = await openai().responses.create(body, { timeout: args.timeoutMs ?? 110_000 });
  } catch (e) {
    throw toStructuredError(e);
  }
  const latencyMs = Date.now() - started;
  const usage = {
    input_tokens: res.usage?.input_tokens,
    output_tokens: res.usage?.output_tokens,
    reasoning_tokens: res.usage?.output_tokens_details?.reasoning_tokens,
  };
  logUsage({ kind: args.kind, model: args.model, effort: args.effort, ...usage, latency_ms: latencyMs, extra: { status: res.status ?? null } });

  if (res.status === 'incomplete') {
    throw new StructuredError('INCOMPLETE', `incomplete: ${res.incomplete_details?.reason ?? 'unknown'}`, true, 502);
  }
  for (const item of res.output ?? []) {
    if (item.type === 'message') {
      for (const c of item.content) {
        if (c.type === 'refusal') throw new StructuredError('REFUSAL', c.refusal, false, 422);
      }
    }
  }
  const text = res.output_text;
  if (!text) throw new StructuredError('UPSTREAM_ERROR', 'empty output', true, 502);
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new StructuredError('SCHEMA_MISMATCH', 'output is not JSON', true, 502);
  }
  const z = args.zod.safeParse(parsed);
  if (!z.success) throw new StructuredError('SCHEMA_MISMATCH', z.error.message.slice(0, 500), true, 502);
  return { data: z.data, usage, latencyMs };
}

export function toStructuredError(e: unknown): StructuredError {
  if (e instanceof StructuredError) return e;
  if (e instanceof OpenAI.APIConnectionTimeoutError) return new StructuredError('UPSTREAM_TIMEOUT', 'upstream timeout', true, 504);
  if (e instanceof OpenAI.APIError) {
    const s = e.status ?? 502;
    if (s === 429) return new StructuredError('RATE_LIMITED', e.message, true, 429);
    if (s === 400 || s === 403 || s === 404) return new StructuredError('BAD_REQUEST', e.message, false, s);
    if (s === 401) return new StructuredError('NO_API_KEY', 'OpenAI authentication failed', false, 502);
    return new StructuredError('UPSTREAM_ERROR', e.message, true, 502);
  }
  return new StructuredError('UPSTREAM_ERROR', e instanceof Error ? e.message : 'unknown', true, 502);
}
