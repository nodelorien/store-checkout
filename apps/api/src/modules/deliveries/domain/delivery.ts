import { DomainError, DomainErrors } from '../../../shared/errors/domain-error';
import { err, ok, Result } from '../../../shared/result/result';
import { Address, AddressProps } from './address';

export type DeliveryStatus = 'PENDING' | 'SHIPPED' | 'DELIVERED';

export interface DeliveryProps {
  readonly id: string;
  readonly transactionId: string;
  readonly customerId: string;
  readonly productId: string;
  readonly quantity: number;
  readonly address: AddressProps;
  readonly status: DeliveryStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface NewDelivery {
  readonly id: string;
  readonly transactionId: string;
  readonly customerId: string;
  readonly productId: string;
  readonly quantity: number;
  readonly address: AddressProps;
}

/** The product assigned to the customer. Exists only for approved transactions (BR-07). */
export class Delivery {
  private constructor(private readonly props: DeliveryProps) {}

  static create(input: NewDelivery, now: Date): Delivery {
    return new Delivery({
      ...input,
      address: { ...input.address },
      status: 'PENDING',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    });
  }

  static restore(props: DeliveryProps): Delivery {
    return new Delivery({ ...props, address: { ...props.address } });
  }

  get id(): string {
    return this.props.id;
  }
  get transactionId(): string {
    return this.props.transactionId;
  }
  get status(): DeliveryStatus {
    return this.props.status;
  }
  get address(): AddressProps {
    return { ...this.props.address };
  }

  /** The address may change only until the parcel leaves (status `PENDING`). */
  amendAddress(address: Address, now: Date): Result<Delivery, DomainError> {
    if (this.props.status !== 'PENDING') {
      return err(DomainErrors.deliveryNotEditable(this.props.status));
    }
    return ok(
      new Delivery({ ...this.props, address: address.toProps(), updatedAt: now.toISOString() }),
    );
  }

  toProps(): DeliveryProps {
    return { ...this.props, address: { ...this.props.address } };
  }
}
