// 정적 다국어 문구(Spec S4: AI 번역에 맡기지 않는다). 초안은 사람이 훑어본 문장이다.
import type { ChipCode, LangCode } from '../types';

export const LANG_LABEL: Record<LangCode, string> = {
  en: 'English',
  ja: '日本語',
  'zh-Hans': '简体中文',
  'zh-Hant': '繁體中文',
  es: 'Español',
};

/** speechSynthesis / 전사 언어 코드 */
export const SPEECH_LANG: Record<LangCode, string> = {
  en: 'en-US',
  ja: 'ja-JP',
  'zh-Hans': 'zh-CN',
  'zh-Hant': 'zh-TW',
  es: 'es-ES',
};

export const TRANSCRIBE_LANG: Record<LangCode, string> = {
  en: 'en',
  ja: 'ja',
  'zh-Hans': 'zh-cn',
  'zh-Hant': 'zh-tw',
  es: 'es',
};

export const CJK_LANGS: LangCode[] = ['ja', 'zh-Hans', 'zh-Hant'];
export const isCjk = (lang: LangCode) => CJK_LANGS.includes(lang);

export const CHIP_KO: Record<ChipCode, string> = {
  less_spicy: '덜 맵게 해 주세요',
  extra_spicy: '더 맵게 해 주세요',
  no_cilantro: '고수는 빼 주세요',
  no_onion: '양파는 빼 주세요',
  water: '물 좀 주세요',
  share_plate: '나눠 먹을 앞접시 주세요',
};

/** 칩 버튼 라벨과 역번역 문장(같은 문장을 쓴다) */
export const CHIP_LOCAL: Record<ChipCode, Record<LangCode, string>> = {
  less_spicy: { en: 'Less spicy, please', ja: '辛さ控えめでお願いします', 'zh-Hans': '请做得不要太辣', 'zh-Hant': '請做得不要太辣', es: 'Menos picante, por favor' },
  extra_spicy: { en: 'Extra spicy, please', ja: '辛めでお願いします', 'zh-Hans': '请做得更辣一点', 'zh-Hant': '請做得更辣一點', es: 'Más picante, por favor' },
  no_cilantro: { en: 'No cilantro, please', ja: 'パクチー抜きでお願いします', 'zh-Hans': '请不要放香菜', 'zh-Hant': '請不要放香菜', es: 'Sin cilantro, por favor' },
  no_onion: { en: 'No onion, please', ja: '玉ねぎ抜きでお願いします', 'zh-Hans': '请不要放洋葱', 'zh-Hant': '請不要放洋蔥', es: 'Sin cebolla, por favor' },
  water: { en: 'Some water, please', ja: 'お水をください', 'zh-Hans': '请给我一些水', 'zh-Hant': '請給我一些水', es: 'Agua, por favor' },
  share_plate: { en: 'Extra plates for sharing, please', ja: '取り皿をください', 'zh-Hans': '请给我分食用的小盘子', 'zh-Hant': '請給我分食用的小盤子', es: 'Platos para compartir, por favor' },
};

/** "{알레르기} 알레르기가 있어요" — 한국어 */
export const allergyAlertKo = (nameKo: string) => `${nameKo} 알레르기가 있어요`;

/** 손님 언어 "I'm allergic to {X}" */
export const allergyAlertLocal: Record<LangCode, (name: string) => string> = {
  en: (n) => `I'm allergic to ${n.toLowerCase()}`,
  ja: (n) => `${n}アレルギーがあります`,
  'zh-Hans': (n) => `我对${n}过敏`,
  'zh-Hant': (n) => `我對${n}過敏`,
  es: (n) => `Tengo alergia a: ${n.toLowerCase()}`,
};

/** 충돌 경고 문장(Spec S7, 5.3) */
export const conflictKo = (source: 'store_confirmed' | 'ai_estimated', menuKo: string, allergenKo: string) =>
  source === 'store_confirmed'
    ? `가게 확인: ${menuKo}에 ${allergenKo}${josaIGa(allergenKo)} 들어갑니다`
    : `AI 추정: ${menuKo}에 ${allergenKo}${josaIGa(allergenKo)} 들어갈 수 있습니다. 직원에게 확인해 주세요`;

export const conflictLocal: Record<LangCode, (source: 'store_confirmed' | 'ai_estimated', menu: string, allergen: string) => string> = {
  en: (s, m, a) => (s === 'store_confirmed' ? `Store confirmed: ${m} contains ${a.toLowerCase()}` : `AI estimate: ${m} may contain ${a.toLowerCase()}. Please check with staff`),
  ja: (s, m, a) => (s === 'store_confirmed' ? `お店確認：${m}には${a}が入っています` : `AI推定：${m}に${a}が入っている可能性があります。店員に確認してください`),
  'zh-Hans': (s, m, a) => (s === 'store_confirmed' ? `店家确认：${m}含有${a}` : `AI推测：${m}可能含有${a}，请向店员确认`),
  'zh-Hant': (s, m, a) => (s === 'store_confirmed' ? `店家確認：${m}含有${a}` : `AI推測：${m}可能含有${a}，請向店員確認`),
  es: (s, m, a) => (s === 'store_confirmed' ? `Confirmado por el local: ${m} contiene ${a.toLowerCase()}` : `Estimación de IA: ${m} puede contener ${a.toLowerCase()}. Consulte al personal`),
};

