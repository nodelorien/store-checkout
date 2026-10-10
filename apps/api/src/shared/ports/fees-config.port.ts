export const FEES_CONFIG = Symbol('FEES_CONFIG');

/** Server-side fees (BR-02). Never taken from a request. */
export interface FeesConfig {
  readonly baseFeeInCents: number;
  readonly deliveryFeeInCents: number;
}
