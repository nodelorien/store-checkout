import { aProduct, PRODUCT_ID } from '../../../../../test/builders/product.builder';
import { aTransaction, TRANSACTION_ID } from '../../../../../test/builders/transaction.builder';
import { GATEWAY_TX_ID } from '../../../../../test/fakes/fake-payment-gateway';
import { expectErr, expectOk } from '../../../../../test/helpers/result-assertions';
import { transactionsHarness } from '../../../../../test/helpers/transactions-harness';
import { DomainErrors } from '../../../../shared/errors/domain-error';

function harnessWithPending(stock = 5) {
  const h = transactionsHarness([aProduct().withStock(stock).build()]);
  const transaction = aTransaction().withGatewayId().build();
  h.transactionRepository.seed(transaction);
  return { h, transaction };
}

describe('ResolveTransactionUseCase', () => {
  it('AC-1: APPROVED → approves, decrements stock and creates the delivery atomically', async () => {
    const { h, transaction } = harnessWithPending(5);

    const resolved = expectOk(await h.resolve.execute({ transaction, gatewayStatus: 'APPROVED' }));

    expect(resolved.toProps()).toMatchObject({
      status: 'APPROVED',
      deliveryId: '00000000-0000-4000-8000-000000000001',
      resolvedAt: '2026-10-09T15:00:00.000Z',
    });
    expect(h.productRepository.stockOf(PRODUCT_ID)).toBe(3);
    expect(h.transactionRepository.deliveries.get(String(resolved.deliveryId))?.toProps()).toEqual({
      id: '00000000-0000-4000-8000-000000000001',
      transactionId: TRANSACTION_ID,
      customerId: transaction.toProps().customerId,
      productId: PRODUCT_ID,
      quantity: 2,
      address: transaction.toProps().shippingAddress,
      status: 'PENDING',
      createdAt: '2026-10-09T15:00:00.000Z',
      updatedAt: '2026-10-09T15:00:00.000Z',
    });
  });

  it.each(['DECLINED', 'VOIDED', 'ERROR'])(
    'AC-2: %s → final status with message, stock untouched, no delivery',
    async (gatewayStatus) => {
      const { h, transaction } = harnessWithPending();

      const resolved = expectOk(
        await h.resolve.execute({ transaction, gatewayStatus, statusMessage: 'reason' }),
      );

      expect(resolved.toProps()).toMatchObject({ status: gatewayStatus, statusMessage: 'reason' });
      expect(h.transactionRepository.only().status).toBe(gatewayStatus);
      expect(h.productRepository.stockOf(PRODUCT_ID)).toBe(5);
      expect(h.transactionRepository.deliveries.size).toBe(0);
    },
  );

  it('stores the gateway id given with the resolution', async () => {
    const h = transactionsHarness();
    const transaction = aTransaction().build();
    h.transactionRepository.seed(transaction);

    const resolved = expectOk(
      await h.resolve.execute({
        transaction,
        gatewayStatus: 'DECLINED',
        gatewayTransactionId: 'gw-from-event',
      }),
    );

    expect(resolved.gatewayTransactionId).toBe('gw-from-event');
    expect(h.transactionRepository.only().gatewayTransactionId).toBe('gw-from-event');
  });

  it.each(['PENDING', 'SOMETHING_NEW'])(
    'AC-14: gateway status %s → no write, transaction returned unchanged',
    async (gatewayStatus) => {
      const { h, transaction } = harnessWithPending();
      h.transactionRepository.failOn('resolveApproved');
      h.transactionRepository.failOn('resolveFailed');

      const result = expectOk(await h.resolve.execute({ transaction, gatewayStatus }));

      expect(result.status).toBe('PENDING');
      expect(result).toBe(transaction);
    },
  );

  it('AC-12: an already final transaction is a successful no-op', async () => {
    const h = transactionsHarness();
    const approved = aTransaction().approved().build();
    h.transactionRepository.seed(approved);
    h.transactionRepository.failOn('resolveApproved');
    h.transactionRepository.failOn('resolveFailed');

    const result = expectOk(
      await h.resolve.execute({ transaction: approved, gatewayStatus: 'DECLINED' }),
    );

    expect(result).toBe(approved);
    expect(h.productRepository.stockOf(PRODUCT_ID)).toBe(5);
  });

  it('AC-12: losing the approval race returns the stored state without a second decrement', async () => {
    const { h, transaction } = harnessWithPending(5);
    const winner = aTransaction().approved().build();
    h.transactionRepository.beforeResolve = () => h.transactionRepository.seed(winner);

    const result = expectOk(await h.resolve.execute({ transaction, gatewayStatus: 'APPROVED' }));

    expect(result.toProps()).toEqual(winner.toProps());
    expect(h.productRepository.stockOf(PRODUCT_ID)).toBe(5);
    expect(h.transactionRepository.deliveries.size).toBe(0);
  });

  it('AC-12: losing the race on a failed resolution returns the stored state', async () => {
    const { h, transaction } = harnessWithPending();
    const winner = aTransaction().approved().build();
    h.transactionRepository.beforeResolve = () => h.transactionRepository.seed(winner);

    const result = expectOk(await h.resolve.execute({ transaction, gatewayStatus: 'DECLINED' }));

    expect(result.status).toBe('APPROVED');
  });

  it('AC-10: approved with insufficient stock → ERROR / OUT_OF_STOCK_AFTER_PAYMENT, no delivery', async () => {
    const { h, transaction } = harnessWithPending(1);

    const result = expectOk(await h.resolve.execute({ transaction, gatewayStatus: 'APPROVED' }));

    expect(result.toProps()).toMatchObject({
      status: 'ERROR',
      statusMessage: 'OUT_OF_STOCK_AFTER_PAYMENT',
    });
    expect(result.deliveryId).toBeUndefined();
    expect(h.transactionRepository.only().status).toBe('ERROR');
    expect(h.productRepository.stockOf(PRODUCT_ID)).toBe(1);
    expect(h.transactionRepository.deliveries.size).toBe(0);
  });

  it('AC-17: propagates a failure of the approval write', async () => {
    const { h, transaction } = harnessWithPending();
    h.transactionRepository.failOn('resolveApproved');

    expectErr(
      await h.resolve.execute({ transaction, gatewayStatus: 'APPROVED' }),
      'PERSISTENCE_ERROR',
    );
  });

  it('AC-17: propagates a failure of the failed-status write', async () => {
    const { h, transaction } = harnessWithPending();
    h.transactionRepository.failOn('resolveFailed');

    expectErr(
      await h.resolve.execute({ transaction, gatewayStatus: 'DECLINED' }),
      'PERSISTENCE_ERROR',
    );
  });

  it('AC-17: propagates a failure of the re-read after a lost race', async () => {
    const { h, transaction } = harnessWithPending();
    h.transactionRepository.beforeResolve = () => {
      h.transactionRepository.seed(aTransaction().approved().build());
      h.transactionRepository.failOn('findById');
    };

    expectErr(
      await h.resolve.execute({ transaction, gatewayStatus: 'APPROVED' }),
      'PERSISTENCE_ERROR',
    );
  });
});

