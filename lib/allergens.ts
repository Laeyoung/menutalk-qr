// 알레르기 코드 단일 원천(Spec 5.2). 스키마 enum, 다국어 이름, 칩 목록을 모두 여기서 만든다.
// kr_label: 국내 표시 대상으로 알려진 항목(2017년 21종 + 잣 추가 보도 기준 초안, 현행 명단 미확인).
// 발표에서 "법정 목록 기준"이라고 말하지 않는다(Spec Q9).

export const ALLERGEN_CODES = [
  'egg', 'milk', 'buckwheat', 'peanut', 'soy', 'wheat', 'mackerel',
  'crab', 'shrimp', 'pork', 'peach', 'tomato', 'sulfite', 'walnut',
  'chicken', 'beef', 'squid', 'shellfish', 'pine_nut',
  'sesame', 'fish', 'tree_nut',
  'other',
] as const;

export type AllergenCode = (typeof ALLERGEN_CODES)[number];

type Names = { ko: string; en: string; ja: string; 'zh-Hans': string; 'zh-Hant': string; es: string };

export interface AllergenInfo {
  code: AllergenCode;
  kr_label: boolean;
  emoji: string;
  names: Names;
}

export const ALLERGENS: Record<AllergenCode, AllergenInfo> = {
  egg: { code: 'egg', kr_label: true, emoji: '🥚', names: { ko: '달걀', en: 'Egg', ja: '卵', 'zh-Hans': '鸡蛋', 'zh-Hant': '雞蛋', es: 'Huevo' } },
  milk: { code: 'milk', kr_label: true, emoji: '🥛', names: { ko: '우유', en: 'Milk', ja: '乳', 'zh-Hans': '牛奶', 'zh-Hant': '牛奶', es: 'Leche' } },
  buckwheat: { code: 'buckwheat', kr_label: true, emoji: '🌾', names: { ko: '메밀', en: 'Buckwheat', ja: 'そば', 'zh-Hans': '荞麦', 'zh-Hant': '蕎麥', es: 'Trigo sarraceno' } },
  peanut: { code: 'peanut', kr_label: true, emoji: '🥜', names: { ko: '땅콩', en: 'Peanut', ja: '落花生', 'zh-Hans': '花生', 'zh-Hant': '花生', es: 'Cacahuete' } },
  soy: { code: 'soy', kr_label: true, emoji: '🫘', names: { ko: '대두', en: 'Soy', ja: '大豆', 'zh-Hans': '大豆', 'zh-Hant': '大豆', es: 'Soja' } },
  wheat: { code: 'wheat', kr_label: true, emoji: '🌾', names: { ko: '밀', en: 'Wheat', ja: '小麦', 'zh-Hans': '小麦', 'zh-Hant': '小麥', es: 'Trigo' } },
  mackerel: { code: 'mackerel', kr_label: true, emoji: '🐟', names: { ko: '고등어', en: 'Mackerel', ja: 'さば', 'zh-Hans': '鲭鱼', 'zh-Hant': '鯖魚', es: 'Caballa' } },
  crab: { code: 'crab', kr_label: true, emoji: '🦀', names: { ko: '게', en: 'Crab', ja: 'かに', 'zh-Hans': '螃蟹', 'zh-Hant': '螃蟹', es: 'Cangrejo' } },
  shrimp: { code: 'shrimp', kr_label: true, emoji: '🦐', names: { ko: '새우', en: 'Shrimp', ja: 'えび', 'zh-Hans': '虾', 'zh-Hant': '蝦', es: 'Gamba' } },
  pork: { code: 'pork', kr_label: true, emoji: '🐖', names: { ko: '돼지고기', en: 'Pork', ja: '豚肉', 'zh-Hans': '猪肉', 'zh-Hant': '豬肉', es: 'Cerdo' } },
  peach: { code: 'peach', kr_label: true, emoji: '🍑', names: { ko: '복숭아', en: 'Peach', ja: 'もも', 'zh-Hans': '桃子', 'zh-Hant': '桃子', es: 'Melocotón' } },
  tomato: { code: 'tomato', kr_label: true, emoji: '🍅', names: { ko: '토마토', en: 'Tomato', ja: 'トマト', 'zh-Hans': '番茄', 'zh-Hant': '番茄', es: 'Tomate' } },
  sulfite: { code: 'sulfite', kr_label: true, emoji: '🧪', names: { ko: '아황산류', en: 'Sulfites', ja: '亜硫酸塩', 'zh-Hans': '亚硫酸盐', 'zh-Hant': '亞硫酸鹽', es: 'Sulfitos' } },
  walnut: { code: 'walnut', kr_label: true, emoji: '🌰', names: { ko: '호두', en: 'Walnut', ja: 'くるみ', 'zh-Hans': '核桃', 'zh-Hant': '核桃', es: 'Nuez' } },
  chicken: { code: 'chicken', kr_label: true, emoji: '🐔', names: { ko: '닭고기', en: 'Chicken', ja: '鶏肉', 'zh-Hans': '鸡肉', 'zh-Hant': '雞肉', es: 'Pollo' } },
  beef: { code: 'beef', kr_label: true, emoji: '🐄', names: { ko: '쇠고기', en: 'Beef', ja: '牛肉', 'zh-Hans': '牛肉', 'zh-Hant': '牛肉', es: 'Ternera' } },
  squid: { code: 'squid', kr_label: true, emoji: '🦑', names: { ko: '오징어', en: 'Squid', ja: 'いか', 'zh-Hans': '鱿鱼', 'zh-Hant': '魷魚', es: 'Calamar' } },
  shellfish: { code: 'shellfish', kr_label: true, emoji: '🦪', names: { ko: '조개류', en: 'Shellfish', ja: '貝類', 'zh-Hans': '贝类', 'zh-Hant': '貝類', es: 'Marisco (moluscos)' } },
  pine_nut: { code: 'pine_nut', kr_label: true, emoji: '🌲', names: { ko: '잣', en: 'Pine nut', ja: '松の実', 'zh-Hans': '松子', 'zh-Hant': '松子', es: 'Piñón' } },
  sesame: { code: 'sesame', kr_label: false, emoji: '⚪', names: { ko: '참깨', en: 'Sesame', ja: 'ごま', 'zh-Hans': '芝麻', 'zh-Hant': '芝麻', es: 'Sésamo' } },
  fish: { code: 'fish', kr_label: false, emoji: '🐠', names: { ko: '생선', en: 'Fish', ja: '魚', 'zh-Hans': '鱼', 'zh-Hant': '魚', es: 'Pescado' } },
  tree_nut: { code: 'tree_nut', kr_label: false, emoji: '🌰', names: { ko: '견과류', en: 'Tree nuts', ja: 'ナッツ類', 'zh-Hans': '坚果', 'zh-Hant': '堅果', es: 'Frutos secos' } },
  other: { code: 'other', kr_label: false, emoji: '❓', names: { ko: '기타', en: 'Other', ja: 'その他', 'zh-Hans': '其他', 'zh-Hant': '其他', es: 'Otros' } },
};

/** 손님 "내 알레르기" 칩 순서: 외국인 손님에게 흔한 항목을 앞에 둔다 */
export const GUEST_CHIP_ORDER: AllergenCode[] = [
  'peanut', 'tree_nut', 'sesame', 'shrimp', 'crab', 'shellfish', 'fish', 'egg', 'milk',
  'wheat', 'soy', 'buckwheat', 'pork', 'beef', 'chicken', 'squid', 'mackerel', 'walnut',
  'pine_nut', 'peach', 'tomato', 'sulfite',
];

export function isAllergenCode(v: unknown): v is AllergenCode {
  return typeof v === 'string' && (ALLERGEN_CODES as readonly string[]).includes(v);
}

export function allergenName(code: AllergenCode, lang: keyof Names): string {
  return ALLERGENS[code].names[lang];
}
