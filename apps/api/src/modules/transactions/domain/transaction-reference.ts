import { IdGenerator } from '../../../shared/ports/id-generator.port';

export const TRANSACTION_REFERENCE_PATTERN = /^TX-[0-9]{8}-[A-Z2-7]{8}$/;

/** Human "transaction number": `TX-<yyyymmdd UTC>-<8 base32 chars>`; unique, non-sequential. */
export const TransactionReference = {
  generate(now: Date, ids: IdGenerator): string {
    const day = now.toISOString().slice(0, 10).replace(/-/g, '');
    return `TX-${day}-${ids.randomBase32(8)}`;
  },
};

const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9_-]{8,128}$/;

export function isValidIdempotencyKey(key: string): boolean {
  return IDEMPOTENCY_KEY_PATTERN.test(key);
}
