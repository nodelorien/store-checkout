import { Customer, CustomerProps } from '../../src/modules/customers/domain/customer';

export const CUSTOMER_ID = 'c0ffee00-0000-4000-8000-00000000c001';

export class CustomerBuilder {
  private props: CustomerProps = {
    id: CUSTOMER_ID,
    fullName: 'Ada Lovelace',
    email: 'ada@example.com',
    phone: '+573001234567',
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
  };

  with(overrides: Partial<CustomerProps>): this {
    this.props = { ...this.props, ...overrides };
    return this;
  }

  build(): Customer {
    return Customer.restore(this.props);
  }
}

export const aCustomer = (): CustomerBuilder => new CustomerBuilder();
