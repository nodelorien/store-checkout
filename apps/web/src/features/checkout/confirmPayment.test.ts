import { delay, http, HttpResponse } from 'msw';
import { createAppStore } from '@/app/store';
import {
  API_URL,
  PRODUCT_ID,
  TRANSACTION_ID,
  buildPaymentConfig,
  buildProduct,
  buildTransaction,
  errorEnvelope,
} from '@/test/builders';
import { baseApi } from '@/shared/api/baseApi';
import { server } from '@/test/server';
import { IDEMPOTENCY_KEY, delivery, summaryState, tokenizedCard } from '@/test/states';
import { confirmPayment } from './confirmPayment';

interface Captured {
  key: string | null;
  body: Record<string, unknown>;
}

/** Captures POST /transactions requests and serves a new acceptance token per config request. */
function captureRequests(respond: (attempt: number) => Response = () => created()) {
  const requests: Captured[] = [];
  let configRequests = 0;
  server.use(
    http.get(`${API_URL}/payment-config`, () => {
      configRequests += 1;
      return HttpResponse.json({
        data: buildPaymentConfig({
          acceptance: {
            token: `acceptance-${configRequests}`,
            permalink: 'https://gateway.test/terms.pdf',
          },
        }),
      });
    }),
    http.post(`${API_URL}/transactions`, async ({ request }) => {
      requests.push({
        key: request.headers.get('Idempotency-Key'),
        body: (await request.json()) as Record<string, unknown>,
      });
      return respond(requests.length);
    }),
  );
  return requests;
}

const created = (overrides = {}) =>
  HttpResponse.json({ data: buildTransaction(overrides) }, { status: 201 });
const failed = (code: string, status: number) => HttpResponse.json(errorEnvelope(code), { status });

async function summaryStore(overrides = {}, products = [buildProduct()]) {
  server.use(http.get(`${API_URL}/products`, () => HttpResponse.json({ data: products })));
  const store = createAppStore(summaryState(overrides));
  // Live subscriptions, as the mounted product page and summary have. The first config request
  // (acceptance-1) becomes the cached copy, which must never be used to pay.
  await store.dispatch(baseApi.endpoints.getProducts.initiate());
  await store.dispatch(baseApi.endpoints.getPaymentConfig.initiate());
  return store;
}

