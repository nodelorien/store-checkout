import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { aProduct, PRODUCT_ID } from '../../../../../test/builders/product.builder';
import {
  AN_ADDRESS,
  aTransaction,
  TRANSACTION_ID,
} from '../../../../../test/builders/transaction.builder';
import { GATEWAY_TX_ID } from '../../../../../test/fakes/fake-payment-gateway';
import { createHttpTestApp } from '../../../../../test/helpers/test-app';
import {
  TransactionsHarness,
  transactionsHarness,
} from '../../../../../test/helpers/transactions-harness';
import { transactionProviders } from '../../../../../test/helpers/transactions-providers';
import { DomainErrors } from '../../../../shared/errors/domain-error';
import { TransactionsController } from './transactions.controller';

const KEY = '5f0c7a52-98a0-4f6f-8a43-1d2c3b4a5e6f';

const body = {
  productId: PRODUCT_ID,
  quantity: 1,
  cardToken: 'tok_test_card_123',
  cardBrand: 'VISA',
  cardLastFour: '4242',
  installments: 1,
  acceptanceToken: 'acceptance-jwt',
  customer: { fullName: 'Ada Lovelace', email: 'ada@example.com', phone: '+573001234567' },
  delivery: { ...AN_ADDRESS },
};

describe('TransactionsController', () => {
  let app: NestExpressApplication;
  let h: TransactionsHarness;

  beforeEach(async () => {
    h = transactionsHarness([aProduct().withStock(5).build()]);
    app = await createHttpTestApp({
      controllers: [TransactionsController],
      providers: transactionProviders(h),
    });
  });

  afterEach(async () => {
    await app.close();
  });

  const post = (payload: object) =>
    request(app.getHttpServer()).post('/api/v1/transactions').send(payload);
  const fieldsOf = (response: request.Response): string[] =>
    response.body.error.details.map((detail: { field: string }) => detail.field);

  describe('POST /transactions', () => {
    it('AC-1: answers 201 with the approved transaction in the contract shape', async () => {
      const response = await post(body).expect(201);

      expect(response.body).toEqual({
        data: {
          id: '00000000-0000-4000-8000-000000000002',
          reference: 'TX-20261009-ABCDEFGH',
          status: 'APPROVED',
          statusMessage: null,
          product: {
            id: PRODUCT_ID,
            name: 'Aurora Desk Lamp',
            imageUrl: '/images/products/aurora-desk-lamp.svg',
          },
          quantity: 1,
          amounts: {
            subtotalInCents: 12_990_000,
            baseFeeInCents: 250_000,
            deliveryFeeInCents: 800_000,
            totalInCents: 14_040_000,
          },
          currency: 'COP',
          card: { brand: 'VISA', lastFour: '4242' },
          customerId: '00000000-0000-4000-8000-000000000001',
          deliveryId: '00000000-0000-4000-8000-000000000003',
          createdAt: '2026-10-09T15:00:00.000Z',
          resolvedAt: '2026-10-09T15:00:01.500Z',
        },
      });
      expect(h.productRepository.stockOf(PRODUCT_ID)).toBe(4);
    });

    it('AC-2: answers 201 with status DECLINED for a declined card', async () => {
      h.gateway.statusAnswers = [
        { id: GATEWAY_TX_ID, status: 'DECLINED', statusMessage: 'Insufficient funds' },
      ];

      const response = await post(body).expect(201);

      expect(response.body.data).toMatchObject({
        status: 'DECLINED',
        statusMessage: 'Insufficient funds',
        deliveryId: null,
      });
    });

    it('AC-7: answers 201 with status PENDING when the payment does not settle in time', async () => {
      h.gateway.statusAnswers = [{ id: GATEWAY_TX_ID, status: 'PENDING' }];

      const response = await post(body).expect(201);

      expect(response.body.data).toMatchObject({ status: 'PENDING', resolvedAt: null });
    });

    it('AC-3: answers 409 OUT_OF_STOCK', async () => {
      h.productRepository.setStock(PRODUCT_ID, 0);

      const response = await post(body).expect(409);

      expect(response.body.error).toMatchObject({
        code: 'OUT_OF_STOCK',
        message: 'Only 0 units left',
      });
    });

    it('AC-4: answers 404 PRODUCT_NOT_FOUND', async () => {
      const response = await post({
        ...body,
        productId: '22222222-2222-4222-8222-222222222222',
      }).expect(404);

      expect(response.body.error.code).toBe('PRODUCT_NOT_FOUND');
    });

    it('AC-5: answers 422 PAYMENT_GATEWAY_REJECTED with the transaction identifiers', async () => {
      h.gateway.chargeAnswer = DomainErrors.gatewayRejected();

      const response = await post(body).expect(422);

      expect(response.body.error.code).toBe('PAYMENT_GATEWAY_REJECTED');
      expect(fieldsOf(response)).toEqual(['transactionId', 'reference']);
    });

    it('AC-6: answers 502 PAYMENT_GATEWAY_UNAVAILABLE', async () => {
      h.gateway.chargeAnswer = DomainErrors.gatewayUnavailable();

      const response = await post(body).expect(502);

      expect(response.body.error.code).toBe('PAYMENT_GATEWAY_UNAVAILABLE');
    });

    it('AC-8: a repeated Idempotency-Key answers 200 with the original transaction', async () => {
      const first = await post(body).set('Idempotency-Key', KEY).expect(201);
      const second = await post(body).set('Idempotency-Key', KEY).expect(200);

      expect(second.body).toEqual(first.body);
      expect(h.gateway.charges).toHaveLength(1);
    });

    it('AC-13: answers 400 for a malformed Idempotency-Key', async () => {
      const response = await post(body).set('Idempotency-Key', 'no').expect(400);

      expect(fieldsOf(response)).toEqual(['Idempotency-Key']);
    });

    it('AC-9: rejects client-sent prices and fees', async () => {
      const response = await post({
        ...body,
        priceInCents: 1,
        totalInCents: 1,
        amounts: { totalInCents: 1 },
        baseFeeInCents: 0,
      }).expect(400);

      expect(fieldsOf(response)).toEqual(
        expect.arrayContaining(['priceInCents', 'totalInCents', 'amounts', 'baseFeeInCents']),
      );
      expect(h.gateway.charges).toHaveLength(0);
    });

    it('AC-13: rejects raw card data at any level', async () => {
      const response = await post({
        ...body,
        number: '4242424242424242',
        cvc: '123',
        expMonth: '08',
        expYear: '28',
        customer: { ...body.customer, cardNumber: '4242424242424242' },
      }).expect(400);

      expect(fieldsOf(response)).toEqual(
        expect.arrayContaining(['number', 'cvc', 'expMonth', 'expYear', 'customer.cardNumber']),
      );
      expect(JSON.stringify(response.body)).not.toContain('4242424242424242');
      expect(h.transactionRepository.items.size).toBe(0);
    });

    it.each([
      ['productId', { productId: 'abc' }],
      ['quantity', { quantity: 0 }],
      ['quantity', { quantity: 11 }],
      ['quantity', { quantity: 1.5 }],
      ['quantity', { quantity: '2' }],
      ['cardToken', { cardToken: '' }],
      ['cardToken', { cardToken: 'x'.repeat(2049) }],
      ['cardBrand', { cardBrand: 'AMEX' }],
      ['cardLastFour', { cardLastFour: '42424' }],
      ['cardLastFour', { cardLastFour: 4242 }],
      ['installments', { installments: 37 }],
      ['installments', { installments: 0 }],
      ['acceptanceToken', { acceptanceToken: '   ' }],
      ['customer', { customer: undefined }],
      ['customer', { customer: 'ada' }],
      ['customer.email', { customer: { ...body.customer, email: 'nope' } }],
      ['customer.phone', { customer: { ...body.customer, phone: 'abc' } }],
      ['customer.fullName', { customer: { ...body.customer, fullName: 'A' } }],
      ['delivery', { delivery: undefined }],
      ['delivery.addressLine1', { delivery: { ...body.delivery, addressLine1: 'x' } }],
      ['delivery.city', { delivery: { ...body.delivery, city: '' } }],
      ['delivery.region', { delivery: { ...body.delivery, region: 'x'.repeat(61) } }],
      ['delivery.country', { delivery: { ...body.delivery, country: 'US' } }],
      ['delivery.postalCode', { delivery: { ...body.delivery, postalCode: '1' } }],
    ])('AC-13: answers 400 VALIDATION_ERROR for an invalid %s', async (field, override) => {
      const response = await post({ ...body, ...override }).expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(fieldsOf(response)).toContain(field);
      expect(h.gateway.charges).toHaveLength(0);
    });

    it('AC-13: defaults installments to 1 and accepts optional address fields being absent', async () => {
      const withoutInstallments: Record<string, unknown> = { ...body };
      delete withoutInstallments.installments;

      await post({
        ...withoutInstallments,
        delivery: { addressLine1: 'Cra 7 # 71-21', city: 'Bogotá', region: 'DC', country: 'CO' },
      }).expect(201);

      expect(h.gateway.charges[0].installments).toBe(1);
    });

    it('AC-17: answers 500 PERSISTENCE_ERROR when the store fails', async () => {
      h.transactionRepository.failOn('create');

      const response = await post(body).expect(500);

      expect(response.body.error.code).toBe('PERSISTENCE_ERROR');
    });

    it('AC-15: is limited to 10 requests per minute and marked no-store', async () => {
      h.productRepository.setStock(PRODUCT_ID, 0);

      for (let i = 0; i < 10; i += 1) {
        const response = await post(body).expect(409);
        expect(response.headers['cache-control']).toBe('no-store');
      }
      const limited = await post(body).expect(429);

      expect(limited.body.error.code).toBe('RATE_LIMITED');
    });
  });

  describe('GET /transactions/:id', () => {
    const get = (id: string) => request(app.getHttpServer()).get(`/api/v1/transactions/${id}`);

    it('AC-11: answers 200 with the transaction', async () => {
      h.transactionRepository.seed(aTransaction().declined().build());

      const response = await get(TRANSACTION_ID).expect(200);

      expect(response.body.data).toMatchObject({
        id: TRANSACTION_ID,
        status: 'DECLINED',
        statusMessage: 'Insufficient funds',
        deliveryId: null,
      });
      expect(response.headers['cache-control']).toBe('no-store');
    });

    it('AC-11: reconciles a PENDING transaction with the gateway', async () => {
      h.transactionRepository.seed(aTransaction().withGatewayId().build());

      const response = await get(TRANSACTION_ID).expect(200);

      expect(response.body.data.status).toBe('APPROVED');
      expect(h.productRepository.stockOf(PRODUCT_ID)).toBe(3);
    });

    it('AC-11: answers 404 TRANSACTION_NOT_FOUND and 400 for a non-UUID id', async () => {
      const missing = await get(TRANSACTION_ID).expect(404);
      const invalid = await get('IDEMPOTENCY%23abc').expect(400);

      expect(missing.body.error.code).toBe('TRANSACTION_NOT_FOUND');
      expect(invalid.body.error.code).toBe('VALIDATION_ERROR');
    });
  });
});
