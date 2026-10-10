import { Inject, Injectable } from '@nestjs/common';
import { DomainError } from '../../../../shared/errors/domain-error';
import { fromResult, Result } from '../../../../shared/result/result';
import { DELIVERY_REPOSITORY, DeliveryRepository } from '../ports/delivery-repository.port';
import { DeliveryView, toDeliveryView } from './delivery.views';

@Injectable()
export class GetDeliveryUseCase {
  constructor(@Inject(DELIVERY_REPOSITORY) private readonly deliveries: DeliveryRepository) {}

  /** Railway: find by id → view. Errors: DELIVERY_NOT_FOUND, PERSISTENCE_ERROR. */
  execute(id: string): Promise<Result<DeliveryView, DomainError>> {
    return fromResult(this.deliveries.findById(id)).map(toDeliveryView).toPromise();
  }
}
