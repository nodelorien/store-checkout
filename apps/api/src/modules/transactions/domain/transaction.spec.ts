import { aProduct } from '../../../../test/builders/product.builder';
import { AN_ADDRESS, aTransaction } from '../../../../test/builders/transaction.builder';
import { FakeIdGenerator } from '../../../../test/fakes/fake-system';
import { expectErr, expectOk } from '../../../../test/helpers/result-assertions';
import { Money } from '../../products/domain/money';
import { Quantity } from '../../products/domain/quantity';
import { Amounts } from './amounts';
import { CardInfo } from './card-info';
import { mapGatewayStatus, Transaction } from './transaction';
import {
  isValidIdempotencyKey,
  TRANSACTION_REFERENCE_PATTERN,
  TransactionReference,
} from './transaction-reference';

const NOW = new Date('2026-10-09T15:00:00.000Z');
const LATER = new Date('2026-10-09T15:00:05.000Z');
const fees = { baseFeeInCents: 250_000, deliveryFeeInCents: 800_000 };

describe('Amounts.calculate', () => {
  it('AC-9: total = price × quantity + base fee + delivery fee, in integer cents', () => {
    const amounts = expectOk(
      Amounts.calculate(expectOk(Money.of(12_990_000)), expectOk(Quantity.create(2)), fees),
    );

    expect(amounts).toEqual({
      subtotalInCents: 25_980_000,
      baseFeeInCents: 250_000,
      deliveryFeeInCents: 800_000,
      totalInCents: 27_030_000,
    });
  });

  it('AC-9: supports zero fees', () => {
    const amounts = expectOk(
      Amounts.calculate(expectOk(Money.of(100)), expectOk(Quantity.create(1)), {
        baseFeeInCents: 0,
        deliveryFeeInCents: 0,
      }),
    );

    expect(amounts.totalInCents).toBe(100);
  });

  it.each([
    { baseFeeInCents: -1, deliveryFeeInCents: 0 },
    { baseFeeInCents: 0, deliveryFeeInCents: 10.5 },
  ])('AC-9: rejects invalid fees %p', (badFees) => {
    expectErr(
      Amounts.calculate(expectOk(Money.of(100)), expectOk(Quantity.create(1)), badFees),
      'VALIDATION_ERROR',
    );
  });

  it('AC-9: rejects a total beyond safe integers', () => {
    expectErr(
      Amounts.calculate(
        expectOk(Money.of(Number.MAX_SAFE_INTEGER)),
        expectOk(Quantity.create(1)),
        fees,
      ),
      'VALIDATION_ERROR',
    );
    expectErr(
      Amounts.calculate(
        expectOk(Money.of(Number.MAX_SAFE_INTEGER)),
        expectOk(Quantity.create(2)),
        fees,
      ),
      'VALIDATION_ERROR',
    );
  });
});

describe('CardInfo', () => {
  it('accepts supported brands, four digits and valid installments', () => {
    expect(expectOk(CardInfo.create('visa', '4242', 1))).toEqual({
      brand: 'VISA',
      lastFour: '4242',
      installments: 1,
    });
    expect(expectOk(CardInfo.create('MASTERCARD', '0110', 36)).brand).toBe('MASTERCARD');
  });

  it.each([
    ['cardBrand', 'AMEX', '4242', 1],
    ['cardBrand', undefined, '4242', 1],
    ['cardLastFour', 'VISA', '424', 1],
    ['cardLastFour', 'VISA', '4242424242424242', 1],
    ['cardLastFour', 'VISA', undefined, 1],
    ['installments', 'VISA', '4242', 0],
    ['installments', 'VISA', '4242', 37],
    ['installments', 'VISA', '4242', 1.5],
  ])('AC-13: rejects an invalid %s', (field, brand, lastFour, installments) => {
    const error = expectErr(
      CardInfo.create(brand as string, lastFour as string, installments),
      'VALIDATION_ERROR',
    );

    expect(error.details[0].field).toBe(field);
  });
});

describe('TransactionReference', () => {
  it('AC-16: has the form TX-<yyyymmdd>-<8 base32 chars>', () => {
    const reference = TransactionReference.generate(NOW, new FakeIdGenerator());

    expect(reference).toBe('TX-20261009-ABCDEFGH');
    expect(reference).toMatch(TRANSACTION_REFERENCE_PATTERN);
  });

  it('validates idempotency keys', () => {
    expect(isValidIdempotencyKey('5f0c7a52-98a0-4f6f-8a43-1d2c3b4a5e6f')).toBe(true);
    expect(isValidIdempotencyKey('short')).toBe(false);
    expect(isValidIdempotencyKey('has spaces in it')).toBe(false);
    expect(isValidIdempotencyKey('x'.repeat(129))).toBe(false);
  });
});

