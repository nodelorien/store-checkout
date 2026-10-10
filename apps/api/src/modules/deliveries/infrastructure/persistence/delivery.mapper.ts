import { AddressProps } from '../../domain/address';
import { Delivery, DeliveryStatus } from '../../domain/delivery';

function withoutUndefined<T extends object>(value: T): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).filter(([, inner]) => inner !== undefined));
}

export function toAddressAttribute(address: AddressProps): Record<string, unknown> {
  return withoutUndefined(address);
}

export function toAddress(value: unknown): AddressProps {
  const map = (value ?? {}) as Record<string, unknown>;
  const optional = (inner: unknown): string | undefined =>
    typeof inner === 'string' && inner !== '' ? inner : undefined;
  return {
    addressLine1: String(map.addressLine1 ?? ''),
    addressLine2: optional(map.addressLine2),
    city: String(map.city ?? ''),
    region: String(map.region ?? ''),
    country: String(map.country ?? ''),
    postalCode: optional(map.postalCode),
  };
}

export function toDeliveryItem(delivery: Delivery): Record<string, unknown> {
  const props = delivery.toProps();
  return { ...props, address: toAddressAttribute(props.address) };
}

export function toDelivery(item: Record<string, unknown>): Delivery {
  return Delivery.restore({
    id: String(item.id),
    transactionId: String(item.transactionId),
    customerId: String(item.customerId),
    productId: String(item.productId),
    quantity: Number(item.quantity),
    address: toAddress(item.address),
    status: String(item.status) as DeliveryStatus,
    createdAt: String(item.createdAt),
    updatedAt: String(item.updatedAt),
  });
}
