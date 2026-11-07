// 개발 전용: .local-blob/ 파일을 내보낸다(DECISIONS D-05). 프로덕션/vercel Blob 모드에서는 404.
import { blobMode, readLocalFile } from '@/lib/blob-json';

export const runtime = 'nodejs';

const TYPES: Record<string, string> = { mp3: 'audio/mpeg', json: 'application/json; charset=utf-8' };

export async function GET(_req: Request, ctx: RouteContext<'/api/local-blob/[...path]'>) {
  if (blobMode() !== 'local') return new Response('Not found', { status: 404 });
  const { path } = await ctx.params;
  const p = path.join('/');
  if (p.includes('..')) return new Response('Not found', { status: 404 });
  const data = await readLocalFile(p);
  if (!data) return new Response('Not found', { status: 404 });
  const ext = p.split('.').pop() || '';
  return new Response(new Uint8Array(data), {
    headers: { 'Content-Type': TYPES[ext] ?? 'application/octet-stream', 'Content-Length': String(data.length), 'Accept-Ranges': 'bytes', 'Cache-Control': 'public, max-age=60' },
  });
}
