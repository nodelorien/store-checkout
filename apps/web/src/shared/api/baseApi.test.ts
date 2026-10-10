import { http, HttpResponse } from 'msw';
import { createAppStore } from '@/app/store';
import {
  API_URL,
  PRODUCT_ID,
  TRANSACTION_ID,
  buildCatalogue,
  buildPaymentConfig,
  buildTransaction,
  errorEnvelope,
} from '@/test/builders';
import { server } from '@/test/server';
import { baseApi } from './baseApi';
import type { CreateTransactionArgs } from './types';

const createArgs: CreateTransactionArgs = {
  idempotencyKey: '11111111-1111-4111-8111-111111111111',
  body: {
    productId: PRODUCT_ID,
    quantity: 1,
    cardToken: 'tok_test_123',
    cardBrand: 'VISA',
    cardLastFour: '4242',
    installments: 1,
    acceptanceToken: 'acceptance-token-123',
    customer: { fullName: 'Ada Lovelace', email: 'ada@example.com', phone: '+573001234567' },
    delivery: {
      addressLine1: 'Cra 7 # 71-21',
      city: 'Bogota',
      region: 'Cundinamarca',
      country: 'CO',
    },
  },
};

describe('baseApi', () => {
  it('AC-2: unwraps the data envelope of GET /products', async () => {
    const store = createAppStore();

    const result = await store.dispatch(baseApi.endpoints.getProducts.initiate());

    expect(result.data).toEqual(buildCatalogue());
  });

  it('AC-2: unwraps GET /payment-config', async () => {
    const store = createAppStore();

    const result = await store.dispatch(baseApi.endpoints.getPaymentConfig.initiate());

    expect(result.data).toEqual(buildPaymentConfig());
  });

  it('AC-3: normalises an error envelope into a UiError', async () => {
    server.use(
      http.get(`${API_URL}/products`, () =>
        HttpResponse.json(errorEnvelope('PERSISTENCE_ERROR'), { status: 500 }),
      ),
    );
    const store = createAppStore();

    const result = await store.dispatch(baseApi.endpoints.getProducts.initiate());

    expect(result.error).toEqual({
      code: 'PERSISTENCE_ERROR',
      message: 'Something went wrong. Please try again.',
      status: 500,
      requestId: 'req-123',
    });
  });

  it('AC-3: normalises a network failure', async () => {
    server.use(http.get(`${API_URL}/products`, () => HttpResponse.error()));
    const store = createAppStore();

    const result = await store.dispatch(baseApi.endpoints.getProducts.initiate());

    expect(result.error).toMatchObject({ code: 'NETWORK_ERROR', status: null });
  });

  it('AC-3: rejects a success body without the data envelope', async () => {
    server.use(http.get(`${API_URL}/products`, () => HttpResponse.json([{ id: 'x' }])));
    const store = createAppStore();

    const result = await store.dispatch(baseApi.endpoints.getProducts.initiate());

    expect(result.error).toMatchObject({ code: 'UNEXPECTED_RESPONSE', status: 200 });
  });

  it('AC-4: posts the transaction with the Idempotency-Key header and JSON body', async () => {
    let received: { key: string | null; body: unknown } | undefined;
    server.use(
      http.post(`${API_URL}/transactions`, async ({ request }) => {
        received = { key: request.headers.get('Idempotency-Key'), body: await request.json() };
        return HttpResponse.json({ data: buildTransaction() }, { status: 201 });
      }),
    );
    const store = createAppStore();

    const result = await store.dispatch(baseApi.endpoints.createTransaction.initiate(createArgs));

    expect(result.data).toEqual(buildTransaction());
    expect(received).toEqual({ key: createArgs.idempotencyKey, body: createArgs.body });
  });

  it('AC-3: surfaces OUT_OF_STOCK from POST /transactions', async () => {
    server.use(
      http.post(`${API_URL}/transactions`, () =>
        HttpResponse.json(errorEnvelope('OUT_OF_STOCK'), { status: 409 }),
      ),
    );
    const store = createAppStore();

    const result = await store.dispatch(baseApi.endpoints.createTransaction.initiate(createArgs));

    expect(result.error).toMatchObject({ code: 'OUT_OF_STOCK', status: 409 });
  });

  it('reads a transaction by id (encoded in the path)', async () => {
    const store = createAppStore();

    const result = await store.dispatch(baseApi.endpoints.getTransaction.initiate(TRANSACTION_ID));

    expect(result.data).toEqual(buildTransaction());
  });

  it('refetches products once a transaction reaches a final status', async () => {
    let productRequests = 0;
    server.use(
      http.get(`${API_URL}/products`, () => {
        productRequests += 1;
        return HttpResponse.json({ data: buildCatalogue() });
      }),
    );
    const store = createAppStore();
    await store.dispatch(baseApi.endpoints.getProducts.initiate());

    await store.dispatch(baseApi.endpoints.getTransaction.initiate(TRANSACTION_ID));
    await Promise.all(store.dispatch(baseApi.util.getRunningQueriesThunk()));

    expect(productRequests).toBe(2);
  });

  it('does not refetch products while the transaction is pending or failed to load', async () => {
    let productRequests = 0;
    server.use(
      http.get(`${API_URL}/products`, () => {
        productRequests += 1;
        return HttpResponse.json({ data: buildCatalogue() });
      }),
      http.get(`${API_URL}/transactions/pending`, () =>
        HttpResponse.json({ data: buildTransaction({ id: 'pending', status: 'PENDING' }) }),
      ),
      http.get(`${API_URL}/transactions/missing`, () =>
        HttpResponse.json(errorEnvelope('TRANSACTION_NOT_FOUND'), { status: 404 }),
      ),
    );
    const store = createAppStore();
    await store.dispatch(baseApi.endpoints.getProducts.initiate());

    await store.dispatch(baseApi.endpoints.getTransaction.initiate('pending'));
    const missing = await store.dispatch(baseApi.endpoints.getTransaction.initiate('missing'));
    await Promise.all(store.dispatch(baseApi.util.getRunningQueriesThunk()));

    expect(missing.error).toMatchObject({ code: 'TRANSACTION_NOT_FOUND', status: 404 });
    expect(productRequests).toBe(1);
  });
});
