import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  ScanCommand,
  TransactWriteCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { mockClient } from 'aws-sdk-client-mock';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { toProductItem } from '../src/modules/products/infrastructure/persistence/dynamodb-product.repository';
import { HTTP_FETCH } from '../src/modules/transactions/infrastructure/gateway/http-payment-gateway.adapter';
import { APP_CONFIG } from '../src/shared/config/app-config';
import { CLOCK } from '../src/shared/ports/clock.port';
import { aProduct, PRODUCT_ID } from './builders/product.builder';
import { AN_ADDRESS } from './builders/transaction.builder';
import { FakeClock } from './fakes/fake-system';
import { testConfig } from './helpers/test-config';

/**
 * Wiring test: the real `AppModule` (every module, provider and adapter) with only the three
 * outer edges replaced — configuration, the DynamoDB transport and `fetch`. No network.
 */
describe('AppModule wiring', () => {
  const dynamo = mockClient(DynamoDBDocumentClient);
  const fetchFn = jest.fn<Promise<Response>, [string, RequestInit]>();
  let app: NestExpressApplication;

  const json = (status: number, body: unknown): Response =>
    new Response(JSON.stringify(body), { status });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(APP_CONFIG)
      .useValue(testConfig())
      .overrideProvider(HTTP_FETCH)
      .useValue(fetchFn)
      .overrideProvider(CLOCK)
      .useValue(new FakeClock())
      .compile();
    app = configureApp(moduleRef.createNestApplication<NestExpressApplication>());
    app.useLogger(false);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    dynamo.reset();
    fetchFn.mockReset();
  });

  it('serves health and the catalogue from DynamoDB', async () => {
    dynamo.on(ScanCommand).resolves({ Items: [toProductItem(aProduct().build())] });
    const server = app.getHttpServer();

    await request(server)
      .get('/api/v1/health')
      .expect(200, { data: { status: 'ok' } });
    const products = await request(server).get('/api/v1/products').expect(200);

    expect(products.body.data).toHaveLength(1);
  });

  it('serves payment-config through the gateway adapter', async () => {
    fetchFn.mockResolvedValue(
      json(200, {
        data: { presigned_acceptance: { acceptance_token: 'acc', permalink: 'https://t/terms' } },
      }),
    );

    const response = await request(app.getHttpServer()).get('/api/v1/payment-config').expect(200);

    expect(response.body.data).toEqual({
      publicKey: 'pub_test_key',
      tokenizationUrl: 'https://gateway.test/v1/tokens/cards',
      acceptance: { token: 'acc', permalink: 'https://t/terms' },
      currency: 'COP',
      baseFeeInCents: 250_000,
      deliveryFeeInCents: 800_000,
    });
  });

  it('runs a whole approved purchase: PENDING write, charge, poll, atomic approval', async () => {
    dynamo
      .on(GetCommand, { TableName: 'test-products' })
      .resolves({ Item: toProductItem(aProduct().withStock(3).build()) });
    dynamo.on(QueryCommand).resolves({ Items: [] });
    dynamo.on(PutCommand).resolves({});
    dynamo.on(UpdateCommand).resolves({});
    dynamo.on(TransactWriteCommand).resolves({});
    fetchFn
      .mockResolvedValueOnce(json(201, { data: { id: 'gw-1', status: 'PENDING' } }))
      .mockResolvedValueOnce(json(200, { data: { id: 'gw-1', status: 'APPROVED' } }));

    const response = await request(app.getHttpServer())
      .post('/api/v1/transactions')
      .send({
        productId: PRODUCT_ID,
        quantity: 2,
        cardToken: 'tok_test_card_123',
        cardBrand: 'VISA',
        cardLastFour: '4242',
        acceptanceToken: 'acceptance-jwt',
        customer: { fullName: 'Ada Lovelace', email: 'ada@example.com', phone: '+573001234567' },
        delivery: { ...AN_ADDRESS },
      })
      .expect(201);

    expect(response.body.data).toMatchObject({
      status: 'APPROVED',
      quantity: 2,
      amounts: { totalInCents: 27_030_000 },
    });
    expect(response.body.data.reference).toMatch(/^TX-20261009-[A-Z2-7]{8}$/);
    expect(response.body.data.deliveryId).toEqual(expect.any(String));

    const [chargeUrl, chargeInit] = fetchFn.mock.calls[0];
    expect(chargeUrl).toBe('https://gateway.test/v1/transactions');
    expect(JSON.parse(String(chargeInit.body))).toMatchObject({
      amount_in_cents: 27_030_000,
      reference: response.body.data.reference,
    });

    // Stock is only touched by the approval transaction (ADR-0011).
    const approval = dynamo.commandCalls(TransactWriteCommand)[0].args[0].input.TransactItems;
    expect(approval?.map((item) => Object.keys(item)[0])).toEqual(['Update', 'Update', 'Put']);
    expect(approval?.[1].Update?.TableName).toBe('test-products');
    const puts = dynamo.commandCalls(PutCommand).map((call) => call.args[0].input.TableName);
    expect(puts).toEqual(['test-customers', 'test-transactions']);
  });
});
