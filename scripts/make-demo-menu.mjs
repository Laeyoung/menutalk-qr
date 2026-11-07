#!/usr/bin/env node
// Plan R1 / Spec 10.2: 데모 메뉴를 만들어 공개하고 정적 사본(public/demo/menu.json)을 저장한다.
// 흐름: fixture 초안 생성 → demo-overrides 적용(가게 확인) → (언어 × 묶음) 현지화 → publish → GET 공개본 저장
// 사용: node scripts/make-demo-menu.mjs --base http://localhost:3000 [--key DEMO_KEY] [--langs en,ja,zh-Hans,zh-Hant,es] [--model-localize] [--out public/demo/menu.json] [--static-id demo]
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, arr) => {
    if (a.startsWith('--')) acc.push([a.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true]);
    return acc;
  }, []),
);
const base = (args.base || 'http://localhost:3000').replace(/\/$/, '');
const demoKey = args.key || process.env.DEMO_KEY || '';
const langs = (args.langs || 'en,ja,zh-Hans,zh-Hant,es,ko').split(',');
const useModel = Boolean(args['model-localize']);
const out = args.out || 'public/demo/menu.json';
const staticId = args['static-id'];
const root = path.resolve(import.meta.dirname, '..');

async function call(p, opts = {}) {
  const res = await fetch(base + p, opts);
  const j = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`${p} → ${res.status} ${JSON.stringify(j?.error ?? j)}`);
  return j;
}
const hdr = (extra = {}) => ({ 'content-type': 'application/json', ...(demoKey ? { 'x-demo-key': demoKey } : {}), ...extra });

const created = await call('/api/menus', { method: 'POST', headers: hdr(), body: JSON.stringify({ fixture: true }) });
const { menuId, adminKey } = created;
console.log('created', menuId);

const overrides = JSON.parse(await readFile(path.join(root, 'fixtures/demo-overrides.json'), 'utf8'));
const items = created.draft.items.map((i) => {
  const o = overrides.items[i.name_ko];
  return o ? { ...i, allergens: o.allergens, allergens_source: o.allergens_source } : i;
});

const bundles = [];
for (let i = 0; i < items.length; i += 10) bundles.push(items.slice(i, i + 10));
const locales = {};
const t0 = Date.now();
await Promise.all(
  langs.flatMap((lang) =>
    bundles.map(async (b) => {
      const input = b.map((i) => ({ item_id: i.item_id, name_ko: i.name_ko, category: i.category, main_ingredients_ko: i.main_ingredients_ko, spice_level: i.spice_level }));
      const r = await call(`/api/menus/${menuId}/localize`, { method: 'POST', headers: hdr({ 'x-admin-key': adminKey }), body: JSON.stringify({ lang, items: input, ...(useModel ? {} : { fixture: true }) }) });
      (locales[lang] ??= []).push(...r.items);
      console.log(`  localize ${lang} ${b[0].item_id}-${b.at(-1).item_id} ${r.meta.latencyMs}ms tokens=${r.meta.outputTokens}`);
    }),
  ),
);
console.log(`localized in ${Date.now() - t0}ms`);

const pub = await call(`/api/menus/${menuId}/publish`, { method: 'POST', headers: hdr({ 'x-admin-key': adminKey }), body: JSON.stringify({ storeName: created.draft.store_name, langs, items, locales }) });
console.log('published', pub.publicUrl);

const menu = pub.published;
if (staticId) menu.menu_id = staticId;
await mkdir(path.dirname(path.join(root, out)), { recursive: true });
await writeFile(path.join(root, out), JSON.stringify(menu, null, 2) + '\n');
console.log('static copy →', out);
console.log('\nDEMO_MENU_ID=' + menuId);
console.log('admin URL: ' + base + `/admin/${menuId}#k=${adminKey}`);
