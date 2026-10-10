import { Delivery, DeliveryProps } from '../../src/modules/deliveries/domain/delivery';
import { Transaction, TransactionProps } from '../../src/modules/transactions/domain/transaction';
import { CUSTOMER_ID } from './customer.builder';
import { PRODUCT_ID } from './product.builder';

export const TRANSACTION_ID = '7a000000-0000-4000-8000-0000000000a1';
export const DELIVERY_ID = 'de000000-0000-4000-8000-0000000000d1';

export const AN_ADDRESS = {
  addressLine1: 'Cra 7 # 71-21',
  addressLine2: 'Apto 501',
  city: 'Bogotá',
  region: 'Cundinamarca',
  country: 'CO',
  postalCode: '110231',
} as const;

export class TransactionBuilder {
  private props: TransactionProps = {
    id: TRANSACTION_ID,
    reference: 'TX-20261009-ABCDEFGH',
    status: 'PENDING',
    productId: PRODUCT_ID,
    productName: 'Aurora Desk Lamp',
    productImageUrl: '/images/products/aurora-desk-lamp.svg',
    quantity: 2,
    customerId: CUSTOMER_ID,
    amounts: {
      subtotalInCents: 25_980_000,
      baseFeeInCents: 250_000,
      deliveryFeeInCents: 800_000,
      totalInCents: 27_030_000,
    },
    currency: 'COP',
    shippingAddress: { ...AN_ADDRESS },
    cardBrand: 'VISA',
    cardLastFour: '4242',
    installments: 1,
    createdAt: '2026-10-09T15:00:00.000Z',
    updatedAt: '2026-10-09T15:00:00.000Z',
  };

  with(overrides: Partial<TransactionProps>): this {
    this.props = { ...this.props, ...overrides };
    return this;
  }

  withGatewayId(gatewayTransactionId = 'gw-tx-1'): this {
    return this.with({ gatewayTransactionId });
  }

  approved(): this {
    return this.with({
      status: 'APPROVED',
      gatewayTransactionId: 'gw-tx-1',
      deliveryId: DELIVERY_ID,
      resolvedAt: '2026-10-09T15:00:05.000Z',
    });
  }

  declined(): this {
    return this.with({
      status: 'DECLINED',
      gatewayTransactionId: 'gw-tx-1',
      statusMessage: 'Insufficient funds',
      resolvedAt: '2026-10-09T15:00:05.000Z',
    });
  }

  build(): Transaction {
    return Transaction.restore(this.props);
  }
}

export const aTransaction = (): TransactionBuilder => new TransactionBuilder();

export class DeliveryBuilder {
  private props: DeliveryProps = {
    id: DELIVERY_ID,
    transactionId: TRANSACTION_ID,
    customerId: CUSTOMER_ID,
    productId: PRODUCT_ID,
    quantity: 2,
    address: { ...AN_ADDRESS },
    status: 'PENDING',
    createdAt: '2026-10-09T15:00:05.000Z',
    updatedAt: '2026-10-09T15:00:05.000Z',
  };

  with(overrides: Partial<DeliveryProps>): this {
    this.props = { ...this.props, ...overrides };
    return this;
  }

  build(): Delivery {
    return Delivery.restore(this.props);
  }
}

export const aDelivery = (): DeliveryBuilder => new DeliveryBuilder();
