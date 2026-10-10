import { DomainError } from '../../../../shared/errors/domain-error';
import { Result } from '../../../../shared/result/result';
import { Delivery } from '../../domain/delivery';

export const DELIVERY_REPOSITORY = Symbol('DELIVERY_REPOSITORY');

export interface DeliveryRepository {
  /** `err(DELIVERY_NOT_FOUND)` when the id does not exist. */
  findById(id: string): Promise<Result<Delivery, DomainError>>;
  /** `ok(null)` when the transaction has no delivery. */
  findByTransactionId(transactionId: string): Promise<Result<Delivery | null, DomainError>>;
  /**
   * Stores the amended address only if the delivery is still `PENDING`;
   * otherwise `err(DELIVERY_NOT_EDITABLE)`.
   */
  updateAddress(delivery: Delivery): Promise<Result<Delivery, DomainError>>;
}
