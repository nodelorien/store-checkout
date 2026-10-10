import { Customer } from '../../domain/customer';

export interface CustomerView {
  readonly id: string;
  readonly fullName: string;
  readonly email: string;
  readonly phone: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export function toCustomerView(customer: Customer): CustomerView {
  return customer.toProps();
}
