import { DomainError } from '../../../../shared/errors/domain-error';
import { Result } from '../../../../shared/result/result';
import { Delivery } from '../../../deliveries/domain/delivery';
import { CatalogueInvalidator } from '../../../products/application/ports/catalogue-invalidator.port';
import {
  ApproveOutcome,
  CreateOutcome,
  FailOutcome,
  TransactionRepository,
} from '../../application/ports/transaction-repository.port';
import { Transaction } from '../../domain/transaction';

/**
 * The approval write is the only place stock changes (ADR-0011), so it is also the only place
 * the cached catalogue goes stale. Everything else is passed straight through.
 */
export class CatalogueInvalidatingTransactionRepository implements TransactionRepository {
  constructor(
    private readonly inner: TransactionRepository,
    private readonly catalogue: CatalogueInvalidator,
  ) {}

  async resolveApproved(
    transaction: Transaction,
    delivery: Delivery,
  ): Promise<Result<ApproveOutcome, DomainError>> {
    const outcome = await this.inner.resolveApproved(transaction, delivery);
    if (outcome.isOk() && outcome.value === 'APPLIED') {
      await this.catalogue.invalidate();
    }
    return outcome;
  }

  findById(id: string): Promise<Result<Transaction, DomainError>> {
    return this.inner.findById(id);
  }

  findByIdempotencyKey(key: string): Promise<Result<Transaction | null, DomainError>> {
    return this.inner.findByIdempotencyKey(key);
  }

  findByReference(reference: string): Promise<Result<Transaction | null, DomainError>> {
    return this.inner.findByReference(reference);
  }

  create(
    transaction: Transaction,
    idempotencyKey?: string,
  ): Promise<Result<CreateOutcome, DomainError>> {
    return this.inner.create(transaction, idempotencyKey);
  }

  attachGatewayId(
    id: string,
    gatewayTransactionId: string,
    updatedAt: string,
  ): Promise<Result<void, DomainError>> {
    return this.inner.attachGatewayId(id, gatewayTransactionId, updatedAt);
  }

  resolveFailed(transaction: Transaction): Promise<Result<FailOutcome, DomainError>> {
    return this.inner.resolveFailed(transaction);
  }
}
