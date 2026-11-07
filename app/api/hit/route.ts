// Spec 6.8 POST /api/hit — 접속 집계 로그 한 줄. 저장하지 않는다.
export const runtime = 'nodejs';

export async function POST(req: Request) {
  const body = (await req.text().catch(() => '')).slice(0, 40).replace(/[^a-z0-9]/gi, '');
  console.log('hit', body || '-', new Date().toISOString());
  return new Response(null, { status: 204 });
}
