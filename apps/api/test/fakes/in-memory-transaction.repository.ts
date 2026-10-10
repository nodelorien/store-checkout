import { Delivery } from '../../src/modules/deliveries/domain/delivery';
import {
  ApproveOutcome,
  CreateOutcome,
  FailOutcome,
  TransactionRepository,
} from '../../src/modules/transactions/application/ports/transaction-repository.port';
import { Transaction } from '../../src/modules/transactions/domain/transaction';
import { DomainError, DomainErrors } from '../../src/shared/errors/domain-error';
import { err, ok, Result } from '../../src/shared/result/result';
import { InMemoryProductRepository } from './in-memory-product.repository';

type Operation =
  | 'findById'
  | 'findByIdempotencyKey'
  | 'findByReference'
  | 'create'
  | 'attachGatewayId'
  | 'resolveApproved'
  | 'resolveFailed';

/**
 * Behaves like the DynamoDB adapter, including the conditions of the atomic writes: status must
 * be `PENDING`, stock must cover the quantity, and approval decrements stock and stores the delivery.
 */
export class InMemoryTransactionRepository implements TransactionRepository {
  readonly items = new Map<string, Transaction>();
  readonly idempotencyKeys = new Map<string, string>();
  readonly deliveries = new Map<string, Delivery>();
  readonly failures = new Map<Operation, DomainError>();
  /** Runs once just before the next resolution write — used to simulate races. */
  beforeResolve: (() => void) | undefined;

  constructor(private readonly products: InMemoryProductRepository) {}

  failOn(operation: Operation, error: DomainError = DomainErrors.persistence()): void {
    this.failures.set(operation, error);
  }

  seed(transaction: Transaction, idempotencyKey?: string): void {
    this.items.set(transaction.id, transaction);
    if (idempotencyKey) {
      this.idempotencyKeys.set(idempotencyKey, transaction.id);
    }
  }

  only(): Transaction {
    if (this.items.size !== 1) {
      throw new Error(`Expected exactly one transaction, found ${this.items.size}`);
    }
    return [...this.items.values()][0];
  }

  async findById(id: string): Promise<Result<Transaction, DomainError>> {
    const failure = this.failures.get('findById');
    if (failure) {
      return err(failure);
    }
    const transaction = this.items.get(id);
    return transaction ? ok(transaction) : err(DomainErrors.transactionNotFound());
  }

  async findByIdempotencyKey(key: string): Promise<Result<Transaction | null, DomainError>> {
    const failure = this.failures.get('findByIdempotencyKey');
    if (failure) {
      return err(failure);
    }
    const id = this.idempotencyKeys.get(key);
    return ok((id && this.items.get(id)) || null);
  }

  async findByReference(reference: string): Promise<Result<Transaction | null, DomainError>> {
    const failure = this.failures.get('findByReference');
    if (failure) {
      return err(failure);
    }
    return ok([...this.items.values()].find((tx) => tx.reference === reference) ?? null);
  }

  async create(
    transaction: Transaction,
    idempotencyKey?: string,
  ): Promise<Result<CreateOutcome, DomainError>> {
    const failure = this.failures.get('create');
    if (failure) {
      return err(failure);
    }
    if (idempotencyKey && this.idempotencyKeys.has(idempotencyKey)) {
      return ok('DUPLICATE_KEY');
    }
    this.seed(transaction, idempotencyKey);
    return ok('CREATED');
  }

  async attachGatewayId(
    id: string,
    gatewayTransactionId: string,
    updatedAt: string,
  ): Promise<Result<void, DomainError>> {
    const failure = this.failures.get('attachGatewayId');
    if (failure) {
      return err(failure);
    }
    const current = this.items.get(id);
    if (current) {
      this.items.set(
        id,
        Transaction.restore({ ...current.toProps(), gatewayTransactionId, updatedAt }),
      );
    }
    return ok(undefined);
  }

  async resolveApproved(
    transaction: Transaction,
    delivery: Delivery,
  ): Promise<Result<ApproveOutcome, DomainError>> {
    this.runBeforeResolve();
    const failure = this.failures.get('resolveApproved');
    if (failure) {
      return err(failure);
    }
    const { productId, quantity } = transaction.toProps();
    if (!this.items.get(transaction.id)?.isPending()) {
      return ok('ALREADY_RESOLVED');
    }
    const stock = this.products.stockOf(productId) ?? 0;
    if (stock < quantity) {
      return ok('OUT_OF_STOCK');
    }
    this.items.set(transaction.id, transaction);
    this.products.setStock(productId, stock - quantity);
    this.deliveries.set(delivery.id, delivery);
    return ok('APPLIED');
  }

  async resolveFailed(transaction: Transaction): Promise<Result<FailOutcome, DomainError>> {
    this.runBeforeResolve();
    const failure = this.failures.get('resolveFailed');
    if (failure) {
      return err(failure);
    }
    if (!this.items.get(transaction.id)?.isPending()) {
      return ok('ALREADY_RESOLVED');
    }
    this.items.set(transaction.id, transaction);
    return ok('APPLIED');
  }

  private runBeforeResolve(): void {
    const hook = this.beforeResolve;
    this.beforeResolve = undefined;
    hook?.();
  }
}
