import { z } from 'zod';
import type { CardInput, CardToken } from './types';

/**
 * Wire format of the gateway's card tokenization endpoint. This file is the single place that
 * knows the gateway's field names; everything else works with `CardInput` / `CardToken`.
 *
 * Request  POST {tokenizationUrl}   Authorization: Bearer {publicKey}
 *   { number, cvc, exp_month: "08", exp_year: "30", card_holder }
 * Response 201
 *   { status: "CREATED", data: { id, brand: "VISA" | "MASTERCARD", last_four, expires_at, … } }
 * Error    422
 *   { error: { type: "INPUT_VALIDATION_ERROR", messages: { field: [..] } } }  (not shown to users)
 */
export function toTokenRequestBody(card: CardInput) {
  return {
    number: card.number,
    cvc: card.cvc,
    exp_month: card.expMonth,
    exp_year: card.expYear,
    card_holder: card.holder,
  };
}

const tokenResponseSchema = z.object({
  data: z.object({
    id: z.string().min(1).max(2048),
    brand: z.string(),
    last_four: z.string().regex(/^\d{4}$/),
    expires_at: z.string().refine((value) => Number.isFinite(Date.parse(value))),
  }),
});

export type TokenMappingResult =
  { kind: 'token'; token: CardToken } | { kind: 'unsupported-brand' } | { kind: 'invalid' };

export function mapTokenResponse(body: unknown): TokenMappingResult {
  const parsed = tokenResponseSchema.safeParse(body);
  if (!parsed.success) return { kind: 'invalid' };

  const { id, brand, last_four: lastFour, expires_at: expiresAt } = parsed.data.data;
  const normalisedBrand = brand.trim().toUpperCase();
  if (normalisedBrand !== 'VISA' && normalisedBrand !== 'MASTERCARD') {
    return { kind: 'unsupported-brand' };
  }

  return { kind: 'token', token: { tokenId: id, brand: normalisedBrand, lastFour, expiresAt } };
}
