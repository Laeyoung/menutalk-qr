#!/usr/bin/env node
// DECISIONS D-07: 데모용 "녹음 샘플"을 TTS로 만든다(원어민 녹음으로 교체 가능). OPENAI_API_KEY 필요.
// 사용: node --env-file-if-exists=.env.local scripts/gen-samples.mjs
import OpenAI from 'openai';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';

const samples = [
  { lang: 'zh-Hans', text: '我要一份拌饭，不要太辣，我对芝麻过敏。', voice: 'cedar' },
  { lang: 'ja', text: 'ビビンバを一つ、辛さ控えめで。ごまアレルギーがあります。', voice: 'marin' },
  { lang: 'en', text: "One bibimbap, less spicy please. I'm allergic to sesame.", voice: 'cedar' },
];
const client = new OpenAI();
for (const s of samples) {
  const res = await client.audio.speech.create({
    model: process.env.MODEL_TTS || 'gpt-4o-mini-tts',
    voice: s.voice,
    input: s.text,
    instructions: 'Speak naturally like a tourist ordering at a busy restaurant, at a normal conversational pace.',
    response_format: 'mp3',
  });
  const out = path.resolve(import.meta.dirname, '..', 'public/samples', `sample-${s.lang}.mp3`);
  await writeFile(out, Buffer.from(await res.arrayBuffer()));
  console.log('wrote', out);
}