function josaIGa(word: string): string {
  const last = word.charCodeAt(word.length - 1);
  if (last < 0xac00 || last > 0xd7a3) return '이(가)';
  return (last - 0xac00) % 28 === 0 ? '가' : '이';
}

export const CONFIRMED_CLEAR_KO = '가게가 확인한 목록에는 없습니다. 직원에게 다시 확인하세요';
export const OTHER_ALLERGEN_KO = '기타 알레르기 재료가 있을 수 있음';

type UiKey =
  | 'myAllergies' | 'chooseAllergies' | 'skip' | 'done' | 'add' | 'added' | 'request' | 'staffConfirm'
  | 'aiVoice' | 'browserVoice' | 'play' | 'retry' | 'playBrowser' | 'voicePreparing' | 'storeConfirmed'
  | 'estimated' | 'spicy' | 'ingredients' | 'howToEat' | 'allergyInfo' | 'requestTitle' | 'cart' | 'cartEmpty'
  | 'quickRequests' | 'allergyChips' | 'freeText' | 'freeTextPh' | 'mic' | 'recording' | 'stop'
  | 'voiceNotice' | 'makeCard' | 'samples' | 'showStaff' | 'staffSees' | 'transcript' | 'speakAgain' | 'close'
  | 'fallbackNote' | 'micBlocked' | 'micUnsupported' | 'notHeard' | 'working' | 'noMatch' | 'cautionMenus'
  | 'priceMarket' | 'language' | 'menuNotFound' | 'conflictWarn' | 'remove' | 'openInBrowser' | 'qty';

