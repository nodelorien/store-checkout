import {
  ChargeInput,
  GatewayAcceptance,
  GatewayCharge,
  PaymentGatewayPort,
} from '../../src/modules/transactions/application/ports/payment-gateway.port';
import { DomainError } from '../../src/shared/errors/domain-error';
import { err, ok, Result } from '../../src/shared/result/result';

type Scripted<T> = T | DomainError;

const isError = (value: unknown): value is DomainError =>
  typeof value === 'object' && value !== null && 'code' in value && 'details' in value;

const toResult = <T>(value: Scripted<T>): Result<T, DomainError> =>
  isError(value) ? err(value) : ok(value as T);

export const GATEWAY_TX_ID = 'gw-tx-1';

/** Scriptable gateway: set the answers, then inspect the recorded calls. */
export class FakePaymentGateway implements PaymentGatewayPort {
  acceptance: Scripted<GatewayAcceptance> = {
    token: 'acceptance-token',
    permalink: 'https://gateway.test/terms.pdf',
  };
  chargeAnswer: Scripted<GatewayCharge> = { id: GATEWAY_TX_ID, status: 'PENDING' };
  /** Answers for successive `getCharge` calls; the last one repeats. */
  statusAnswers: Scripted<GatewayCharge>[] = [{ id: GATEWAY_TX_ID, status: 'APPROVED' }];

  acceptanceCalls = 0;
  readonly charges: ChargeInput[] = [];
  readonly statusQueries: string[] = [];

  async getAcceptance(): Promise<Result<GatewayAcceptance, DomainError>> {
    this.acceptanceCalls += 1;
    return toResult(this.acceptance);
  }

  async createCharge(input: ChargeInput): Promise<Result<GatewayCharge, DomainError>> {
    this.charges.push(input);
    return toResult(this.chargeAnswer);
  }

  async getCharge(gatewayTransactionId: string): Promise<Result<GatewayCharge, DomainError>> {
    const index = Math.min(this.statusQueries.length, this.statusAnswers.length - 1);
    this.statusQueries.push(gatewayTransactionId);
    return toResult(this.statusAnswers[index]);
  }
}
