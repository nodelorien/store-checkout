export const CARD_NUMBER_MAX_LENGTH = 19;
export const CVC_LENGTH = 3;

export function onlyNumeric(value: string): string {
  return value.replace(/\D/g, '');
}

/** Groups the card number in fours: `4242 4242 4242 4242`. Anything non-numeric is dropped. */
export function formatCardNumber(value: string): string {
  const numeric = onlyNumeric(value).slice(0, CARD_NUMBER_MAX_LENGTH);
  return numeric.replace(/(\d{4})(?=\d)/g, '$1 ');
}

export function formatCvc(value: string): string {
  return onlyNumeric(value).slice(0, CVC_LENGTH);
}

/**
 * Formats an expiry as `MM/YY` while typing. The slash is added as soon as the month is complete,
 * but only when the user is adding characters, so it can still be deleted.
 */
export function formatExpiry(value: string, previous = ''): string {
  let numeric = onlyNumeric(value).slice(0, 4);
  // "5" can only mean May: save a keystroke.
  if (numeric.length === 1 && Number(numeric) > 1) numeric = `0${numeric}`;

  if (numeric.length > 2) return `${numeric.slice(0, 2)}/${numeric.slice(2)}`;
  if (numeric.length === 2 && value.length > previous.length) return `${numeric}/`;
  return numeric;
}

export interface ParsedExpiry {
  /** Two characters, e.g. `08`. */
  month: string;
  /** Two characters, e.g. `30`. */
  year: string;
}

export function parseExpiry(value: string): ParsedExpiry | null {
  const match = /^(\d{2})\s*\/\s*(\d{2})$/.exec(value.trim());
  if (!match) return null;

  const [, month = '', year = ''] = match;
  const monthNumber = Number(month);
  if (monthNumber < 1 || monthNumber > 12) return null;
  return { month, year };
}

/** A card is valid through the last day of its expiry month. */
export function isExpiryInFuture(expiry: ParsedExpiry, now: Date): boolean {
  const year = 2000 + Number(expiry.year);
  const month = Number(expiry.month);
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  return year > currentYear || (year === currentYear && month >= currentMonth);
}

const PREVIEW_LENGTH = 16;

/**
 * Card number as shown on the card preview: the digits typed so far followed by placeholders, in
 * groups of four. Display only — the value never leaves the form.
 */
export function previewCardNumber(value: string): string {
  const digits = onlyNumeric(value).slice(0, PREVIEW_LENGTH);
  return digits.padEnd(PREVIEW_LENGTH, '•').replace(/(.{4})(?=.)/g, '$1 ');
}