describe('mapGatewayStatus', () => {
  it.each(['PENDING', 'APPROVED', 'DECLINED', 'VOIDED', 'ERROR'])('maps %s to itself', (status) => {
    expect(mapGatewayStatus(status)).toBe(status);
  });

  it.each(['IN_REVIEW', '', 'approved'])('AC-14: maps unknown %p to PENDING', (status) => {
    expect(mapGatewayStatus(status)).toBe('PENDING');
  });
});

describe('Transaction', () => {
  const product = aProduct().build();
  const newTransaction = {
    id: 'tx-1',
    reference: 'TX-20261009-ABCDEFGH',
    product: { id: product.id, name: product.name, imageUrl: product.imageUrl },
    quantity: 2,
    customerId: 'customer-1',
    amounts: {
      subtotalInCents: 25_980_000,
      baseFeeInCents: 250_000,
      deliveryFeeInCents: 800_000,
      totalInCents: 27_030_000,
    },
    currency: 'COP' as const,
    shippingAddress: { ...AN_ADDRESS },
    card: { brand: 'VISA' as const, lastFour: '4242', installments: 3 },
  };

  it('is created PENDING with a product snapshot and no resolution data', () => {
    const transaction = Transaction.createPending(newTransaction, NOW);

    expect(transaction.toProps()).toEqual({
      id: 'tx-1',
      reference: 'TX-20261009-ABCDEFGH',
      status: 'PENDING',
      productId: product.id,
      productName: 'Aurora Desk Lamp',
      productImageUrl: '/images/products/aurora-desk-lamp.svg',
      quantity: 2,
      customerId: 'customer-1',
      amounts: newTransaction.amounts,
      currency: 'COP',
      shippingAddress: AN_ADDRESS,
      cardBrand: 'VISA',
      cardLastFour: '4242',
      installments: 3,
      createdAt: '2026-10-09T15:00:00.000Z',
      updatedAt: '2026-10-09T15:00:00.000Z',
    });
    expect(transaction.isPending()).toBe(true);
    expect(transaction.isFinal()).toBe(false);
    expect(transaction.reference).toBe('TX-20261009-ABCDEFGH');
  });

  it.each(['APPROVED', 'DECLINED', 'VOIDED', 'ERROR'] as const)(
    'AC-12: PENDING resolves to %s with a resolution date',
    (status) => {
      const resolved = expectOk(aTransaction().build().resolve(status, 'message', LATER));

      expect(resolved.status).toBe(status);
      expect(resolved.isFinal()).toBe(true);
      expect(resolved.toProps()).toMatchObject({
        statusMessage: 'message',
        resolvedAt: '2026-10-09T15:00:05.000Z',
        updatedAt: '2026-10-09T15:00:05.000Z',
      });
    },
  );

  it('stores no status message when the gateway sends none', () => {
    const resolved = expectOk(aTransaction().build().resolve('APPROVED', undefined, LATER));

    expect(resolved.toProps().statusMessage).toBeUndefined();
    expect(
      expectOk(aTransaction().build().resolve('APPROVED', '', LATER)).toProps().statusMessage,
    ).toBeUndefined();
  });

  it.each(['PENDING', 'IN_REVIEW'])('AC-14: stays PENDING on gateway status %s', (status) => {
    const transaction = aTransaction().build();

    expect(expectOk(transaction.resolve(status, undefined, LATER))).toBe(transaction);
  });

  it('AC-12: a final transaction never changes again', () => {
    const approved = aTransaction().approved().build();

    expect(expectOk(approved.resolve('DECLINED', 'late', LATER))).toBe(approved);
    expect(expectOk(approved.resolve('ERROR', 'late', LATER)).status).toBe('APPROVED');
  });

  it('attaches the gateway id and the delivery without changing the status', () => {
    const transaction = aTransaction().build();

    const withGateway = transaction.withGatewayTransactionId('gw-9', LATER);
    const withDelivery = withGateway.withDelivery('delivery-1');

    expect(withGateway.gatewayTransactionId).toBe('gw-9');
    expect(withGateway.toProps().updatedAt).toBe('2026-10-09T15:00:05.000Z');
    expect(withDelivery.deliveryId).toBe('delivery-1');
    expect(withDelivery.status).toBe('PENDING');
    expect(transaction.gatewayTransactionId).toBeUndefined();
    expect(transaction.deliveryId).toBeUndefined();
  });
});
