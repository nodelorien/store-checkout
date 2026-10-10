import { DomainError } from '../../../../shared/errors/domain-error';
import { Result } from '../../../../shared/result/result';

export const PAYMENT_GATEWAY_PORT = Symbol('PAYMENT_GATEWAY_PORT');

export interface GatewayAcceptance {
  /** Single-use token proving the buyer saw the gateway's terms. */
  readonly token: string;
  readonly permalink: string;
}

export interface ChargeInput {
  readonly reference: string;
  readonly amountInCents: number;
  readonly currency: string;
  readonly customerEmail: string;
  readonly cardToken: string;
  readonly installments: number;
  readonly acceptanceToken: string;
}

export interface GatewayCharge {
  /** The gateway's own transaction id. */
  readonly id: string;
  /** Raw gateway status; mapped to ours only by `Transaction.resolve`. */
  readonly status: string;
  readonly statusMessage?: string;
}

export interface PaymentGatewayPort {
  /** Errors: PAYMENT_GATEWAY_UNAVAILABLE. */
  getAcceptance(): Promise<Result<GatewayAcceptance, DomainError>>;
  /** Errors: PAYMENT_GATEWAY_REJECTED (4xx), PAYMENT_GATEWAY_UNAVAILABLE (timeout, 5xx, network). */
  createCharge(input: ChargeInput): Promise<Result<GatewayCharge, DomainError>>;
  /** Errors: PAYMENT_GATEWAY_UNAVAILABLE. */
  getCharge(gatewayTransactionId: string): Promise<Result<GatewayCharge, DomainError>>;
}
