import type { CardBrand } from '@/shared/api/types';
import type { UiError } from '@/shared/api/uiError';

/** Raw card data. Exists only in the card form and in the tokenization request. */
export interface CardInput {
  number: string;
  cvc: string;
  /** Two characters, e.g. `08`. */
  expMonth: string;
  /** Two characters, e.g. `30`. */
  expYear: string;
  holder: string;
}

/** Where and how to tokenize; both values come from `GET /payment-config`. */
export interface GatewayConfig {
  tokenizationUrl: string;
  publicKey: string;
}

/** The only card-related data the app keeps: an opaque token plus display information. */
export interface CardToken {
  tokenId: string;
  brand: CardBrand;
  lastFour: string;
  expiresAt: string;
}

export type TokenizeResult = { ok: true; token: CardToken } | { ok: false; error: UiError };
