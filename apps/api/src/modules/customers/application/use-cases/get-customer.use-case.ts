import { Inject, Injectable } from '@nestjs/common';
import { DomainError } from '../../../../shared/errors/domain-error';
import { fromResult, Result } from '../../../../shared/result/result';
import { CUSTOMER_REPOSITORY, CustomerRepository } from '../ports/customer-repository.port';
import { CustomerView, toCustomerView } from './customer.views';

@Injectable()
export class GetCustomerUseCase {
  constructor(@Inject(CUSTOMER_REPOSITORY) private readonly customers: CustomerRepository) {}

  /** Railway: find by id → view. Errors: CUSTOMER_NOT_FOUND, PERSISTENCE_ERROR. */
  execute(id: string): Promise<Result<CustomerView, DomainError>> {
    return fromResult(this.customers.findById(id)).map(toCustomerView).toPromise();
  }
}
