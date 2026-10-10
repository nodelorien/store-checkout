import { DomainError } from '../../../../shared/errors/domain-error';
import { Result } from '../../../../shared/result/result';
import { Delivery } from '../../../deliveries/domain/delivery';
import { Transaction } from '../../domain/transaction';

export const TRANSACTION_REPOSITORY = Symbol('TRANSACTION_REPOSITORY');

/** `DUPLICATE_KEY`: another transaction already owns the idempotency key; nothing was written. */
export type CreateOutcome = 'CREATED' | 'DUPLICATE_KEY';

/**
 * Outcome of the atomic approval write (ADR-0011):
 * - `APPLIED`: transaction approved, stock decremented, delivery created.
 * - `ALREADY_RESOLVED`: the transaction was no longer `PENDING`; nothing was written.
 * - `OUT_OF_STOCK`: stock was lower than the quantity; nothing was written.
 */
export type ApproveOutcome = 'APPLIED' | 'ALREADY_RESOLVED' | 'OUT_OF_STOCK';

export type FailOutcome = 'APPLIED' | 'ALREADY_RESOLVED';

export interface TransactionRepository {
  /** `err(TRANSACTION_NOT_FOUND)` when the id does not exist. */
  findById(id: string): Promise<Result<Transaction, DomainError>>;
  findByIdempotencyKey(key: string): Promise<Result<Transaction | null, DomainError>>;
  findByReference(reference: string): Promise<Result<Transaction | null, DomainError>>;
  /** Stores a `PENDING` transaction. Stock is not touched. */
  create(
    transaction: Transaction,
    idempotencyKey?: string,
  ): Promise<Result<CreateOutcome, DomainError>>;
  attachGatewayId(
    id: string,
    gatewayTransactionId: string,
    updatedAt: string,
  ): Promise<Result<void, DomainError>>;
  /** One atomic write: approve (if `PENDING`) + decrement stock (if enough) + create delivery. */
  resolveApproved(
    transaction: Transaction,
    delivery: Delivery,
  ): Promise<Result<ApproveOutcome, DomainError>>;
  /** Sets a non-approved final status if the transaction is still `PENDING`. Stock untouched. */
  resolveFailed(transaction: Transaction): Promise<Result<FailOutcome, DomainError>>;
}
