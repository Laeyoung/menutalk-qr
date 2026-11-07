#!/usr/bin/env node
// AC-02 스모크 테스트: ① 네 모델 각 1회 ② (서버가 떠 있으면) 세 스키마 strict 워밍업 ③ 전사 languages[]·keywords[]
// 사용: node --env-file-if-exists=.env.local scripts/check-openai.mjs [--base http://localhost:3000]
import OpenAI, { toFile } from 'openai';

const base = process.argv.includes('--base') ? process.argv[process.argv.indexOf('--base') + 1] : null;
const M = {
  extract: process.env.MODEL_EXTRACT || 'gpt-6.1-terra',
  order: process.env.MODEL_ORDER || 'gpt-6-luna',
  tts: process.env.MODEL_TTS || 'gpt-4o-mini-tts',
  stt: process.env.MODEL_STT || 'gpt-transcribe',
};
const client = new OpenAI({ maxRetries: 0 });
let fails = 0;
async function step(name, fn) {
  const t = Date.now();
  try { const r = await fn(); console.log(`OK   ${name} (${Date.now() - t}ms)${r ? ' ' + r : ''}`); return true; }
  catch (e) { fails++; console.log(`FAIL ${name}: ${e.status ?? ''} ${e.message}`); return false; }
}
await step(`responses ${M.extract}`, async () => (await client.responses.create({ model: M.extract, input: 'Say hi', reasoning: { effort: 'low' }, max_output_tokens: 2000, store: false })).output_text.slice(0, 20));
await step(`responses ${M.order}`, async () => (await client.responses.create({ model: M.order, input: 'Say hi', reasoning: { effort: 'none' }, max_output_tokens: 500, store: false })).output_text.slice(0, 20));
let audio;
await step(`speech ${M.tts}`, async () => {
  const r = await client.audio.speech.create({ model: M.tts, voice: 'marin', input: '我要一份拌饭，不要太辣。', response_format: 'mp3' });
  audio = Buffer.from(await r.arrayBuffer());
  return `${audio.length} bytes`;
});
if (audio) {
  await step(`transcribe ${M.stt} languages[]=zh-cn keywords[]`, async () => {
    const file = await toFile(audio, 'req.mp3', { type: 'audio/mpeg' });
    const r = await client.audio.transcriptions.create({ file, model: M.stt, languages: ['zh-cn'], keywords: ['拌饭', '部队锅'], prompt: 'A restaurant customer orders Korean dishes and asks about spice level and allergies.' });
    return JSON.stringify(r.text);
  });
}
if (base) {
  await step('schemas strict via /api/demo/warmup', async () => {
    const r = await fetch(base.replace(/\/$/, '') + '/api/demo/warmup', { method: 'POST', headers: { 'x-demo-key': process.env.DEMO_KEY || '' } });
    const j = await r.json();
    if (!r.ok) throw new Error(JSON.stringify(j));
    if (Object.values(j).some((v) => typeof v !== 'number')) throw new Error(JSON.stringify(j));
    return JSON.stringify(j);
  });
} else {
  console.log('SKIP schemas (pass --base <url> with the app running and DEMO_KEY set)');
}
process.exit(fails ? 1 : 0);