export const UI: Record<UiKey, Record<LangCode, string>> = {
  myAllergies: { en: 'My allergies', ja: 'アレルギー', 'zh-Hans': '我的过敏', 'zh-Hant': '我的過敏', es: 'Mis alergias' },
  chooseAllergies: { en: 'Do you have any food allergies?', ja: '食物アレルギーはありますか？', 'zh-Hans': '您有食物过敏吗？', 'zh-Hant': '您有食物過敏嗎？', es: '¿Tiene alguna alergia alimentaria?' },
  skip: { en: 'Skip', ja: 'スキップ', 'zh-Hans': '跳过', 'zh-Hant': '略過', es: 'Omitir' },
  done: { en: 'Done', ja: '完了', 'zh-Hans': '完成', 'zh-Hant': '完成', es: 'Listo' },
  add: { en: 'Add', ja: '追加', 'zh-Hans': '加入', 'zh-Hant': '加入', es: 'Añadir' },
  added: { en: 'Added ✓', ja: '追加済み ✓', 'zh-Hans': '已加入 ✓', 'zh-Hant': '已加入 ✓', es: 'Añadido ✓' },
  request: { en: 'Order / Request', ja: '注文・リクエスト', 'zh-Hans': '点餐 / 提要求', 'zh-Hant': '點餐 / 提要求', es: 'Pedir / Solicitar' },
  staffConfirm: { en: 'If you have allergies, always confirm with the staff.', ja: 'アレルギーがある方は必ず店員に確認してください。', 'zh-Hans': '如有过敏，请务必向店员确认。', 'zh-Hant': '如有過敏，請務必向店員確認。', es: 'Si tiene alergias, confírmelo siempre con el personal.' },
  aiVoice: { en: 'AI voice', ja: 'AI音声', 'zh-Hans': 'AI语音', 'zh-Hant': 'AI語音', es: 'Voz de IA' },
  browserVoice: { en: 'Browser voice', ja: 'ブラウザ音声', 'zh-Hans': '浏览器语音', 'zh-Hant': '瀏覽器語音', es: 'Voz del navegador' },
  play: { en: 'Listen', ja: '聞く', 'zh-Hans': '收听', 'zh-Hant': '收聽', es: 'Escuchar' },
  retry: { en: 'Try again', ja: 'もう一度', 'zh-Hans': '重试', 'zh-Hant': '重試', es: 'Reintentar' },
  playBrowser: { en: 'Listen with browser voice', ja: 'ブラウザ音声で聞く', 'zh-Hans': '用浏览器语音收听', 'zh-Hant': '用瀏覽器語音收聽', es: 'Escuchar con voz del navegador' },
  voicePreparing: { en: 'Preparing audio…', ja: '音声を準備中…', 'zh-Hans': '正在准备语音…', 'zh-Hant': '正在準備語音…', es: 'Preparando audio…' },
  storeConfirmed: { en: 'Store confirmed', ja: 'お店確認済み', 'zh-Hans': '店家确认', 'zh-Hant': '店家確認', es: 'Confirmado por el local' },
  estimated: { en: 'Estimated', ja: '推定', 'zh-Hans': '推测', 'zh-Hant': '推測', es: 'Estimado' },
  spicy: { en: 'Spicy', ja: '辛さ', 'zh-Hans': '辣度', 'zh-Hant': '辣度', es: 'Picante' },
  ingredients: { en: 'Main ingredients', ja: '主な材料', 'zh-Hans': '主要食材', 'zh-Hant': '主要食材', es: 'Ingredientes principales' },
  howToEat: { en: 'How to eat', ja: '食べ方', 'zh-Hans': '吃法', 'zh-Hant': '吃法', es: 'Cómo se come' },
  allergyInfo: { en: 'Allergens', ja: 'アレルゲン', 'zh-Hans': '过敏原', 'zh-Hant': '過敏原', es: 'Alérgenos' },
  requestTitle: { en: 'Tell the staff', ja: '店員に伝える', 'zh-Hans': '告诉店员', 'zh-Hant': '告訴店員', es: 'Decir al personal' },
  cart: { en: 'Your dishes', ja: '選んだ料理', 'zh-Hans': '已选菜品', 'zh-Hant': '已選菜品', es: 'Sus platos' },
  cartEmpty: { en: 'No dishes added yet. You can still send a request.', ja: 'まだ料理が選ばれていません。リクエストだけでも送れます。', 'zh-Hans': '还没有选菜，也可以只提要求。', 'zh-Hant': '還沒有選菜，也可以只提要求。', es: 'Aún no ha añadido platos. Puede enviar solo una solicitud.' },
  quickRequests: { en: 'Quick requests', ja: 'よくあるリクエスト', 'zh-Hans': '常用要求', 'zh-Hant': '常用要求', es: 'Peticiones rápidas' },
  allergyChips: { en: 'Allergies', ja: 'アレルギー', 'zh-Hans': '过敏', 'zh-Hant': '過敏', es: 'Alergias' },
  freeText: { en: 'Anything else? (type or speak)', ja: 'その他（入力または音声）', 'zh-Hans': '其他要求（打字或说话）', 'zh-Hant': '其他要求（打字或說話）', es: '¿Algo más? (escriba o hable)' },
  freeTextPh: { en: 'e.g. One bibimbap, less spicy', ja: '例：ビビンバ1つ、辛さ控えめで', 'zh-Hans': '例如：一份拌饭，不要太辣', 'zh-Hant': '例如：一份拌飯，不要太辣', es: 'p. ej. Un bibimbap, menos picante' },
  mic: { en: 'Speak', ja: '話す', 'zh-Hans': '说话', 'zh-Hant': '說話', es: 'Hablar' },
  recording: { en: 'Recording', ja: '録音中', 'zh-Hans': '录音中', 'zh-Hant': '錄音中', es: 'Grabando' },
  stop: { en: 'Stop', ja: '停止', 'zh-Hans': '停止', 'zh-Hant': '停止', es: 'Detener' },
  voiceNotice: { en: 'Your voice is sent to an external AI service for translation and is not stored.', ja: '音声は翻訳のため外部のAIサービスに送信され、保存されません。', 'zh-Hans': '语音会发送到外部AI服务进行翻译，不会被保存。', 'zh-Hant': '語音會傳送到外部AI服務進行翻譯，不會被儲存。', es: 'Su voz se envía a un servicio de IA externo para traducirla y no se guarda.' },
  makeCard: { en: 'Make card for staff', ja: '店員用カードを作る', 'zh-Hans': '生成给店员看的卡片', 'zh-Hant': '產生給店員看的卡片', es: 'Crear tarjeta para el personal' },
  samples: { en: 'Request with recorded sample', ja: '録音サンプルでリクエスト', 'zh-Hans': '用录音样本提出要求', 'zh-Hant': '用錄音樣本提出要求', es: 'Solicitar con muestra grabada' },
  showStaff: { en: 'Show this screen to the staff', ja: 'この画面を店員に見せてください', 'zh-Hans': '请把这个画面给店员看', 'zh-Hant': '請把這個畫面給店員看', es: 'Muestre esta pantalla al personal' },
  staffSees: { en: 'What the staff will read', ja: '店員に伝わる内容', 'zh-Hans': '给店员看的内容', 'zh-Hant': '給店員看的內容', es: 'Lo que leerá el personal' },
  transcript: { en: 'What we heard', ja: '聞き取った内容', 'zh-Hans': '识别到的内容', 'zh-Hant': '辨識到的內容', es: 'Lo que entendimos' },
  speakAgain: { en: 'Edit request', ja: 'もう一度', 'zh-Hans': '重新提要求', 'zh-Hant': '重新提要求', es: 'Editar' },
  close: { en: 'Close', ja: '閉じる', 'zh-Hans': '关闭', 'zh-Hant': '關閉', es: 'Cerrar' },
  fallbackNote: { en: 'We could not include your free-form request.', ja: '自由入力の内容は反映できませんでした。', 'zh-Hans': '未能反映您自由输入的内容。', 'zh-Hant': '未能反映您自由輸入的內容。', es: 'No pudimos incluir su petición libre.' },
  micBlocked: { en: 'Microphone unavailable. Please use the chips or type.', ja: 'マイクが使えません。ボタンか文字でリクエストしてください。', 'zh-Hans': '无法使用麦克风，请用按钮或文字提出要求。', 'zh-Hant': '無法使用麥克風，請用按鈕或文字提出要求。', es: 'Micrófono no disponible. Use los botones o escriba.' },
  micUnsupported: { en: 'Voice input is not supported here. Open in Safari or Chrome.', ja: 'ここでは音声入力が使えません。SafariかChromeで開いてください。', 'zh-Hans': '此处不支持语音输入，请在Safari或Chrome中打开。', 'zh-Hant': '此處不支援語音輸入，請在Safari或Chrome中開啟。', es: 'La voz no funciona aquí. Abra en Safari o Chrome.' },
  notHeard: { en: "We couldn't hear that. Please choose with the chips.", ja: '聞き取れませんでした。ボタンで選んでください。', 'zh-Hans': '没听清楚，请用按钮选择。', 'zh-Hant': '沒聽清楚，請用按鈕選擇。', es: 'No le entendimos. Elija con los botones.' },
  working: { en: 'Making your card…', ja: 'カードを作成中…', 'zh-Hans': '正在生成卡片…', 'zh-Hant': '正在產生卡片…', es: 'Creando su tarjeta…' },
  noMatch: { en: 'Not on the menu', ja: 'メニューにありません', 'zh-Hans': '菜单上没有', 'zh-Hant': '菜單上沒有', es: 'No está en el menú' },
  cautionMenus: { en: 'Dishes to be careful with at this restaurant', ja: 'このお店で注意が必要な料理', 'zh-Hans': '这家店需要注意的菜品', 'zh-Hant': '這家店需要注意的菜品', es: 'Platos con precaución en este local' },
  priceMarket: { en: 'Market price', ja: '時価', 'zh-Hans': '时价', 'zh-Hant': '時價', es: 'Precio de mercado' },
  language: { en: 'Language', ja: '言語', 'zh-Hans': '语言', 'zh-Hant': '語言', es: 'Idioma' },
  menuNotFound: { en: 'Menu not found', ja: 'メニューが見つかりません', 'zh-Hans': '找不到菜单', 'zh-Hant': '找不到菜單', es: 'Menú no encontrado' },
  conflictWarn: { en: 'Contains your allergen', ja: 'あなたのアレルゲンを含みます', 'zh-Hans': '含有您的过敏原', 'zh-Hant': '含有您的過敏原', es: 'Contiene su alérgeno' },
  remove: { en: 'Remove', ja: '削除', 'zh-Hans': '移除', 'zh-Hant': '移除', es: 'Quitar' },
  openInBrowser: { en: 'Open in Safari/Chrome for voice input', ja: '音声入力はSafari/Chromeで開いてください', 'zh-Hans': '如需语音输入，请在Safari/Chrome中打开', 'zh-Hant': '如需語音輸入，請在Safari/Chrome中開啟', es: 'Para voz, abra en Safari/Chrome' },
  qty: { en: 'x', ja: '×', 'zh-Hans': '×', 'zh-Hant': '×', es: 'x' },
};

export const t = (key: UiKey, lang: LangCode) => UI[key][lang];

/** 규칙 카드 역번역 머리말 */
export const BACK_PREFIX: Record<LangCode, string> = {
  en: 'For the staff: ',
  ja: '店員に伝える内容：',
  'zh-Hans': '给店员看的内容：',
  'zh-Hant': '給店員看的內容：',
  es: 'Para el personal: ',
};

export const SPICE_LABEL: Record<LangCode, [string, string, string, string]> = {
  en: ['Not spicy', 'Mild', 'Medium', 'Hot'],
  ja: ['辛くない', 'ピリ辛', '中辛', '激辛'],
  'zh-Hans': ['不辣', '微辣', '中辣', '很辣'],
  'zh-Hant': ['不辣', '微辣', '中辣', '很辣'],
  es: ['No picante', 'Suave', 'Medio', 'Muy picante'],
};
