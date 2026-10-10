import { CustomerRepository } from '../../src/modules/customers/application/ports/customer-repository.port';
import { Customer } from '../../src/modules/customers/domain/customer';
import { DomainError, DomainErrors } from '../../src/shared/errors/domain-error';
import { err, ok, Result } from '../../src/shared/result/result';

export class InMemoryCustomerRepository implements CustomerRepository {
  readonly items = new Map<string, Customer>();
  failWith: DomainError | undefined;
  failOnSave: DomainError | undefined;

  constructor(customers: Customer[] = []) {
    customers.forEach((customer) => this.items.set(customer.id, customer));
  }

  async findById(id: string): Promise<Result<Customer, DomainError>> {
    if (this.failWith) {
      return err(this.failWith);
    }
    const customer = this.items.get(id);
    return customer ? ok(customer) : err(DomainErrors.customerNotFound());
  }

  async findByEmail(email: string): Promise<Result<Customer | null, DomainError>> {
    if (this.failWith) {
      return err(this.failWith);
    }
    return ok([...this.items.values()].find((customer) => customer.email === email) ?? null);
  }

  async save(customer: Customer): Promise<Result<Customer, DomainError>> {
    const failure = this.failWith ?? this.failOnSave;
    if (failure) {
      return err(failure);
    }
    this.items.set(customer.id, customer);
    return ok(customer);
  }
}