describe('confirmPayment', () => {
  it('AC-4: posts the contract body with the idempotency key and moves to the status step', async () => {
    const requests = captureRequests();
    const store = await summaryStore({ quantity: 2 }, [buildProduct({ stock: 5 })]);

    const result = await store.dispatch(confirmPayment());

    expect(result.meta.requestStatus).toBe('fulfilled');
    expect(requests).toEqual([
      {
        key: IDEMPOTENCY_KEY,
        body: {
          productId: PRODUCT_ID,
          quantity: 2,
          cardToken: 'tok_test_123',
          cardBrand: 'VISA',
          cardLastFour: '4242',
          installments: 1,
          acceptanceToken: expect.stringMatching(/^acceptance-\d+$/),
          customer: {
            fullName: 'Ada Lovelace',
            email: 'ada@example.com',
            phone: '+573001234567',
          },
          delivery: {
            addressLine1: 'Cra 7 # 71-21',
            addressLine2: 'Apto 501',
            city: 'Bogota',
            region: 'Cundinamarca',
            country: 'CO',
            postalCode: '110231',
          },
        },
      },
    ]);
    expect(store.getState().checkout).toMatchObject({
      step: 'STATUS',
      submission: { status: 'idle', error: null },
    });
    expect(store.getState().transaction).toMatchObject({ id: TRANSACTION_ID, status: 'APPROVED' });
  });

  it('AC-4: never sends prices, fees or card data, and omits empty optional fields', async () => {
    const requests = captureRequests();
    const store = await summaryStore({
      delivery: { ...delivery, addressLine2: '', postalCode: '' },
    });

    await store.dispatch(confirmPayment());

    const serialised = JSON.stringify(requests[0]?.body);
    expect(serialised).not.toMatch(/InCents|price|amount|fee|number|cvc|exp/i);
    expect(requests[0]?.body.delivery).toEqual({
      addressLine1: 'Cra 7 # 71-21',
      city: 'Bogota',
      region: 'Cundinamarca',
      country: 'CO',
    });
  });

  it('AC-4: pays with a fresh acceptance token, never the cached one', async () => {
    const requests = captureRequests();
    const store = await summaryStore();
    const cached = baseApi.endpoints.getPaymentConfig.select()(store.getState()).data;

    await store.dispatch(confirmPayment());

    expect(cached?.acceptance.token).toMatch(/^acceptance-\d+$/);
    expect(requests[0]?.body.acceptanceToken).toMatch(/^acceptance-\d+$/);
    expect(requests[0]?.body.acceptanceToken).not.toBe(cached?.acceptance.token);
  });

  it('AC-5: a second dispatch while paying does not send a second request', async () => {
    const requests = captureRequests();
    server.use(
      http.post(`${API_URL}/transactions`, async () => {
        requests.push({ key: null, body: {} });
        await delay(30);
        return created();
      }),
    );
    const store = await summaryStore();

    const first = store.dispatch(confirmPayment());
    expect(store.getState().checkout.submission.status).toBe('paying');
    const second = await store.dispatch(confirmPayment());
    await first;

    expect(second.meta.requestStatus).toBe('rejected');
    expect(second.meta).toMatchObject({ condition: true });
    expect(requests).toHaveLength(1);
  });

  it.each([
    ['PAYMENT_GATEWAY_UNAVAILABLE', 502],
    ['PAYMENT_GATEWAY_REJECTED', 422],
    ['VALIDATION_ERROR', 400],
    ['PERSISTENCE_ERROR', 500],
  ])('AC-6: %s keeps the summary with the error', async (code, status) => {
    captureRequests(() => failed(code, status));
    const store = await summaryStore();

    const result = await store.dispatch(confirmPayment());

    expect(result.payload).toMatchObject({ code, status });
    expect(store.getState().checkout).toMatchObject({
      step: 'SUMMARY',
      idempotencyKey: IDEMPOTENCY_KEY,
      card: tokenizedCard,
      submission: { status: 'failed', error: { code } },
    });
    expect(store.getState().transaction.id).toBeNull();
  });

  it('AC-6: a network failure keeps the summary with the error', async () => {
    captureRequests(() => HttpResponse.error());
    const store = await summaryStore();

    await store.dispatch(confirmPayment());

    expect(store.getState().checkout.submission).toMatchObject({
      status: 'failed',
      error: { code: 'NETWORK_ERROR' },
    });
  });

  it('AC-6: a retry reuses the idempotency key with a different acceptance token', async () => {
    const requests = captureRequests((attempt) =>
      attempt === 1 ? failed('PAYMENT_GATEWAY_UNAVAILABLE', 502) : created(),
    );
    const store = await summaryStore();

    await store.dispatch(confirmPayment());
    await store.dispatch(confirmPayment());

    expect(requests).toHaveLength(2);
    expect(requests[0]?.key).toBe(IDEMPOTENCY_KEY);
    expect(requests[1]?.key).toBe(IDEMPOTENCY_KEY);
    expect(requests[0]?.body.acceptanceToken).not.toBe(requests[1]?.body.acceptanceToken);
    expect(store.getState().checkout.step).toBe('STATUS');
  });

  it('AC-7: OUT_OF_STOCK returns to the products with a notice', async () => {
    captureRequests(() => failed('OUT_OF_STOCK', 409));
    const store = await summaryStore();

    const result = await store.dispatch(confirmPayment());

    expect(result.payload).toMatchObject({ code: 'OUT_OF_STOCK' });
    expect(store.getState().checkout).toMatchObject({
      step: 'PRODUCTS',
      productId: null,
      card: null,
      notice: 'Sorry, this product just sold out.',
    });
  });

  it('AC-8: an expired token sends nothing and returns to the payment-info step', async () => {
    const requests = captureRequests();
    const store = await summaryStore({
      card: { ...tokenizedCard, expiresAt: '2020-01-01T00:00:00.000Z' },
    });

    const result = await store.dispatch(confirmPayment());

    expect(result.payload).toMatchObject({ code: 'CARD_TOKEN_EXPIRED' });
    expect(requests).toHaveLength(0);
    expect(store.getState().checkout).toMatchObject({
      step: 'PAYMENT_INFO',
      card: null,
      notice: 'Please re-enter your card',
    });
  });

  it.each([
    ['no card token', { card: null }],
    ['no delivery data', { delivery: null }],
    ['no idempotency key', { idempotencyKey: null }],
    ['terms not accepted', { acceptedTerms: false }],
  ])('rejects an incomplete checkout: %s', async (_label, overrides) => {
    const requests = captureRequests();
    const store = await summaryStore(overrides, [buildProduct({ stock: 3 })]);

    const result = await store.dispatch(confirmPayment());

    expect(result.payload).toMatchObject({ code: 'CHECKOUT_INCOMPLETE' });
    expect(requests).toHaveLength(0);
    expect(store.getState().checkout.submission.status).toBe('failed');
  });

  it('fails without charging when the payment config cannot be refreshed', async () => {
    const requests = captureRequests();
    const store = await summaryStore();
    server.use(http.get(`${API_URL}/payment-config`, () => HttpResponse.error()));

    const result = await store.dispatch(confirmPayment());

    expect(result.payload).toMatchObject({ code: 'PAYMENT_CONFIG_UNAVAILABLE' });
    expect(requests).toHaveLength(0);
    expect(store.getState().checkout.step).toBe('SUMMARY');
  });

  it('AC-11: a declined card is a created transaction, not an error', async () => {
    captureRequests(() => created({ status: 'DECLINED', statusMessage: 'Insufficient funds' }));
    const store = await summaryStore();

    const result = await store.dispatch(confirmPayment());

    expect(result.meta.requestStatus).toBe('fulfilled');
    expect(store.getState().checkout.step).toBe('STATUS');
    expect(store.getState().transaction.status).toBe('DECLINED');
  });
});
