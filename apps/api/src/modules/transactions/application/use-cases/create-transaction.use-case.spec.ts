import { aProduct, PRODUCT_ID } from '../../../../../test/builders/product.builder';
import { GATEWAY_TX_ID } from '../../../../../test/fakes/fake-payment-gateway';
import { expectErr, expectOk } from '../../../../../test/helpers/result-assertions';
import {
  aCreateInput,
  transactionsHarness,
} from '../../../../../test/helpers/transactions-harness';
import { DomainErrors } from '../../../../shared/errors/domain-error';
import { ok } from '../../../../shared/result/result';

const KEY = '5f0c7a52-98a0-4f6f-8a43-1d2c3b4a5e6f';

describe('CreateTransactionUseCase', () => {
  describe('mandatory scenarios', () => {
    it('AC-1: approved → transaction APPROVED, delivery created, stock decreased', async () => {
      const h = transactionsHarness([aProduct().withStock(5).build()]);
      h.gateway.statusAnswers = [{ id: GATEWAY_TX_ID, status: 'APPROVED' }];

      const { transaction, replayed } = expectOk(await h.create.execute(aCreateInput()));

      expect(replayed).toBe(false);
      expect(transaction).toMatchObject({
        status: 'APPROVED',
        statusMessage: null,
        reference: 'TX-20261009-ABCDEFGH',
        quantity: 2,
        product: {
          id: PRODUCT_ID,
          name: 'Aurora Desk Lamp',
          imageUrl: '/images/products/aurora-desk-lamp.svg',
        },
        card: { brand: 'VISA', lastFour: '4242' },
        currency: 'COP',
      });
      expect(transaction.deliveryId).not.toBeNull();
      expect(transaction.resolvedAt).not.toBeNull();
      expect(h.productRepository.stockOf(PRODUCT_ID)).toBe(3);

      const delivery = h.transactionRepository.deliveries.get(String(transaction.deliveryId));
      expect(delivery?.toProps()).toMatchObject({
        transactionId: transaction.id,
        customerId: transaction.customerId,
        productId: PRODUCT_ID,
        quantity: 2,
        status: 'PENDING',
        address: { addressLine1: 'Cra 7 # 71-21', city: 'Bogotá' },
      });
      expect(h.transactionRepository.only().toProps()).toMatchObject({
        status: 'APPROVED',
        gatewayTransactionId: GATEWAY_TX_ID,
        deliveryId: transaction.deliveryId,
      });
    });

    it('AC-2: declined → transaction DECLINED, no delivery, stock unchanged', async () => {
      const h = transactionsHarness();
      h.gateway.statusAnswers = [
        { id: GATEWAY_TX_ID, status: 'DECLINED', statusMessage: 'Insufficient funds' },
      ];

      const { transaction } = expectOk(await h.create.execute(aCreateInput()));

      expect(transaction).toMatchObject({
        status: 'DECLINED',
        statusMessage: 'Insufficient funds',
        deliveryId: null,
      });
      expect(transaction.resolvedAt).not.toBeNull();
      expect(h.transactionRepository.deliveries.size).toBe(0);
      expect(h.productRepository.stockOf(PRODUCT_ID)).toBe(5);
    });

    it('AC-3: out of stock → OUT_OF_STOCK, gateway never called, nothing stored', async () => {
      const h = transactionsHarness([aProduct().withStock(1).build()]);

      const error = expectErr(
        await h.create.execute(aCreateInput({ quantity: 2 })),
        'OUT_OF_STOCK',
      );

      expect(error.message).toBe('Only 1 unit left');
      expect(h.gateway.charges).toHaveLength(0);
      expect(h.transactionRepository.items.size).toBe(0);
      expect(h.customerRepository.items.size).toBe(0);
    });

    it('AC-4: product not found → PRODUCT_NOT_FOUND, gateway never called', async () => {
      const h = transactionsHarness([]);

      expectErr(await h.create.execute(aCreateInput()), 'PRODUCT_NOT_FOUND');
      expect(h.gateway.charges).toHaveLength(0);
      expect(h.transactionRepository.items.size).toBe(0);
    });

    it('AC-5: gateway rejects the charge → transaction ERROR, stock unchanged, PAYMENT_GATEWAY_REJECTED', async () => {
      const h = transactionsHarness();
      h.gateway.chargeAnswer = DomainErrors.gatewayRejected();

      const error = expectErr(await h.create.execute(aCreateInput()), 'PAYMENT_GATEWAY_REJECTED');

      const stored = h.transactionRepository.only();
      expect(stored.toProps()).toMatchObject({
        status: 'ERROR',
        statusMessage: 'PAYMENT_GATEWAY_REJECTED',
      });
      expect(stored.toProps().resolvedAt).toBeDefined();
      expect(error.details).toEqual([
        { field: 'transactionId', message: stored.id },
        { field: 'reference', message: stored.reference },
      ]);
      expect(h.productRepository.stockOf(PRODUCT_ID)).toBe(5);
      expect(h.transactionRepository.deliveries.size).toBe(0);
      expect(h.gateway.statusQueries).toHaveLength(0);
    });

    it('AC-6: gateway unavailable → transaction ERROR, stock unchanged, PAYMENT_GATEWAY_UNAVAILABLE, no retry', async () => {
      const h = transactionsHarness();
      h.gateway.chargeAnswer = DomainErrors.gatewayUnavailable();

      expectErr(await h.create.execute(aCreateInput()), 'PAYMENT_GATEWAY_UNAVAILABLE');

      expect(h.transactionRepository.only().toProps()).toMatchObject({
        status: 'ERROR',
        statusMessage: 'PAYMENT_GATEWAY_UNAVAILABLE',
      });
      expect(h.productRepository.stockOf(PRODUCT_ID)).toBe(5);
      expect(h.gateway.charges).toHaveLength(1);
    });

    it('AC-7: still pending after the poll window → PENDING, stock unchanged', async () => {
      const h = transactionsHarness();
      h.gateway.statusAnswers = [{ id: GATEWAY_TX_ID, status: 'PENDING' }];

      const { transaction } = expectOk(await h.create.execute(aCreateInput()));

      expect(transaction).toMatchObject({ status: 'PENDING', deliveryId: null, resolvedAt: null });
      expect(h.productRepository.stockOf(PRODUCT_ID)).toBe(5);
      expect(h.transactionRepository.only().gatewayTransactionId).toBe(GATEWAY_TX_ID);
      // 9000 ms window / 1500 ms interval → exactly six status queries, then it gives up.
      expect(h.clock.sleeps).toEqual([1500, 1500, 1500, 1500, 1500, 1500]);
      expect(h.gateway.statusQueries).toHaveLength(6);
    });

    it('AC-8: same Idempotency-Key twice → one charge, same transaction', async () => {
      const h = transactionsHarness();
      const input = aCreateInput({ idempotencyKey: KEY });

      const first = expectOk(await h.create.execute(input));
      const second = expectOk(await h.create.execute(input));

      expect(first.replayed).toBe(false);
      expect(second.replayed).toBe(true);
      expect(second.transaction).toEqual(first.transaction);
      expect(h.gateway.charges).toHaveLength(1);
      expect(h.transactionRepository.items.size).toBe(1);
      expect(h.productRepository.stockOf(PRODUCT_ID)).toBe(3);
    });

    it('AC-9: amounts are computed from the stored price, ignoring anything client-sent', async () => {
      const h = transactionsHarness([aProduct().withPrice(12_990_000).withStock(5).build()]);
      const tampered = {
        ...aCreateInput({ quantity: 3 }),
        priceInCents: 1,
        totalInCents: 1,
        amounts: { totalInCents: 1 },
      };

      const { transaction } = expectOk(await h.create.execute(tampered));

      expect(transaction.amounts).toEqual({
        subtotalInCents: 38_970_000,
        baseFeeInCents: 250_000,
        deliveryFeeInCents: 800_000,
        totalInCents: 40_020_000,
      });
      expect(h.gateway.charges[0].amountInCents).toBe(40_020_000);
    });

    it('AC-10: approved but sold out meanwhile → transaction ERROR (OUT_OF_STOCK_AFTER_PAYMENT), no delivery', async () => {
      const h = transactionsHarness([aProduct().withStock(2).build()]);
      h.transactionRepository.beforeResolve = () => h.productRepository.setStock(PRODUCT_ID, 1);

      const { transaction } = expectOk(await h.create.execute(aCreateInput({ quantity: 2 })));

      expect(transaction).toMatchObject({
        status: 'ERROR',
        statusMessage: 'OUT_OF_STOCK_AFTER_PAYMENT',
        deliveryId: null,
      });
      expect(h.transactionRepository.deliveries.size).toBe(0);
      expect(h.productRepository.stockOf(PRODUCT_ID)).toBe(1);
    });
  });

  describe('charge request', () => {
    it('AC-1: charges the total with the reference, the buyer e-mail and the card token', async () => {
      const h = transactionsHarness();

      await h.create.execute(
        aCreateInput({
          installments: 6,
          customer: { fullName: 'Ada Lovelace', email: ' ADA@Example.com', phone: '3001234567' },
        }),
      );

      expect(h.gateway.charges).toEqual([
        {
          reference: 'TX-20261009-ABCDEFGH',
          amountInCents: 27_030_000,
          currency: 'COP',
          customerEmail: 'ada@example.com',
          cardToken: 'tok_test_card_123',
          installments: 6,
          acceptanceToken: 'acceptance-jwt',
        },
      ]);
    });

    it('AC-1: stores the transaction PENDING before charging and links the customer', async () => {
      const h = transactionsHarness();
      let statusWhenCharged: string | undefined;
      const original = h.gateway.createCharge.bind(h.gateway);
      h.gateway.createCharge = async (input) => {
        statusWhenCharged = h.transactionRepository.only().status;
        return original(input);
      };

      const { transaction } = expectOk(await h.create.execute(aCreateInput()));

      expect(statusWhenCharged).toBe('PENDING');
      expect(h.customerRepository.items.get(transaction.customerId)?.email).toBe('ada@example.com');
    });

    it('AC-1: resolves immediately, without polling, when the charge answer is already final', async () => {
      const h = transactionsHarness();
      h.gateway.chargeAnswer = { id: GATEWAY_TX_ID, status: 'APPROVED' };

      const { transaction } = expectOk(await h.create.execute(aCreateInput()));

      expect(transaction.status).toBe('APPROVED');
      expect(h.gateway.statusQueries).toHaveLength(0);
      expect(h.clock.sleeps).toEqual([]);
      expect(h.transactionRepository.only().gatewayTransactionId).toBe(GATEWAY_TX_ID);
    });

    it('AC-1: keeps polling until the status becomes final', async () => {
      const h = transactionsHarness();
      h.gateway.statusAnswers = [
        { id: GATEWAY_TX_ID, status: 'PENDING' },
        { id: GATEWAY_TX_ID, status: 'PENDING' },
        { id: GATEWAY_TX_ID, status: 'APPROVED' },
      ];

      const { transaction } = expectOk(await h.create.execute(aCreateInput()));

      expect(transaction.status).toBe('APPROVED');
      expect(h.gateway.statusQueries).toEqual([GATEWAY_TX_ID, GATEWAY_TX_ID, GATEWAY_TX_ID]);
      expect(h.clock.sleeps).toEqual([1500, 1500, 1500]);
    });

    it.each(['VOIDED', 'ERROR'])('AC-2: a %s payment leaves stock untouched', async (status) => {
      const h = transactionsHarness();
      h.gateway.statusAnswers = [{ id: GATEWAY_TX_ID, status }];

      const { transaction } = expectOk(await h.create.execute(aCreateInput()));

      expect(transaction.status).toBe(status);
      expect(h.productRepository.stockOf(PRODUCT_ID)).toBe(5);
      expect(h.transactionRepository.deliveries.size).toBe(0);
    });

    it('AC-7: stops polling and returns PENDING when a status query fails', async () => {
      const h = transactionsHarness();
      h.gateway.statusAnswers = [
        { id: GATEWAY_TX_ID, status: 'PENDING' },
        DomainErrors.gatewayUnavailable(),
      ];

      const { transaction } = expectOk(await h.create.execute(aCreateInput()));

      expect(transaction.status).toBe('PENDING');
      expect(h.gateway.statusQueries).toHaveLength(2);
      expect(h.productRepository.stockOf(PRODUCT_ID)).toBe(5);
    });

    it('AC-14: an unknown gateway status keeps the transaction PENDING', async () => {
      const h = transactionsHarness();
      h.gateway.chargeAnswer = { id: GATEWAY_TX_ID, status: 'IN_REVIEW' };
      h.gateway.statusAnswers = [{ id: GATEWAY_TX_ID, status: 'IN_REVIEW' }];

      const { transaction } = expectOk(await h.create.execute(aCreateInput()));

      expect(transaction.status).toBe('PENDING');
    });

    it('AC-6: still returns the gateway error when closing the transaction as ERROR fails', async () => {
      const h = transactionsHarness();
      h.gateway.chargeAnswer = DomainErrors.gatewayUnavailable();
      h.transactionRepository.failOn('resolveFailed');

      expectErr(await h.create.execute(aCreateInput()), 'PAYMENT_GATEWAY_UNAVAILABLE');
      expect(h.transactionRepository.only().status).toBe('PENDING');
    });
  });

  describe('idempotency', () => {
    it('AC-8: returns the existing transaction when the key lost a race at write time', async () => {
      const h = transactionsHarness();
      const input = aCreateInput({ idempotencyKey: KEY });
      const winner = expectOk(await h.create.execute(input)).transaction;
      // Simulate the lookup missing the winner (it was written after our read).
      let lookups = 0;
      const original = h.transactionRepository.findByIdempotencyKey.bind(h.transactionRepository);
      h.transactionRepository.findByIdempotencyKey = async (key) => {
        lookups += 1;
        return lookups === 1 ? ok(null) : original(key);
      };

      const second = expectOk(await h.create.execute(input));

      expect(second.replayed).toBe(true);
      expect(second.transaction.id).toBe(winner.id);
      expect(h.gateway.charges).toHaveLength(1);
      expect(h.transactionRepository.items.size).toBe(1);
    });

    it('AC-8: reconciles a replayed transaction that is still PENDING', async () => {
      const h = transactionsHarness();
      const input = aCreateInput({ idempotencyKey: KEY });
      h.gateway.statusAnswers = [{ id: GATEWAY_TX_ID, status: 'PENDING' }];
      expect(expectOk(await h.create.execute(input)).transaction.status).toBe('PENDING');

      h.gateway.statusAnswers = [{ id: GATEWAY_TX_ID, status: 'APPROVED' }];
      h.gateway.statusQueries.length = 0;
      const replay = expectOk(await h.create.execute(input));

      expect(replay.replayed).toBe(true);
      expect(replay.transaction.status).toBe('APPROVED');
      expect(h.gateway.charges).toHaveLength(1);
      expect(h.productRepository.stockOf(PRODUCT_ID)).toBe(3);
    });

    it('AC-8: different keys create different transactions', async () => {
      const h = transactionsHarness();

      await h.create.execute(aCreateInput({ idempotencyKey: KEY }));
      await h.create.execute(aCreateInput({ idempotencyKey: `${KEY}-2` }));

      expect(h.gateway.charges).toHaveLength(2);
      expect(h.transactionRepository.items.size).toBe(2);
    });

    it('AC-8: a blank key is treated as no key', async () => {
      const h = transactionsHarness();

      expectOk(await h.create.execute(aCreateInput({ idempotencyKey: '  ' })));
      expect(h.transactionRepository.idempotencyKeys.size).toBe(0);
    });

    it('AC-17: fails with PERSISTENCE_ERROR if the key is reported taken but no transaction exists', async () => {
      const h = transactionsHarness();
      h.transactionRepository.idempotencyKeys.set(KEY, 'ghost');

      expectErr(await h.create.execute(aCreateInput({ idempotencyKey: KEY })), 'PERSISTENCE_ERROR');
      expect(h.gateway.charges).toHaveLength(0);
    });
  });

  describe('validation', () => {
    it.each([
      ['quantity', { quantity: 0 }],
      ['quantity', { quantity: 11 }],
      ['cardBrand', { cardBrand: 'AMEX' }],
      ['cardLastFour', { cardLastFour: '42' }],
      ['installments', { installments: 0 }],
      ['email', { customer: { fullName: 'Ada Lovelace', email: 'nope', phone: '3001234567' } }],
      ['phone', { customer: { fullName: 'Ada Lovelace', email: 'ada@example.com', phone: '1' } }],
      [
        'delivery.city',
        {
          delivery: {
            addressLine1: 'Cra 7 # 71-21',
            city: '',
            region: 'Cundinamarca',
            country: 'CO',
          },
        },
      ],
      [
        'delivery.country',
        {
          delivery: {
            addressLine1: 'Cra 7 # 71-21',
            city: 'Bogotá',
            region: 'Cundinamarca',
            country: 'US',
          },
        },
      ],
      ['Idempotency-Key', { idempotencyKey: 'bad key!' }],
    ])(
      'AC-13: returns VALIDATION_ERROR for an invalid %s before touching anything',
      async (field, override) => {
        const h = transactionsHarness();

        const error = expectErr(await h.create.execute(aCreateInput(override)), 'VALIDATION_ERROR');

        expect(error.details.map((detail) => detail.field)).toContain(field);
        expect(h.gateway.charges).toHaveLength(0);
        expect(h.transactionRepository.items.size).toBe(0);
        expect(h.customerRepository.items.size).toBe(0);
      },
    );
  });

  describe('persistence failures', () => {
    it('AC-17: propagates a failure of the idempotency lookup', async () => {
      const h = transactionsHarness();
      h.transactionRepository.failOn('findByIdempotencyKey');

      expectErr(await h.create.execute(aCreateInput({ idempotencyKey: KEY })), 'PERSISTENCE_ERROR');
    });

    it('AC-17: propagates a product store failure', async () => {
      const h = transactionsHarness();
      h.productRepository.failWith = DomainErrors.persistence();

      expectErr(await h.create.execute(aCreateInput()), 'PERSISTENCE_ERROR');
      expect(h.gateway.charges).toHaveLength(0);
    });

    it('AC-17: propagates a customer store failure without charging', async () => {
      const h = transactionsHarness();
      h.customerRepository.failOnSave = DomainErrors.persistence();

      expectErr(await h.create.execute(aCreateInput()), 'PERSISTENCE_ERROR');
      expect(h.gateway.charges).toHaveLength(0);
      expect(h.transactionRepository.items.size).toBe(0);
    });

    it('AC-17: does not charge when the PENDING transaction cannot be stored', async () => {
      const h = transactionsHarness();
      h.transactionRepository.failOn('create');

      expectErr(await h.create.execute(aCreateInput()), 'PERSISTENCE_ERROR');
      expect(h.gateway.charges).toHaveLength(0);
    });

    it('AC-17: continues the payment flow when the gateway id cannot be stored', async () => {
      const h = transactionsHarness();
      h.transactionRepository.failOn('attachGatewayId');

      const { transaction } = expectOk(await h.create.execute(aCreateInput()));

      expect(transaction.status).toBe('APPROVED');
      expect(h.transactionRepository.only().gatewayTransactionId).toBe(GATEWAY_TX_ID);
    });

    it('AC-17: returns PERSISTENCE_ERROR when the approval write fails (payment stays PENDING)', async () => {
      const h = transactionsHarness();
      h.transactionRepository.failOn('resolveApproved');

      expectErr(await h.create.execute(aCreateInput()), 'PERSISTENCE_ERROR');
      expect(h.transactionRepository.only().status).toBe('PENDING');
      expect(h.productRepository.stockOf(PRODUCT_ID)).toBe(5);
    });
  });
});
