import { DomainError } from '../../../shared/errors/domain-error';
import { Result } from '../../../shared/result/result';
import { Email, FullName, Phone } from './contact';

export interface CustomerProps {
  readonly id: string;
  readonly fullName: string;
  readonly email: string;
  readonly phone: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CustomerContact {
  readonly fullName: string;
  readonly email: string;
  readonly phone: string;
}

interface ValidContact {
  readonly fullName: FullName;
  readonly email: Email;
  readonly phone: Phone;
}

export function validateContact(contact: CustomerContact): Result<ValidContact, DomainError> {
  return FullName.create(contact.fullName).andThen((fullName) =>
    Email.create(contact.email).andThen((email) =>
      Phone.create(contact.phone).map((phone) => ({ fullName, email, phone })),
    ),
  );
}

/** Guest buyer, unique by normalised e-mail. */
export class Customer {
  private constructor(private readonly props: CustomerProps) {}

  static create(id: string, contact: CustomerContact, now: Date): Result<Customer, DomainError> {
    return validateContact(contact).map(
      ({ fullName, email, phone }) =>
        new Customer({
          id,
          fullName: fullName.value,
          email: email.value,
          phone: phone.value,
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
        }),
    );
  }

  static restore(props: CustomerProps): Customer {
    return new Customer({ ...props });
  }

  get id(): string {
    return this.props.id;
  }
  get fullName(): string {
    return this.props.fullName;
  }
  get email(): string {
    return this.props.email;
  }
  get phone(): string {
    return this.props.phone;
  }
  get createdAt(): string {
    return this.props.createdAt;
  }
  get updatedAt(): string {
    return this.props.updatedAt;
  }

  /** Same identity and e-mail, new name and phone. */
  updateContact(contact: CustomerContact, now: Date): Result<Customer, DomainError> {
    return validateContact({ ...contact, email: this.props.email }).map(
      ({ fullName, phone }) =>
        new Customer({
          ...this.props,
          fullName: fullName.value,
          phone: phone.value,
          updatedAt: now.toISOString(),
        }),
    );
  }

  toProps(): CustomerProps {
    return { ...this.props };
  }
}
