import { AmountsProps } from '../../domain/amounts';
import { Transaction } from '../../domain/transaction';

/** The transaction resource of `api.md` (`POST /transactions`, `GET /transactions/:id`). */
export interface TransactionView {
  readonly id: string;
  readonly reference: string;
  readonly status: string;
  readonly statusMessage: string | null;
  readonly product: { readonly id: string; readonly name: string; readonly imageUrl: string };
  readonly quantity: number;
  readonly amounts: AmountsProps;
  readonly currency: string;
  readonly card: { readonly brand: string; readonly lastFour: string };
  readonly customerId: string;
  readonly deliveryId: string | null;
  readonly createdAt: string;
  readonly resolvedAt: string | null;
}

export function toTransactionView(transaction: Transaction): TransactionView {
  const props = transaction.toProps();
  return {
    id: props.id,
    reference: props.reference,
    status: props.status,
    statusMessage: props.statusMessage ?? null,
    product: { id: props.productId, name: props.productName, imageUrl: props.productImageUrl },
    quantity: props.quantity,
    amounts: props.amounts,
    currency: props.currency,
    card: { brand: props.cardBrand, lastFour: props.cardLastFour },
    customerId: props.customerId,
    deliveryId: props.deliveryId ?? null,
    createdAt: props.createdAt,
    resolvedAt: props.resolvedAt ?? null,
  };
}
