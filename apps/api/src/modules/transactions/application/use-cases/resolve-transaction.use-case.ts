import { Inject, Injectable } from '@nestjs/common';
import { DomainError } from '../../../../shared/errors/domain-error';
import { CLOCK, Clock } from '../../../../shared/ports/clock.port';
import { ID_GENERATOR, IdGenerator } from '../../../../shared/ports/id-generator.port';
import { fromResult, ok, Result, ResultAsync } from '../../../../shared/result/result';
import { Delivery } from '../../../deliveries/domain/delivery';
import { OUT_OF_STOCK_AFTER_PAYMENT, Transaction } from '../../domain/transaction';
import {
  TRANSACTION_REPOSITORY,
  TransactionRepository,
} from '../ports/transaction-repository.port';

export interface ResolveTransactionInput {
  readonly transaction: Transaction;
  /** Raw gateway status; non-final or unknown values leave the transaction `PENDING`. */
  readonly gatewayStatus: string;
  readonly statusMessage?: string;
  readonly gatewayTransactionId?: string;
}

/**
 * Applies a gateway status to a transaction, atomically and idempotently (ADR-0011).
 * Shared by create (after the charge), get (reconciliation) and the webhook.
 */
@Injectable()
export class ResolveTransactionUseCase {
  constructor(
    @Inject(TRANSACTION_REPOSITORY) private readonly transactions: TransactionRepository,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  /**
   * Railway:
   *  1. attach the gateway id (in memory) → `Transaction.resolve`
   *  2. still `PENDING` (or already final) → return it unchanged
   *  3. `APPROVED` → atomic write (status + stock + delivery)
   *       · already resolved → re-read and return the stored state
   *       · out of stock    → resolve as `ERROR` / OUT_OF_STOCK_AFTER_PAYMENT
   *  4. other final status → conditional update; already resolved → re-read
   * Errors: PERSISTENCE_ERROR, TRANSACTION_NOT_FOUND (only if the row vanished).
   */
  execute(input: ResolveTransactionInput): Promise<Result<Transaction, DomainError>> {
    const now = this.clock.now();
    const current = input.gatewayTransactionId
      ? input.transaction.withGatewayTransactionId(input.gatewayTransactionId, now)
      : input.transaction;

    return fromResult(current.resolve(input.gatewayStatus, input.statusMessage, now))
      .andThen((resolved) => {
        if (current.isFinal() || resolved.isPending()) {
          return ok<Transaction, DomainError>(current);
        }
        return resolved.status === 'APPROVED'
          ? this.approve(current, resolved, now)
          : this.fail(resolved);
      })
      .toPromise();
  }

  private approve(
    pending: Transaction,
    approved: Transaction,
    now: Date,
  ): ResultAsync<Transaction, DomainError> {
    const props = approved.toProps();
    const delivery = Delivery.create(
      {
        id: this.ids.uuid(),
        transactionId: props.id,
        customerId: props.customerId,
        productId: props.productId,
        quantity: props.quantity,
        address: props.shippingAddress,
      },
      now,
    );
    const withDelivery = approved.withDelivery(delivery.id);

    return fromResult(this.transactions.resolveApproved(withDelivery, delivery)).andThen(
      (outcome) => {
        if (outcome === 'APPLIED') {
          return ok<Transaction, DomainError>(withDelivery);
        }
        if (outcome === 'ALREADY_RESOLVED') {
          return this.transactions.findById(props.id);
        }
        return fromResult(pending.resolve('ERROR', OUT_OF_STOCK_AFTER_PAYMENT, now)).andThen(
          (failed) => this.fail(failed),
        );
      },
    );
  }

  private fail(failed: Transaction): ResultAsync<Transaction, DomainError> {
    return fromResult(this.transactions.resolveFailed(failed)).andThen((outcome) =>
      outcome === 'APPLIED'
        ? ok<Transaction, DomainError>(failed)
        : this.transactions.findById(failed.id),
    );
  }
}
