// Spec 10.2 녹음 샘플. 샘플마다 고정 lang을 요청에 싣고, 누르면 화면 언어도 그 언어로 바꾼다.
// 파일은 scripts/gen-samples.mjs(TTS) 또는 원어민 녹음으로 교체(DECISIONS D-07).
import type { LangCode } from './types';

export interface Sample {
  lang: LangCode;
  file: string;
  label: string;
  text: string;
}

export const SAMPLES: Sample[] = [
  { lang: 'zh-Hans', file: '/samples/sample-zh-Hans.mp3', label: '中文 样本', text: '我要一份拌饭，不要太辣，我对芝麻过敏。' },
  { lang: 'ja', file: '/samples/sample-ja.mp3', label: '日本語 サンプル', text: 'ビビンバを一つ、辛さ控えめで。ごまアレルギーがあります。' },
  { lang: 'en', file: '/samples/sample-en.mp3', label: 'English sample', text: "One bibimbap, less spicy please. I'm allergic to sesame." },
];
