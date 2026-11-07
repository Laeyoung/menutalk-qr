// Spec 5.2 계약 타입. 이 파일의 필드 이름은 Spec과 1:1로 맞춘다.
import type { AllergenCode } from './allergens';

export type { AllergenCode };

export const LANGS = ['en', 'ja', 'zh-Hans', 'zh-Hant', 'es'] as const;
export type LangCode = (typeof LANGS)[number];

export const CATEGORIES = ['main', 'side', 'drink', 'alcohol', 'dessert', 'set', 'other'] as const;
export type Category = (typeof CATEGORIES)[number];

export type SpiceLevel = 0 | 1 | 2 | 3;
export type AllergenSource = 'ai_estimated' | 'store_confirmed';

export interface MenuItemBase {
  item_id: string;
  name_ko: string;
  price_krw: number | null;
  price_note: string | null;
  category: Category;
  section_ko: string | null;
  spice_level: SpiceLevel;
  main_ingredients_ko: string[];
  allergens: AllergenCode[];
  allergens_source: AllergenSource;
  confidence: 'high' | 'medium' | 'low';
  unreadable_note: string | null;
}

export interface MenuDraft {
  menu_id: string;
  store_name: string | null;
  admin_key_hash: string;
  created_at: string;
  source: {
    model: string;
    effort: string;
    detail: 'auto' | 'original';
    latency_ms: number;
    usage: object;
    fixture: boolean;
  };
  warnings: string[];
  items: MenuItemBase[];
}

export interface LocalizeInputItem {
  item_id: string;
  name_ko: string;
  category: Category;
  main_ingredients_ko: string[];
  spice_level: SpiceLevel;
}

export interface LocalizedItem {
  item_id: string;
  name: string;
  short: string;
  detail: string;
  how_to_eat: string | null;
}

export interface PublishedLocalizedItem extends LocalizedItem {
  tts_text: string;
  tts_hash: string;
}

export type PublishedItem = Omit<MenuItemBase, 'confidence' | 'unreadable_note'>;

export interface PublishedMenu {
  menu_id: string;
  store_name: string | null;
  published_at: string;
  rev: number;
  langs: LangCode[];
  items: PublishedItem[];
  locales: Partial<Record<LangCode, Record<string, PublishedLocalizedItem>>>;
}

export interface OrderConflict {
  item_id: string;
  allergen: AllergenCode;
  source: AllergenSource;
  message_ko: string;
  message_local: string;
}

export interface OrderCard {
  card_id: string;
  lang: LangCode;
  transcript: string | null;
  lines_ko: { item_id: string | null; text_ko: string; qty: number | null }[];
  requests_ko: string[];
  allergy_alert_ko: string | null;
  conflicts: OrderConflict[];
  /** 5.3: store_confirmed인데 교집합이 없는 메뉴(회색 안내). 화면 표시용 */
  confirmed_clear_item_ids?: string[];
  /** 5.3: 담은 메뉴가 없을 때 "이 가게에서 주의할 메뉴" 목록으로 보여 준다 */
  conflicts_scope?: 'cart' | 'whole_menu';
  back_translation: string;
  unmatched_note: string | null;
  /** 모델 실패로 규칙 카드에 폴백했을 때 손님 언어 안내 */
  fallback_note?: string | null;
  mode: 'rule' | 'model';
  latency_ms: { stt?: number; llm?: number; total: number };
}

export interface CartLine {
  itemId: string;
  qty: number;
}

export const CHIP_CODES = [
  'less_spicy',
  'extra_spicy',
  'no_cilantro',
  'no_onion',
  'water',
  'share_plate',
] as const;
export type ChipCode = (typeof CHIP_CODES)[number];

export interface ApiErrorBody {
  error: { code: string; message: string; retryable: boolean; details?: unknown };
}
