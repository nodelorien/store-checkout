import { DeliveryRepository } from '../../src/modules/deliveries/application/ports/delivery-repository.port';
import { Delivery } from '../../src/modules/deliveries/domain/delivery';
import { DomainError, DomainErrors } from '../../src/shared/errors/domain-error';
import { err, ok, Result } from '../../src/shared/result/result';

export class InMemoryDeliveryRepository implements DeliveryRepository {
  failWith: DomainError | undefined;
  /** Runs once just before the next conditional update — used to simulate races. */
  beforeUpdate: (() => void) | undefined;

  /** Pass the transaction fake's `deliveries` map to share state with the approval write. */
  constructor(readonly items: Map<string, Delivery> = new Map()) {}

  seed(delivery: Delivery): void {
    this.items.set(delivery.id, delivery);
  }

  async findById(id: string): Promise<Result<Delivery, DomainError>> {
    if (this.failWith) {
      return err(this.failWith);
    }
    const delivery = this.items.get(id);
    return delivery ? ok(delivery) : err(DomainErrors.deliveryNotFound());
  }

  async findByTransactionId(transactionId: string): Promise<Result<Delivery | null, DomainError>> {
    if (this.failWith) {
      return err(this.failWith);
    }
    return ok(
      [...this.items.values()].find((delivery) => delivery.transactionId === transactionId) ?? null,
    );
  }

  async updateAddress(delivery: Delivery): Promise<Result<Delivery, DomainError>> {
    const hook = this.beforeUpdate;
    this.beforeUpdate = undefined;
    hook?.();
    if (this.failWith) {
      return err(this.failWith);
    }
    const stored = this.items.get(delivery.id);
    if (stored?.status !== 'PENDING') {
      return err(DomainErrors.deliveryNotEditable(stored?.status ?? 'UNKNOWN'));
    }
    this.items.set(delivery.id, delivery);
    return ok(delivery);
  }
}
