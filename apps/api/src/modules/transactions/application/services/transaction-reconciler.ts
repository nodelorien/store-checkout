import { Inject, Injectable } from '@nestjs/common';
import { DomainError } from '../../../../shared/errors/domain-error';
import { fromResult, ok, okAsync, ResultAsync } from '../../../../shared/result/result';
import { mapGatewayStatus, Transaction } from '../../domain/transaction';
import {
  GatewayCharge,
  PAYMENT_GATEWAY_PORT,
  PaymentGatewayPort,
} from '../ports/payment-gateway.port';
import { ResolveTransactionUseCase } from '../use-cases/resolve-transaction.use-case';

/**
 * Brings a `PENDING` transaction up to date with the gateway: one status query, resolution if
 * final. A gateway failure is not an error here — the transaction is returned as it is and the
 * next read tries again.
 */
@Injectable()
export class TransactionReconciler {
  constructor(
    @Inject(PAYMENT_GATEWAY_PORT) private readonly gateway: PaymentGatewayPort,
    @Inject(ResolveTransactionUseCase) private readonly resolve: ResolveTransactionUseCase,
  ) {}

  /** Errors: PERSISTENCE_ERROR (from the resolution write). */
  reconcile(transaction: Transaction): ResultAsync<Transaction, DomainError> {
    const gatewayId = transaction.gatewayTransactionId;
    if (transaction.isFinal() || !gatewayId) {
      return okAsync(transaction);
    }
    return fromResult(this.gateway.getCharge(gatewayId))
      .map((charge): GatewayCharge | null => charge)
      .orElse(() => ok<GatewayCharge | null, DomainError>(null))
      .andThen((charge) =>
        charge === null || mapGatewayStatus(charge.status) === 'PENDING'
          ? ok<Transaction, DomainError>(transaction)
          : this.resolve.execute({
              transaction,
              gatewayStatus: charge.status,
              statusMessage: charge.statusMessage,
            }),
      );
  }
}
