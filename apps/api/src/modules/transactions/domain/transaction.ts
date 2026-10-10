import { DomainError } from '../../../shared/errors/domain-error';
import { ok, Result } from '../../../shared/result/result';
import { AddressProps } from '../../deliveries/domain/address';
import { Currency } from '../../products/domain/money';
import { AmountsProps } from './amounts';
import { CardBrand, CardInfoProps } from './card-info';

export const TRANSACTION_STATUSES = ['PENDING', 'APPROVED', 'DECLINED', 'VOIDED', 'ERROR'] as const;
export type TransactionStatus = (typeof TRANSACTION_STATUSES)[number];

export const OUT_OF_STOCK_AFTER_PAYMENT = 'OUT_OF_STOCK_AFTER_PAYMENT';

/** The single place where gateway statuses become ours. Anything unknown stays `PENDING`. */
export function mapGatewayStatus(gatewayStatus: string): TransactionStatus {
  return (TRANSACTION_STATUSES as readonly string[]).includes(gatewayStatus)
    ? (gatewayStatus as TransactionStatus)
    : 'PENDING';
}

export interface TransactionProps {
  readonly id: string;
  readonly reference: string;
  readonly status: TransactionStatus;
  readonly productId: string;
  /** Snapshot taken at purchase time so the receipt does not depend on the catalogue. */
  readonly productName: string;
  readonly productImageUrl: string;
  readonly quantity: number;
  readonly customerId: string;
  readonly amounts: AmountsProps;
  readonly currency: Currency;
  readonly shippingAddress: AddressProps;
  readonly cardBrand: CardBrand;
  readonly cardLastFour: string;
  readonly installments: number;
  readonly gatewayTransactionId?: string;
  readonly statusMessage?: string;
  readonly deliveryId?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly resolvedAt?: string;
}

export interface NewTransaction {
  readonly id: string;
  readonly reference: string;
  readonly product: { readonly id: string; readonly name: string; readonly imageUrl: string };
  readonly quantity: number;
  readonly customerId: string;
  readonly amounts: AmountsProps;
  readonly currency: Currency;
  readonly shippingAddress: AddressProps;
  readonly card: CardInfoProps;
}

export class Transaction {
  private constructor(private readonly props: TransactionProps) {}

  static createPending(input: NewTransaction, now: Date): Transaction {
    return new Transaction({
      id: input.id,
      reference: input.reference,
      status: 'PENDING',
      productId: input.product.id,
      productName: input.product.name,
      productImageUrl: input.product.imageUrl,
      quantity: input.quantity,
      customerId: input.customerId,
      amounts: { ...input.amounts },
      currency: input.currency,
      shippingAddress: { ...input.shippingAddress },
      cardBrand: input.card.brand,
      cardLastFour: input.card.lastFour,
      installments: input.card.installments,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    });
  }

  static restore(props: TransactionProps): Transaction {
    return new Transaction({ ...props });
  }

  get id(): string {
    return this.props.id;
  }
  get reference(): string {
    return this.props.reference;
  }
  get status(): TransactionStatus {
    return this.props.status;
  }
  get gatewayTransactionId(): string | undefined {
    return this.props.gatewayTransactionId;
  }
  get deliveryId(): string | undefined {
    return this.props.deliveryId;
  }

  isPending(): boolean {
    return this.props.status === 'PENDING';
  }

  isFinal(): boolean {
    return !this.isPending();
  }

  withGatewayTransactionId(gatewayTransactionId: string, now: Date): Transaction {
    return new Transaction({
      ...this.props,
      gatewayTransactionId,
      updatedAt: now.toISOString(),
    });
  }

  withDelivery(deliveryId: string): Transaction {
    return new Transaction({ ...this.props, deliveryId });
  }

  /**
   * State machine (BR-05): only `PENDING` may move, and only to a final state.
   * A final transaction, or a gateway status that is not final, returns the same transaction.
   */
  resolve(
    gatewayStatus: string,
    statusMessage: string | undefined,
    now: Date,
  ): Result<Transaction, DomainError> {
    const next = mapGatewayStatus(gatewayStatus);
    if (this.isFinal() || next === 'PENDING') {
      return ok(this);
    }
    return ok(
      new Transaction({
        ...this.props,
        status: next,
        statusMessage: statusMessage || undefined,
        resolvedAt: now.toISOString(),
        updatedAt: now.toISOString(),
      }),
    );
  }

  toProps(): TransactionProps {
    return {
      ...this.props,
      amounts: { ...this.props.amounts },
      shippingAddress: { ...this.props.shippingAddress },
    };
  }
}
