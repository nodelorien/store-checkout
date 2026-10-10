import { AddressProps } from '../../domain/address';
import { Delivery } from '../../domain/delivery';

export interface DeliveryView {
  readonly id: string;
  readonly transactionId: string;
  readonly customerId: string;
  readonly productId: string;
  readonly quantity: number;
  readonly address: {
    readonly addressLine1: string;
    readonly addressLine2: string | null;
    readonly city: string;
    readonly region: string;
    readonly country: string;
    readonly postalCode: string | null;
  };
  readonly status: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

function toAddressView(address: AddressProps): DeliveryView['address'] {
  return {
    addressLine1: address.addressLine1,
    addressLine2: address.addressLine2 ?? null,
    city: address.city,
    region: address.region,
    country: address.country,
    postalCode: address.postalCode ?? null,
  };
}

export function toDeliveryView(delivery: Delivery): DeliveryView {
  const props = delivery.toProps();
  return { ...props, address: toAddressView(props.address) };
}