describe('GetTransactionUseCase', () => {
  it('AC-11: returns the view of a final transaction without asking the gateway', async () => {
    const h = transactionsHarness();
    h.transactionRepository.seed(aTransaction().declined().build());

    const view = expectOk(await h.get.execute(TRANSACTION_ID));

    expect(view).toEqual({
      id: TRANSACTION_ID,
      reference: 'TX-20261009-ABCDEFGH',
      status: 'DECLINED',
      statusMessage: 'Insufficient funds',
      product: {
        id: PRODUCT_ID,
        name: 'Aurora Desk Lamp',
        imageUrl: '/images/products/aurora-desk-lamp.svg',
      },
      quantity: 2,
      amounts: {
        subtotalInCents: 25_980_000,
        baseFeeInCents: 250_000,
        deliveryFeeInCents: 800_000,
        totalInCents: 27_030_000,
      },
      currency: 'COP',
      card: { brand: 'VISA', lastFour: '4242' },
      customerId: 'c0ffee00-0000-4000-8000-00000000c001',
      deliveryId: null,
      createdAt: '2026-10-09T15:00:00.000Z',
      resolvedAt: '2026-10-09T15:00:05.000Z',
    });
    expect(h.gateway.statusQueries).toHaveLength(0);
  });

  it('AC-11: returns TRANSACTION_NOT_FOUND for an unknown id', async () => {
    const h = transactionsHarness();

    expectErr(await h.get.execute(TRANSACTION_ID), 'TRANSACTION_NOT_FOUND');
  });

  it('AC-11: reconciles a PENDING transaction that became APPROVED', async () => {
    const { h } = harnessWithPending(5);
    h.gateway.statusAnswers = [{ id: GATEWAY_TX_ID, status: 'APPROVED' }];

    const view = expectOk(await h.get.execute(TRANSACTION_ID));

    expect(view.status).toBe('APPROVED');
    expect(view.deliveryId).not.toBeNull();
    expect(h.gateway.statusQueries).toEqual([GATEWAY_TX_ID]);
    expect(h.productRepository.stockOf(PRODUCT_ID)).toBe(3);
  });

  it('AC-11: reconciles a PENDING transaction that became DECLINED', async () => {
    const { h } = harnessWithPending();
    h.gateway.statusAnswers = [
      { id: GATEWAY_TX_ID, status: 'DECLINED', statusMessage: 'No funds' },
    ];

    const view = expectOk(await h.get.execute(TRANSACTION_ID));

    expect(view).toMatchObject({ status: 'DECLINED', statusMessage: 'No funds' });
    expect(h.productRepository.stockOf(PRODUCT_ID)).toBe(5);
  });

  it('AC-11: stays PENDING while the gateway still reports pending', async () => {
    const { h } = harnessWithPending();
    h.gateway.statusAnswers = [{ id: GATEWAY_TX_ID, status: 'PENDING' }];

    expect(expectOk(await h.get.execute(TRANSACTION_ID)).status).toBe('PENDING');
    expect(h.gateway.statusQueries).toHaveLength(1);
  });

  it('AC-11: returns the transaction still PENDING when the gateway fails', async () => {
    const { h } = harnessWithPending();
    h.gateway.statusAnswers = [DomainErrors.gatewayUnavailable()];

    expect(expectOk(await h.get.execute(TRANSACTION_ID)).status).toBe('PENDING');
  });

  it('AC-11: does not ask the gateway for a PENDING transaction without a gateway id', async () => {
    const h = transactionsHarness();
    h.transactionRepository.seed(aTransaction().build());

    expect(expectOk(await h.get.execute(TRANSACTION_ID)).status).toBe('PENDING');
    expect(h.gateway.statusQueries).toHaveLength(0);
  });

  it('AC-17: propagates store failures (read and resolution write)', async () => {
    const { h } = harnessWithPending();
    h.transactionRepository.failOn('resolveApproved');
    expectErr(await h.get.execute(TRANSACTION_ID), 'PERSISTENCE_ERROR');

    h.transactionRepository.failOn('findById');
    expectErr(await h.get.execute(TRANSACTION_ID), 'PERSISTENCE_ERROR');
  });
});
