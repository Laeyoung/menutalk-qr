#!/usr/bin/env node
// Spec 10.2 / Plan D2: 공개 메뉴의 모든 (item, lang) 음성을 배포된 /api/audio로 미리 만든다(동시 4개).
// 사용: node scripts/pregen-audio.mjs --base https://oba02-menutalk.vercel.app --menu <menuId> [--langs en,ja]
const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, arr) => (a.startsWith('--') && acc.push([a.slice(2), arr[i + 1]]), acc), []));
const base = (args.base || 'http://localhost:3000').replace(/\/$/, '');
const menuId = args.menu || process.env.DEMO_MENU_ID;
if (!menuId) throw new Error('--menu required');
const menu = await (await fetch(`${base}/api/menus/${menuId}`)).json();
const langs = args.langs ? args.langs.split(',') : menu.langs;
const jobs = [];
for (const lang of langs) for (const it of menu.items) {
  const loc = menu.locales[lang]?.[it.item_id];
  if (loc) jobs.push({ lang, itemId: it.item_id, url: `${base}/api/audio/${menuId}/${it.item_id}/${lang}?h=${loc.tts_hash}` });
}
const failed = [];
let i = 0, done = 0;
const t0 = Date.now();
await Promise.all(Array.from({ length: 4 }, async () => {
  while (i < jobs.length) {
    const j = jobs[i++];
    const s = Date.now();
    try {
      const r = await fetch(j.url, { redirect: 'manual' });
      if (r.status !== 302) failed.push({ ...j, status: r.status });
    } catch (e) { failed.push({ ...j, status: String(e) }); }
    done++;
    process.stdout.write(`\r${done}/${jobs.length} (${Date.now() - s}ms)   `);
  }
}));
console.log(`\ndone in ${Math.round((Date.now() - t0) / 1000)}s, failed ${failed.length}`);
for (const f of failed) console.log('  FAIL', f.status, f.lang, f.itemId);
process.exit(failed.length ? 1 : 0);
