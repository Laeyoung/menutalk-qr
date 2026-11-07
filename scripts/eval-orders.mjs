#!/usr/bin/env node
// AC-31/32/33/34: fixtures/order-utterances.json 10건을 /api/order-card(텍스트)로 보내 매칭·충돌 누락·지연을 표로 낸다.
// 사용: node scripts/eval-orders.mjs --base http://localhost:3000 --menu <공개된 데모 메뉴 id>
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const argv = process.argv.slice(2);
const arg = (k, d) => (argv.includes('--' + k) ? argv[argv.indexOf('--' + k) + 1] : d);
const base = arg('base', 'http://localhost:3000').replace(/\/$/, '');
const menuId = arg('menu', process.env.DEMO_MENU_ID);
if (!menuId) throw new Error('--menu required');

const { cases } = JSON.parse(await readFile(path.resolve(import.meta.dirname, '../fixtures/order-utterances.json'), 'utf8'));
let matchOk = 0, conflictMiss = 0, under5 = 0;
for (const [i, c] of cases.entries()) {
  const fd = new FormData();
  fd.set('menuId', menuId); fd.set('lang', c.lang); fd.set('text', c.text);
  fd.set('cart', JSON.stringify(c.cart)); fd.set('chips', '[]'); fd.set('guestAllergens', '[]');
  const t0 = Date.now();
  const res = await fetch(base + '/api/order-card', { method: 'POST', body: fd });
  const ms = Date.now() - t0;
  const card = await res.json();
  if (!res.ok) { console.log(`#${i + 1} ERROR ${res.status} ${JSON.stringify(card.error)}`); continue; }
  const got = card.lines_ko.filter((l) => l.item_id).map((l) => l.text_ko).sort();
  const match = JSON.stringify(got) === JSON.stringify([...c.expect_items].sort()) && (!c.expect_unmatched || card.lines_ko.some((l) => !l.item_id) || card.unmatched_note);
  const gotConf = new Set(card.conflicts.map((x) => `${card.lines_ko.find((l) => l.item_id === x.item_id)?.text_ko}:${x.allergen}`));
  const missed = c.expect_conflicts.filter((x) => !gotConf.has(x));
  if (match) matchOk++;
  conflictMiss += missed.length;
  if (ms <= 5000) under5++;
  console.log(`#${i + 1} ${c.lang.padEnd(7)} ${match ? 'OK  ' : 'MISS'} items=${JSON.stringify(got)} conflicts=${[...gotConf].join(',') || '-'}${missed.length ? ' MISSED=' + missed : ''} ${ms}ms`);
}
console.log(`\nAC-31 menu match ${matchOk}/${cases.length} (pass ≥9) · AC-32 conflict misses ${conflictMiss} (pass 0) · ≤5s ${under5}/${cases.length}`);
