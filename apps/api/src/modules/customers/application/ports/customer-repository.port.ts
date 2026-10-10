import { DomainError } from '../../../../shared/errors/domain-error';
import { Result } from '../../../../shared/result/result';
import { Customer } from '../../domain/customer';

export const CUSTOMER_REPOSITORY = Symbol('CUSTOMER_REPOSITORY');

export interface CustomerRepository {
  /** `err(CUSTOMER_NOT_FOUND)` when the id does not exist. */
  findById(id: string): Promise<Result<Customer, DomainError>>;
  /** `ok(null)` when no customer has that (normalised) e-mail. */
  findByEmail(email: string): Promise<Result<Customer | null, DomainError>>;
  save(customer: Customer): Promise<Result<Customer, DomainError>>;
}
