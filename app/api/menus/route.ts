// Spec 6.1 POST /api/menus — 사진 → 초안 생성
import { paths, writeJson } from '@/lib/blob-json';
import { callStructured } from '@/lib/openai/structured';
import { mapUpstream } from '@/lib/server/upstream';
import { normalizeExtractedItems } from '@/lib/publish';
import { loadFixtureDraft } from '@/lib/fixture-menu';
import { menuExtractionSchema, zExtraction } from '@/lib/schemas';
import { EFFORT, flags, MODELS } from '@/lib/server/env';
import { ApiError, errorResponse, isDemoRequest, newAdminKey, newMenuId, readJsonLimited, sha256hex } from '@/lib/server/http';
import type { MenuDraft } from '@/lib/types';
import { EXTRACT_INSTRUCTIONS, extractUserText } from '@/prompts/extract';
import { z } from 'zod';

export const runtime = 'nodejs';
export const maxDuration = 120;

const MAX_DATA_URL = 4 * 1024 * 1024;

const zBody = z.object({
  storeName: z.string().max(60).nullable().optional(),
  imageDataUrl: z.string().optional(),
  retryWith: z.enum(['sol']).nullable().optional(),
  detail: z.enum(['auto', 'original']).optional(),
  fixture: z.boolean().optional(),
  dryRun: z.boolean().optional(),
});

export async function POST(req: Request) {
  try {
    const raw = await readJsonLimited(req, MAX_DATA_URL + 64 * 1024).catch((e) => {
      if (e instanceof ApiError && e.status === 413) throw new ApiError(400, 'IMAGE_TOO_LARGE', 'Image must be 4MB or smaller');
      throw e;
    });
    const parsed = zBody.safeParse(raw);
    if (!parsed.success) throw new ApiError(400, 'BAD_REQUEST', 'Invalid body');
    const body = parsed.data;
    const demo = isDemoRequest(req);
    const privileged = demo || flags.isDev();

    if (!flags.createEnabled() && !demo) throw new ApiError(403, 'CREATE_DISABLED', 'Menu creation is disabled');
    if (body.fixture && !privileged) throw new ApiError(403, 'DEMO_ONLY', 'fixture requires x-demo-key');
    if (body.dryRun && !privileged) throw new ApiError(403, 'DEMO_ONLY', 'dryRun requires x-demo-key');

    const storeName = body.storeName?.trim() || null;
    const detail = body.detail ?? 'auto';
    let draftCore: Pick<MenuDraft, 'store_name' | 'warnings' | 'items' | 'source'>;

    if (body.fixture) {
      const f = loadFixtureDraft();
      draftCore = {
        store_name: storeName ?? f.store_name,
        warnings: f.warnings,
        items: f.items,
        source: { model: 'fixture', effort: 'none', detail, latency_ms: 0, usage: {}, fixture: true },
      };
    } else {
      const img = body.imageDataUrl ?? '';
      if (!img) throw new ApiError(400, 'UNSUPPORTED_IMAGE', 'imageDataUrl is required');
      if (img.length > MAX_DATA_URL) throw new ApiError(400, 'IMAGE_TOO_LARGE', 'Image must be 4MB or smaller');
      if (!/^data:image\/(jpeg|png|webp);base64,/.test(img)) throw new ApiError(400, 'UNSUPPORTED_IMAGE', 'Use JPEG, PNG or WEBP');
      if (!flags.hasOpenAiKey()) throw new ApiError(503, 'MODEL_UNAVAILABLE', 'OpenAI key is not configured', false);

      const model = body.retryWith === 'sol' ? MODELS.extractRetry : MODELS.extract;
      const effort = body.retryWith === 'sol' ? 'low' : EFFORT.extract;
      let r;
      try {
        r = await callStructured({
          kind: 'extract',
          model,
          effort,
          instructions: EXTRACT_INSTRUCTIONS,
          input: [
            { type: 'input_text', text: extractUserText(storeName) },
            detail === 'original' ? { type: 'input_image', image_url: img, detail: 'original' } : { type: 'input_image', image_url: img },
          ],
          schemaName: 'menu_extraction',
          schema: menuExtractionSchema as unknown as Record<string, unknown>,
          maxOutputTokens: 25_000,
          zod: zExtraction,
        });
      } catch (e) {
        throw mapUpstream(e);
      }
      draftCore = {
        store_name: storeName ?? r.data.store_name,
        warnings: r.data.warnings,
        items: normalizeExtractedItems(r.data.items),
        source: { model, effort, detail, latency_ms: r.latencyMs, usage: r.usage, fixture: false },
      };
    }

    if (draftCore.items.length === 0) {
      throw new ApiError(422, 'NO_MENU_FOUND', '메뉴를 찾지 못했어요. 메뉴판이 화면에 꽉 차게 다시 찍어 주세요', false, { warnings: draftCore.warnings });
    }

    const dryRun = Boolean(body.dryRun);
    const menuId = dryRun ? null : newMenuId();
    const adminKey = dryRun ? null : newAdminKey();
    if (menuId && adminKey) {
      const draft: MenuDraft = {
        menu_id: menuId,
        admin_key_hash: sha256hex(adminKey),
        created_at: new Date().toISOString(),
        ...draftCore,
      };
      // draft.json은 불변: allowOverwrite 없이 1회만 쓴다
      try {
        await writeJson(paths.draft(menuId), draft, { overwrite: false, maxAge: 60 });
      } catch (e) {
        console.error('draft write failed', e instanceof Error ? e.message : e);
        throw new ApiError(503, 'STORAGE_FAILED', '저장하지 못했습니다', true);
      }
    }

    return Response.json(
      {
        menuId,
        adminKey,
        adminUrl: menuId ? `/admin/${menuId}#k=${adminKey}` : null,
        draft: { store_name: draftCore.store_name, warnings: draftCore.warnings, items: draftCore.items },
        meta: {
          model: draftCore.source.model,
          effort: draftCore.source.effort,
          detail,
          latencyMs: draftCore.source.latency_ms,
          usage: draftCore.source.usage,
          fixture: draftCore.source.fixture,
        },
      },
      { status: 201 },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
