export const PAYMENT_PUBLIC_CONFIG = Symbol('PAYMENT_PUBLIC_CONFIG');

/** Static, non-secret gateway data the browser needs to tokenize a card. */
export interface PaymentPublicConfig {
  readonly publicKey: string;
  readonly tokenizationUrl: string;
  readonly currency: string;
}
