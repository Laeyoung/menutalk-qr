import 'server-only';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { paths, readJson } from '../blob-json';
import type { MenuDraft, PublishedMenu } from '../types';
import { DEMO_MENU_ID } from './env';
import { ApiError, checkKey, isValidMenuId } from './http';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** draft.json 읽기. 404면 1초 뒤 한 번 더(Spec 6.3) */
export async function loadDraft(id: string): Promise<MenuDraft> {
  if (!isValidMenuId(id)) throw new ApiError(404, 'MENU_NOT_FOUND', 'Menu not found');
  let d = await readJson<MenuDraft>(paths.draft(id));
  if (!d) {
    await sleep(1000);
    d = await readJson<MenuDraft>(paths.draft(id));
  }
  if (!d) throw new ApiError(404, 'MENU_NOT_FOUND', 'Menu not found', true);
  return d;
}

export async function requireAdmin(req: Request, id: string): Promise<MenuDraft> {
  const key = req.headers.get('x-admin-key');
  if (!key) throw new ApiError(401, 'BAD_ADMIN_KEY', 'Admin key required');
  const draft = await loadDraft(id);
  if (!checkKey(key, draft.admin_key_hash)) throw new ApiError(401, 'BAD_ADMIN_KEY', 'Invalid admin key');
  return draft;
}

export async function readStaticDemo(): Promise<PublishedMenu | null> {
  try {
    const raw = await fs.readFile(path.join(process.cwd(), 'public', 'demo', 'menu.json'), 'utf8');
    return JSON.parse(raw) as PublishedMenu;
  } catch {
    return null;
  }
}

/**
 * 손님 화면용 공개본. Blob 읽기가 실패하고 데모 메뉴(또는 정적 사본의 id)면 public/demo/menu.json으로 렌더(Spec S4, AC-27).
 */
export async function loadPublished(id: string, opts: { fresh?: boolean } = {}): Promise<{ menu: PublishedMenu; source: 'blob' | 'static' } | null> {
  if (!isValidMenuId(id) && id !== 'demo') return null;
  if (id !== 'demo') {
    try {
      const m = await readJson<PublishedMenu>(paths.published(id), opts);
      if (m) return { menu: m, source: 'blob' };
    } catch (e) {
      console.error('published read failed', id, e instanceof Error ? e.message : e);
    }
  }
  const staticMenu = await readStaticDemo();
  if (staticMenu && (id === 'demo' || id === DEMO_MENU_ID() || id === staticMenu.menu_id)) {
    return { menu: staticMenu, source: 'static' };
  }
  return null;
}
