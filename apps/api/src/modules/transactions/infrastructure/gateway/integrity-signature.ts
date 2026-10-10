import { createHash } from 'node:crypto';

export interface IntegritySignatureInput {
  readonly reference: string;
  readonly amountInCents: number;
  readonly currency: string;
  readonly integritySecret: string;
}

/** `sha256_hex(reference + amountInCents + currency + integritySecret)`, as the gateway requires. */
export function buildIntegritySignature(input: IntegritySignatureInput): string {
  return createHash('sha256')
    .update(`${input.reference}${input.amountInCents}${input.currency}${input.integritySecret}`)
    .digest('hex');
}
