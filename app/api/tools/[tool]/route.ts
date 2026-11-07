// 한끼식당 메뉴 도구 HTTP 표면(Guuey 작업지시서 6장). 계산은 lib/menu-tools.ts가 한다.
// GET  /api/tools/menu            → 도구가 쓰는 정규화 데이터(ToolMenu). Guuey worker 번들용 데이터 추출에 쓴다.
// POST /api/tools/{search_menu|check_dietary_constraints|build_order_card} → 도구 실행
import { buildHankkiToolMenu } from '@/lib/fixture-menu';
import { runTool, ToolInputError } from '@/lib/menu-tools';
import { ApiError, errorResponse, readJsonLimited } from '@/lib/server/http';

export const runtime = 'nodejs';

const TOOLS = new Set(['search_menu', 'check_dietary_constraints', 'build_order_card']);

export async function GET(_req: Request, ctx: RouteContext<'/api/tools/[tool]'>) {
  const { tool } = await ctx.params;
  if (tool !== 'menu') return Response.json({ error: { code: 'NOT_FOUND', message: 'Unknown resource', retryable: false } }, { status: 404 });
  return Response.json(buildHankkiToolMenu(), { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: Request, ctx: RouteContext<'/api/tools/[tool]'>) {
  const { tool } = await ctx.params;
  if (!TOOLS.has(tool)) return Response.json({ error: { code: 'UNKNOWN_TOOL', message: 'Unknown tool', retryable: false } }, { status: 404 });
  try {
    // Content-Length를 믿지 않고 실제로 읽은 바이트로 16KB에서 끊는다(chunked 요청 포함)
    const input = await readJsonLimited(req, 16 * 1024);
    return Response.json(runTool(buildHankkiToolMenu(), tool, input));
  } catch (e) {
    if (e instanceof ApiError) return errorResponse(e);
    if (e instanceof ToolInputError) return Response.json({ error: { code: e.code, message: e.message, retryable: false, details: e.details } }, { status: 400 });
    console.error('tool failed', tool, e instanceof Error ? e.message : e);
    return Response.json({ error: { code: 'INTERNAL', message: 'Tool failed', retryable: true } }, { status: 500 });
  }
}
