import {
  toAddress,
  toAddressAttribute,
} from '../../../deliveries/infrastructure/persistence/delivery.mapper';
import { CardBrand } from '../../domain/card-info';
import { Transaction, TransactionStatus } from '../../domain/transaction';

const optionalString = (value: unknown): string | undefined =>
  typeof value === 'string' && value !== '' ? value : undefined;

/** Item layout of `data-model.md`: amounts flattened, address as a map, optionals omitted. */
export function toTransactionItem(
  transaction: Transaction,
  idempotencyKey?: string,
): Record<string, unknown> {
  const { amounts, shippingAddress, ...rest } = transaction.toProps();
  const item: Record<string, unknown> = {
    ...rest,
    ...amounts,
    shippingAddress: toAddressAttribute(shippingAddress),
    idempotencyKey,
  };
  return Object.fromEntries(Object.entries(item).filter(([, value]) => value !== undefined));
}

export function toTransaction(item: Record<string, unknown>): Transaction {
  return Transaction.restore({
    id: String(item.id),
    reference: String(item.reference),
    status: String(item.status) as TransactionStatus,
    productId: String(item.productId),
    productName: String(item.productName ?? ''),
    productImageUrl: String(item.productImageUrl ?? ''),
    quantity: Number(item.quantity),
    customerId: String(item.customerId),
    amounts: {
      subtotalInCents: Number(item.subtotalInCents),
      baseFeeInCents: Number(item.baseFeeInCents),
      deliveryFeeInCents: Number(item.deliveryFeeInCents),
      totalInCents: Number(item.totalInCents),
    },
    currency: 'COP',
    shippingAddress: toAddress(item.shippingAddress),
    cardBrand: String(item.cardBrand) as CardBrand,
    cardLastFour: String(item.cardLastFour),
    installments: Number(item.installments ?? 1),
    gatewayTransactionId: optionalString(item.gatewayTransactionId),
    statusMessage: optionalString(item.statusMessage),
    deliveryId: optionalString(item.deliveryId),
    createdAt: String(item.createdAt),
    updatedAt: String(item.updatedAt),
    resolvedAt: optionalString(item.resolvedAt),
  });
}
