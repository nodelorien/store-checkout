import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { aGatewayEvent } from '../../../../../test/builders/gateway-event.builder';
import { aProduct, PRODUCT_ID } from '../../../../../test/builders/product.builder';
import { aTransaction } from '../../../../../test/builders/transaction.builder';
import { createHttpTestApp } from '../../../../../test/helpers/test-app';
import {
  TransactionsHarness,
  transactionsHarness,
} from '../../../../../test/helpers/transactions-harness';
import { transactionProviders } from '../../../../../test/helpers/transactions-providers';
import { GATEWAY_EVENT_VERIFIER } from '../../application/ports/gateway-event-verifier.port';
import { HandleGatewayEventUseCase } from '../../application/use-cases/handle-gateway-event.use-case';
import { ChecksumGatewayEventVerifier } from '../gateway/checksum-gateway-event.verifier';
import { GatewayWebhookController } from './gateway-webhook.controller';

describe('POST /api/v1/webhooks/payment-gateway', () => {
  let app: NestExpressApplication;
  let h: TransactionsHarness;

  beforeEach(async () => {
    h = transactionsHarness([aProduct().withStock(5).build()]);
    h.transactionRepository.seed(aTransaction().withGatewayId().build());
    app = await createHttpTestApp({
      controllers: [GatewayWebhookController],
      providers: [
        ...transactionProviders(h),
        { provide: GATEWAY_EVENT_VERIFIER, useClass: ChecksumGatewayEventVerifier },
        HandleGatewayEventUseCase,
      ],
    });
  });

  afterEach(async () => {
    await app.close();
  });

  const post = (payload: string | object) =>
    request(app.getHttpServer()).post('/api/v1/webhooks/payment-gateway').send(payload);

  it('AC-1: answers 200 and approves the transaction for an authentic event', async () => {
    const response = await post(aGatewayEvent()).expect(200);

    expect(response.body).toEqual({ data: { received: true, handled: true } });
    expect(response.headers['cache-control']).toBe('no-store');
    expect(h.transactionRepository.only().status).toBe('APPROVED');
    expect(h.productRepository.stockOf(PRODUCT_ID)).toBe(3);
  });

  it('AC-9: accepts the extra fields the gateway sends (no whitelist on this body)', async () => {
    const event = { ...aGatewayEvent(), environment: 'test', sent_at: 'now', anything: { a: 1 } };

    await post(event).expect(200);
  });

  it('AC-3: answers 401 INVALID_SIGNATURE for a wrong checksum', async () => {
    const response = await post(aGatewayEvent({ secret: 'attacker' })).expect(401);

    expect(response.body.error).toMatchObject({ code: 'INVALID_SIGNATURE', details: [] });
    expect(h.transactionRepository.only().status).toBe('PENDING');
  });

  it('AC-5: answers 400 VALIDATION_ERROR for a body that is not an event', async () => {
    const response = await post({ event: 'transaction.updated' }).expect(400);

    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    await post('"just a string"').set('Content-Type', 'application/json').expect(400);
  });

  it('AC-6: answers 200 handled:false for an authentic event with nothing to apply', async () => {
    const response = await post(
      aGatewayEvent({ transaction: { reference: 'TX-20261009-ZZZZZZZZ' } }),
    ).expect(200);

    expect(response.body).toEqual({ data: { received: true, handled: false } });
  });

  it('AC-7: is idempotent across repeated deliveries', async () => {
    await post(aGatewayEvent()).expect(200);
    await post(aGatewayEvent()).expect(200);

    expect(h.productRepository.stockOf(PRODUCT_ID)).toBe(3);
    expect(h.transactionRepository.deliveries.size).toBe(1);
  });

  it('AC-8: answers 500 when the store fails so the gateway retries', async () => {
    h.transactionRepository.failOn('findByReference');

    const response = await post(aGatewayEvent()).expect(500);

    expect(response.body.error.code).toBe('PERSISTENCE_ERROR');
  });
});
