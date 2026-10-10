import { Inject, Injectable } from '@nestjs/common';
import { DomainError } from '../../../../shared/errors/domain-error';
import { CLOCK, Clock } from '../../../../shared/ports/clock.port';
import { ID_GENERATOR, IdGenerator } from '../../../../shared/ports/id-generator.port';
import { fromResult, Result } from '../../../../shared/result/result';
import { Email } from '../../domain/contact';
import { Customer, CustomerContact } from '../../domain/customer';
import { CUSTOMER_REPOSITORY, CustomerRepository } from '../ports/customer-repository.port';
import { CustomerView, toCustomerView } from './customer.views';

export interface UpsertCustomerOutput {
  readonly customer: CustomerView;
  /** `true` when the e-mail was not known before. */
  readonly created: boolean;
}

@Injectable()
export class UpsertCustomerUseCase {
  constructor(
    @Inject(CUSTOMER_REPOSITORY) private readonly customers: CustomerRepository,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  /**
   * Railway: validate e-mail → find by e-mail → create or update (validates name/phone) → save.
   * Errors: VALIDATION_ERROR, PERSISTENCE_ERROR.
   */
  execute(input: CustomerContact): Promise<Result<UpsertCustomerOutput, DomainError>> {
    return fromResult(Email.create(input.email))
      .andThen((email) => this.customers.findByEmail(email.value))
      .andThen((existing) => this.createOrUpdate(existing, input))
      .andThen(({ customer, created }) =>
        fromResult(this.customers.save(customer)).map((saved) => ({
          customer: toCustomerView(saved),
          created,
        })),
      )
      .toPromise();
  }

  private createOrUpdate(
    existing: Customer | null,
    input: CustomerContact,
  ): Result<{ customer: Customer; created: boolean }, DomainError> {
    const now = this.clock.now();
    return existing
      ? existing.updateContact(input, now).map((customer) => ({ customer, created: false }))
      : Customer.create(this.ids.uuid(), input, now).map((customer) => ({
          customer,
          created: true,
        }));
  }
}
