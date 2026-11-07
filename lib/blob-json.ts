import 'server-only';
// Spec 7.7 / 12.1: Blob JSON 헬퍼(도메인 무관). 토큰이 없는 개발 환경에서는 .local-blob/ 폴더로 대체(DECISIONS D-05).
import { get, head, put } from '@vercel/blob';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const LOCAL_DIR = path.join(process.cwd(), '.local-blob');

export function blobMode(): 'vercel' | 'local' {
  const hasToken = Boolean(process.env.BLOB_READ_WRITE_TOKEN || (process.env.BLOB_STORE_ID && process.env.VERCEL_OIDC_TOKEN));
  if (hasToken && process.env.LOCAL_BLOB !== 'true') return 'vercel';
  if (process.env.VERCEL_ENV === 'production') return 'vercel'; // 프로덕션에서는 로컬 대체를 쓰지 않는다
  return 'local';
}

/** AC-27 시험용: 이 값이 있으면 읽기 경로 앞에 붙여 일부러 실패시킨다 */
const readPrefix = () => process.env.BLOB_READ_PREFIX || '';

function localPath(p: string) {
  const full = path.join(LOCAL_DIR, p);
  if (!full.startsWith(LOCAL_DIR)) throw new Error('bad path');
  return full;
}

export class BlobExistsError extends Error {}

export async function readJson<T>(p: string, opts: { fresh?: boolean } = {}): Promise<T | null> {
  const target = readPrefix() + p;
  if (blobMode() === 'local') {
    try {
      return JSON.parse(await fs.readFile(localPath(target), 'utf8')) as T;
    } catch (e: unknown) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw e;
    }
  }
  const res = await get(target, { access: 'public', useCache: opts.fresh ? false : true });
  if (!res || res.statusCode !== 200 || !res.stream) return null;
  const text = await new Response(res.stream).text();
  return JSON.parse(text) as T;
}

export async function writeJson(
  p: string,
  data: unknown,
  opts: { overwrite: boolean; maxAge?: number; dryRun?: boolean },
): Promise<void> {
  if (opts.dryRun) return;
  const body = JSON.stringify(data);
  if (blobMode() === 'local') {
    const full = localPath(p);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, body, { flag: opts.overwrite ? 'w' : 'wx' }).catch((e: NodeJS.ErrnoException) => {
      if (e.code === 'EEXIST') throw new BlobExistsError(p);
      throw e;
    });
    return;
  }
  await put(p, body, {
    access: 'public',
    contentType: 'application/json; charset=utf-8',
    addRandomSuffix: false,
    allowOverwrite: opts.overwrite,
    cacheControlMaxAge: opts.maxAge ?? 60,
  });
}

/** 바이너리(mp3) 저장. 이미 있으면 BlobExistsError */
export async function putBinary(p: string, data: Buffer, contentType: string): Promise<string> {
  if (blobMode() === 'local') {
    const full = localPath(p);
    await fs.mkdir(path.dirname(full), { recursive: true });
    try {
      await fs.writeFile(full, data, { flag: 'wx' });
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'EEXIST') throw new BlobExistsError(p);
      throw e;
    }
    return `/api/local-blob/${p}`;
  }
  try {
    const r = await put(p, data, { access: 'public', contentType, addRandomSuffix: false });
    return r.url;
  } catch (e) {
    if (e instanceof Error && /already exists/i.test(e.message)) throw new BlobExistsError(p);
    throw e;
  }
}

/** 있으면 공개 URL, 없으면 null */
export async function headUrl(p: string): Promise<string | null> {
  if (blobMode() === 'local') {
    try {
      await fs.access(localPath(p));
      return `/api/local-blob/${p}`;
    } catch {
      return null;
    }
  }
  try {
    const h = await head(p);
    return h.url;
  } catch {
    return null;
  }
}

export async function readLocalFile(p: string): Promise<Buffer | null> {
  try {
    return await fs.readFile(localPath(p));
  } catch {
    return null;
  }
}

export const paths = {
  draft: (id: string) => `menus/${id}/draft.json`,
  published: (id: string) => `menus/${id}/published.json`,
  audio: (id: string, itemId: string, lang: string, hash: string) => `audio/${id}/${itemId}.${lang}.${hash}.mp3`,
};
