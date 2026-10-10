import { Inject, Injectable } from '@nestjs/common';
import { DomainError, DomainErrors } from '../../../../shared/errors/domain-error';
import { err, fromResult, ok, Result } from '../../../../shared/result/result';
import { Delivery } from '../../domain/delivery';
import { DELIVERY_REPOSITORY, DeliveryRepository } from '../ports/delivery-repository.port';
import { DeliveryView, toDeliveryView } from './delivery.views';

@Injectable()
export class GetDeliveryByTransactionUseCase {
  constructor(@Inject(DELIVERY_REPOSITORY) private readonly deliveries: DeliveryRepository) {}

  /**
   * Railway: find by transaction → must exist → view.
   * Errors: DELIVERY_NOT_FOUND (transaction unknown or not approved), PERSISTENCE_ERROR.
   */
  execute(transactionId: string): Promise<Result<DeliveryView, DomainError>> {
    return fromResult(this.deliveries.findByTransactionId(transactionId))
      .andThen((delivery) =>
        delivery ? ok<Delivery, DomainError>(delivery) : err(DomainErrors.deliveryNotFound()),
      )
      .map(toDeliveryView)
      .toPromise();
  }
}
