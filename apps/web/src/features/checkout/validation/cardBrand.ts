import type { CardBrand } from '@/shared/api/types';

const VISA = /^4/;
/** 51–55 and the 2221–2720 range. */
const MASTERCARD = /^(5[1-5]|2(2[2-9][1-9]|2[3-9]\d|[3-6]\d\d|7[01]\d|720))/;

/** Every supported prefix is decidable once this many characters are known. */
const DECIDABLE_LENGTH = 4;

export const UNSUPPORTED_BRAND_MESSAGE = 'Only VISA and MasterCard are accepted';

function strip(value: string): string {
  return value.replace(/\D/g, '');
}

/** Brand from the card number prefix, or `null` when it is not (yet) VISA or MasterCard. */
export function detectCardBrand(cardNumber: string): CardBrand | null {
  const value = strip(cardNumber);
  if (VISA.test(value)) return 'VISA';
  if (MASTERCARD.test(value)) return 'MASTERCARD';
  return null;
}

/** True when enough has been typed to know the card is neither VISA nor MasterCard. */
export function isUnsupportedBrand(cardNumber: string): boolean {
  return strip(cardNumber).length >= DECIDABLE_LENGTH && detectCardBrand(cardNumber) === null;
}
