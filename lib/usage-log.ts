import 'server-only';
// Spec 12.1: 호출별 사용량 한 줄 로그(비용 슬라이드 근거). 발화 원문은 남기지 않는다.

export interface UsageLine {
  kind: string;
  model: string;
  effort?: string;
  input_tokens?: number;
  output_tokens?: number;
  reasoning_tokens?: number;
  latency_ms: number;
  extra?: Record<string, string | number | boolean | null>;
}

export function logUsage(u: UsageLine) {
  console.log('usage ' + JSON.stringify(u));
}
