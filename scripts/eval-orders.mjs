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

// prep/02-talking-menu-qr/order-utterances.json 형식: { utterances: [{ id, screen_lang, text, expected: { lines_ko, guest_allergens, conflicts, unmatched_note_expected } }] }
const { utterances } = JSON.parse(await readFile(path.resolve(import.meta.dirname, '../fixtures/order-utterances.json'), 'utf8'));
const LANG_OK = new Set(['en', 'ja', 'zh-Hans', 'zh-Hant', 'es', 'ko']);
let matchOk = 0, conflictMiss = 0, under5 = 0, ran = 0;
for (const u of utterances) {
  const fd = new FormData();
  fd.set('menuId', menuId); fd.set('lang', LANG_OK.has(u.screen_lang) ? u.screen_lang : 'en'); fd.set('text', u.text);
  fd.set('cart', '[]'); fd.set('chips', '[]'); fd.set('guestAllergens', '[]');
  const t0 = Date.now();
  const res = await fetch(base + '/api/order-card', { method: 'POST', body: fd });
  const ms = Date.now() - t0;
  const card = await res.json();
  if (!res.ok) { console.log(`${u.id} ERROR ${res.status} ${JSON.stringify(card.error)}`); continue; }
  ran++;
  const key = (l) => `${l.item_id ?? 'null'}x${l.qty ?? '?'}`;
  const got = card.lines_ko.map(key).sort();
  const exp = u.expected.lines_ko.map(key).sort();
  const unmatchedOk = !u.expected.unmatched_note_expected || Boolean(card.unmatched_note);
  const match = JSON.stringify(got) === JSON.stringify(exp) && unmatchedOk;
  const gotConf = new Set(card.conflicts.map((x) => `${x.item_id}:${x.allergen}`));
  const missed = u.expected.conflicts.map((x) => `${x.item_id}:${x.allergen}`).filter((x) => !gotConf.has(x));
  if (match) matchOk++;
  conflictMiss += missed.length;
  if (ms <= 5000) under5++;
  console.log(`${u.id} ${u.screen_lang.padEnd(7)} ${match ? 'OK  ' : 'MISS'} lines=${got.join(',')} (exp ${exp.join(',')}) conflicts=${[...gotConf].join(',') || '-'}${missed.length ? ' MISSED=' + missed : ''} ${ms}ms`);
}
console.log(`\nAC-31 menu match ${matchOk}/${utterances.length} (pass ≥9) · AC-32 conflict misses ${conflictMiss} (pass 0) · ≤5s ${under5}/${ran}`);
