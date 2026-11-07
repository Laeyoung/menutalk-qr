// Spec 8.4 Structured Outputs 스키마 + zod 재검증. 알레르기 enum은 lib/allergens.ts에서 만든다.
import { z } from 'zod';
import { ALLERGEN_CODES } from './allergens';
import { CATEGORIES, LANGS } from './types';

const allergenEnum = [...ALLERGEN_CODES] as string[];

export const menuExtractionSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['store_name', 'items', 'warnings'],
  properties: {
    store_name: { type: ['string', 'null'] },
    warnings: { type: 'array', items: { type: 'string' } },
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name_ko', 'price_krw', 'price_note', 'category', 'section_ko', 'spice_level', 'main_ingredients_ko', 'allergens', 'confidence', 'unreadable_note'],
        properties: {
          name_ko: { type: 'string' },
          price_krw: { type: ['integer', 'null'] },
          price_note: { type: ['string', 'null'] },
          category: { type: 'string', enum: [...CATEGORIES] },
          section_ko: { type: ['string', 'null'] },
          spice_level: { type: 'string', enum: ['0', '1', '2', '3'] },
          main_ingredients_ko: { type: 'array', items: { type: 'string' } },
          allergens: { type: 'array', items: { type: 'string', enum: allergenEnum } },
          confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
          unreadable_note: { type: ['string', 'null'] },
        },
      },
    },
  },
} as const;

export const menuLocalizationSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['items'],
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['item_id', 'name', 'short', 'detail', 'how_to_eat'],
        properties: {
          item_id: { type: 'string' },
          name: { type: 'string' },
          short: { type: 'string' },
          detail: { type: 'string' },
          how_to_eat: { type: ['string', 'null'] },
        },
      },
    },
  },
} as const;

export const orderCardSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['lines_ko', 'requests_ko', 'guest_allergens', 'allergy_note_ko', 'back_translation', 'unmatched_note'],
  properties: {
    lines_ko: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['item_id', 'text_ko', 'qty'],
        properties: {
          item_id: { type: ['string', 'null'] },
          text_ko: { type: 'string' },
          qty: { type: ['integer', 'null'] },
        },
      },
    },
    requests_ko: { type: 'array', items: { type: 'string' } },
    guest_allergens: { type: 'array', items: { type: 'string', enum: allergenEnum } },
    allergy_note_ko: { type: ['string', 'null'] },
    back_translation: { type: 'string' },
    unmatched_note: { type: ['string', 'null'] },
  },
} as const;

// ---------- zod ----------
export const zAllergen = z.enum(ALLERGEN_CODES);
export const zCategory = z.enum(CATEGORIES);
export const zLang = z.enum(LANGS);

export const zExtraction = z.object({
  store_name: z.string().nullable(),
  warnings: z.array(z.string()),
  items: z.array(
    z.object({
      name_ko: z.string().min(1),
      price_krw: z.number().int().nullable(),
      price_note: z.string().nullable(),
      category: zCategory,
      section_ko: z.string().nullable(),
      spice_level: z.enum(['0', '1', '2', '3']),
      main_ingredients_ko: z.array(z.string()),
      allergens: z.array(zAllergen),
      confidence: z.enum(['high', 'medium', 'low']),
      unreadable_note: z.string().nullable(),
    }),
  ),
});

export const zLocalization = z.object({
  items: z.array(
    z.object({
      item_id: z.string(),
      name: z.string().min(1),
      short: z.string(),
      detail: z.string(),
      how_to_eat: z.string().nullable(),
    }),
  ),
});

export const zOrderModel = z.object({
  lines_ko: z.array(z.object({ item_id: z.string().nullable(), text_ko: z.string(), qty: z.number().int().nullable() })),
  requests_ko: z.array(z.string()),
  guest_allergens: z.array(zAllergen),
  allergy_note_ko: z.string().nullable(),
  back_translation: z.string(),
  unmatched_note: z.string().nullable(),
});

export const zSpice = z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]);

export const zMenuItemBase = z.object({
  item_id: z.string().regex(/^i\d{2,3}$/),
  name_ko: z.string().min(1).max(60),
  price_krw: z.number().int().min(0).max(10_000_000).nullable(),
  price_note: z.string().max(60).nullable(),
  category: zCategory,
  section_ko: z.string().max(40).nullable(),
  spice_level: zSpice,
  main_ingredients_ko: z.array(z.string().max(30)).max(20),
  allergens: z.array(zAllergen).max(23),
  allergens_source: z.enum(['ai_estimated', 'store_confirmed']),
  confidence: z.enum(['high', 'medium', 'low']).optional(),
  unreadable_note: z.string().max(200).nullable().optional(),
});

/** 길이 상한: 라틴 기준 상한의 넉넉한 2배(모델 출력 흔들림 허용, 서버 보호용) */
export const zLocalizedItem = z.object({
  item_id: z.string(),
  name: z.string().min(1).max(120),
  short: z.string().max(160),
  detail: z.string().max(420),
  how_to_eat: z.string().max(240).nullable(),
});

export const zLocalizeInputItem = z.object({
  item_id: z.string().regex(/^i\d{2,3}$/),
  name_ko: z.string().min(1).max(60),
  category: zCategory,
  main_ingredients_ko: z.array(z.string().max(30)).max(20),
  spice_level: zSpice,
});

export const zPublishBody = z.object({
  storeName: z.string().max(60).nullable().optional(),
  langs: z.array(zLang).min(1).max(LANGS.length),
  items: z.array(zMenuItemBase).min(1).max(80),
  locales: z.record(z.string(), z.array(zLocalizedItem)),
});
