import 'server-only';
import { StructuredError } from '../openai/structured';
import { ApiError } from './http';

export function mapUpstream(e: unknown): ApiError {
  if (e instanceof StructuredError) {
    if (e.code === 'UPSTREAM_TIMEOUT') return new ApiError(504, 'UPSTREAM_TIMEOUT', e.message, true);
    if (e.code === 'REFUSAL') return new ApiError(422, 'REFUSAL', '사진을 읽을 수 없습니다', false);
    if (e.code === 'INCOMPLETE') return new ApiError(502, 'UPSTREAM_INCOMPLETE', e.message, true);
    if (e.code === 'RATE_LIMITED') return new ApiError(429, 'RATE_LIMITED', e.message, true);
    if (e.code === 'NO_API_KEY') return new ApiError(503, 'MODEL_UNAVAILABLE', e.message, false);
    return new ApiError(502, 'UPSTREAM_ERROR', e.message, e.retryable);
  }
  return new ApiError(502, 'UPSTREAM_ERROR', 'Upstream error', true);
}
