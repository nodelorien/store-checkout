import { Inject, Injectable } from '@nestjs/common';
import { DomainError, DomainErrors } from '../../../../shared/errors/domain-error';
import { CLOCK, Clock } from '../../../../shared/ports/clock.port';
import { err, fromResult, ok, Result } from '../../../../shared/result/result';
import { Address, AddressProps } from '../../domain/address';
import { DELIVERY_REPOSITORY, DeliveryRepository } from '../ports/delivery-repository.port';
import { DeliveryView, toDeliveryView } from './delivery.views';

export type AddressPatch = Partial<AddressProps>;

const ADDRESS_FIELDS: ReadonlyArray<keyof AddressProps> = [
  'addressLine1',
  'addressLine2',
  'city',
  'region',
  'country',
  'postalCode',
];

@Injectable()
export class UpdateDeliveryAddressUseCase {
  constructor(
    @Inject(DELIVERY_REPOSITORY) private readonly deliveries: DeliveryRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /**
   * Railway: patch has at least one field → find delivery → merge and validate the address →
   * amend (only while PENDING) → conditional update → view.
   * Errors: VALIDATION_ERROR, DELIVERY_NOT_FOUND, DELIVERY_NOT_EDITABLE, PERSISTENCE_ERROR.
   */
  execute(id: string, patch: AddressPatch): Promise<Result<DeliveryView, DomainError>> {
    return fromResult(this.pickSentFields(patch))
      .andThen((sent) =>
        fromResult(this.deliveries.findById(id)).andThen((delivery) =>
          Address.create({ ...delivery.address, ...sent }, 'address').andThen((address) =>
            delivery.amendAddress(address, this.clock.now()),
          ),
        ),
      )
      .andThen((amended) => this.deliveries.updateAddress(amended))
      .map(toDeliveryView)
      .toPromise();
  }

  private pickSentFields(patch: AddressPatch): Result<AddressPatch, DomainError> {
    const sent = Object.fromEntries(
      ADDRESS_FIELDS.filter((field) => patch[field] !== undefined).map((field) => [
        field,
        patch[field],
      ]),
    );
    return Object.keys(sent).length > 0
      ? ok(sent)
      : err(DomainErrors.invalidField('address', 'at least one address field is required'));
  }
}
