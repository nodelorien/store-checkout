import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { FakePaymentGateway } from '../../../../../test/fakes/fake-payment-gateway';
import { createHttpTestApp } from '../../../../../test/helpers/test-app';
import { DomainErrors } from '../../../../shared/errors/domain-error';
import { FEES_CONFIG } from '../../../../shared/ports/fees-config.port';
import { PAYMENT_GATEWAY_PORT } from '../../../transactions/application/ports/payment-gateway.port';
import { PAYMENT_PUBLIC_CONFIG } from '../../application/ports/payment-public-config.port';
import { GetPaymentConfigUseCase } from '../../application/use-cases/get-payment-config.use-case';
import { PaymentConfigController } from './payment-config.controller';

describe('GET /api/v1/payment-config', () => {
  let app: NestExpressApplication;
  let gateway: FakePaymentGateway;

  beforeEach(async () => {
    gateway = new FakePaymentGateway();
    app = await createHttpTestApp({
      controllers: [PaymentConfigController],
      providers: [
        { provide: PAYMENT_GATEWAY_PORT, useValue: gateway },
        {
          provide: PAYMENT_PUBLIC_CONFIG,
          useValue: {
            publicKey: 'pub_test_key',
            tokenizationUrl: 'https://gateway.test/v1/tokens/cards',
            currency: 'COP',
          },
        },
        {
          provide: FEES_CONFIG,
          useValue: { baseFeeInCents: 250_000, deliveryFeeInCents: 800_000 },
        },
        GetPaymentConfigUseCase,
      ],
    });
  });

  afterEach(async () => {
    await app.close();
  });

  const get = () => request(app.getHttpServer()).get('/api/v1/payment-config');

  it('AC-1: answers 200 with the public gateway data and the server-side fees', async () => {
    const response = await get().expect(200);

    expect(response.body).toEqual({
      data: {
        publicKey: 'pub_test_key',
        tokenizationUrl: 'https://gateway.test/v1/tokens/cards',
        acceptance: { token: 'acceptance-token', permalink: 'https://gateway.test/terms.pdf' },
        currency: 'COP',
        baseFeeInCents: 250_000,
        deliveryFeeInCents: 800_000,
      },
    });
    expect(response.headers['cache-control']).toBe('no-store');
  });

  it('AC-1: asks the gateway for a fresh acceptance token on every request', async () => {
    await get().expect(200);
    gateway.acceptance = { token: 'second-token', permalink: 'https://gateway.test/terms.pdf' };
    const second = await get().expect(200);

    expect(gateway.acceptanceCalls).toBe(2);
    expect(second.body.data.acceptance.token).toBe('second-token');
  });

  it('AC-2: answers 502 PAYMENT_GATEWAY_UNAVAILABLE when the gateway fails', async () => {
    gateway.acceptance = DomainErrors.gatewayUnavailable();

    const response = await get().expect(502);

    expect(response.body.error).toMatchObject({ code: 'PAYMENT_GATEWAY_UNAVAILABLE', details: [] });
  });

  it('never exposes the private key or the integrity secret', async () => {
    const response = await get();

    expect(JSON.stringify(response.body)).not.toMatch(/prv_|integrity/i);
  });
});
