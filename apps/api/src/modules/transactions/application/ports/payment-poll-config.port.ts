export const PAYMENT_POLL_CONFIG = Symbol('PAYMENT_POLL_CONFIG');

/** Bounds of the wait for a final gateway status inside `POST /transactions`. */
export interface PaymentPollConfig {
  readonly maxMs: number;
  readonly intervalMs: number;
}
