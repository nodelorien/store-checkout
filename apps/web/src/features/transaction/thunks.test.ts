import { http, HttpResponse } from 'msw';
import { createAppStore } from '@/app/store';
import { initialCheckoutState } from '@/features/checkout';
import { baseApi } from '@/shared/api/baseApi';
import { delay } from '@/shared/lib/delay';
import {
  API_URL,
  PRODUCT_ID,
  TRANSACTION_ID,
  buildCatalogue,
  buildPaymentConfig,
  buildTransaction,
} from '@/test/builders';
import { server } from '@/test/server';
import { delivery, statusState } from '@/test/states';
import {
  MAX_POLL_ATTEMPTS,
  POLL_INTERVAL_MS,
  finishCheckout,
  pollTransaction,
  retryPayment,
} from './thunks';
import { initialTransactionState } from './transactionSlice';

jest.mock('@/shared/lib/delay', () => jest.requireActual('@/test/delayMock'));

const delayMock = jest.mocked(delay);

/** Serves PENDING until `resolveAfter` reads have happened, then the final status. */
function servePending(resolveAfter: number, finalStatus: 'APPROVED' | 'DECLINED' = 'APPROVED') {
  let reads = 0;
  server.use(
    http.get(`${API_URL}/transactions/:id`, () => {
      reads += 1;
      return HttpResponse.json({
        data: buildTransaction({ status: reads > resolveAfter ? finalStatus : 'PENDING' }),
      });
    }),
  );
  return () => reads;
}

describe('pollTransaction', () => {
  beforeEach(() => delayMock.mockClear());

  it('AC-5: re-reads every 2 s until the status is final', async () => {
    const reads = servePending(2);
    const store = createAppStore(statusState({ status: 'PENDING' }));

    await store.dispatch(pollTransaction(TRANSACTION_ID));

    expect(reads()).toBe(3);
    expect(delayMock).toHaveBeenCalledTimes(3);
    expect(delayMock).toHaveBeenCalledWith(POLL_INTERVAL_MS, expect.any(AbortSignal));
    expect(store.getState().transaction).toMatchObject({
      status: 'APPROVED',
      polling: { attempts: 3, timedOut: false },
    });
  });

  it('AC-6: gives up after the maximum number of attempts', async () => {
    const reads = servePending(Number.POSITIVE_INFINITY);
    const store = createAppStore(statusState({ status: 'PENDING' }));

    await store.dispatch(pollTransaction(TRANSACTION_ID));

    expect(MAX_POLL_ATTEMPTS).toBe(30);
    expect(reads()).toBe(30);
    expect(store.getState().transaction).toMatchObject({
      status: 'PENDING',
      polling: { attempts: 30, timedOut: true },
    });
  });

  it('continues from the attempts already made', async () => {
    const reads = servePending(Number.POSITIVE_INFINITY);
    const store = createAppStore(
      statusState({ status: 'PENDING', polling: { attempts: 28, timedOut: false } }),
    );

    await store.dispatch(pollTransaction(TRANSACTION_ID));

    expect(reads()).toBe(2);
    expect(store.getState().transaction.polling).toEqual({ attempts: 30, timedOut: true });
  });

  it('counts a failed read as an attempt and keeps polling', async () => {
    let reads = 0;
    server.use(
      http.get(`${API_URL}/transactions/:id`, () => {
        reads += 1;
        return reads === 1
          ? HttpResponse.error()
          : HttpResponse.json({ data: buildTransaction({ status: 'DECLINED' }) });
      }),
    );
    const store = createAppStore(statusState({ status: 'PENDING' }));

    await store.dispatch(pollTransaction(TRANSACTION_ID));

    expect(reads).toBe(2);
    expect(store.getState().transaction).toMatchObject({
      status: 'DECLINED',
      polling: { attempts: 2, timedOut: false },
    });
  });

  it('AC-10: stops without reading when aborted while waiting', async () => {
    const reads = servePending(Number.POSITIVE_INFINITY);
    delayMock.mockImplementationOnce(
      (_ms, signal) =>
        new Promise<void>((_resolve, reject) => {
          signal?.addEventListener('abort', () => reject(new Error('aborted')));
        }),
    );
    const store = createAppStore(statusState({ status: 'PENDING' }));

    const poll = store.dispatch(pollTransaction(TRANSACTION_ID));
    poll.abort();
    await poll;

    expect(reads()).toBe(0);
    expect(store.getState().transaction.polling).toEqual({ attempts: 0, timedOut: false });
  });
});

describe('finishCheckout', () => {
  it('AC-7: clears checkout and transaction state and refetches the products', async () => {
    let productRequests = 0;
    server.use(
      http.get(`${API_URL}/products`, () => {
        productRequests += 1;
        return HttpResponse.json({ data: buildCatalogue() });
      }),
    );
    const store = createAppStore(statusState());
    await store.dispatch(baseApi.endpoints.getProducts.initiate());

    store.dispatch(finishCheckout());
    await Promise.all(store.dispatch(baseApi.util.getRunningQueriesThunk()));

    expect(store.getState().checkout).toEqual(initialCheckoutState);
    expect(store.getState().transaction).toEqual(initialTransactionState);
    expect(productRequests).toBe(2);
  });
});

describe('retryPayment', () => {
  it('AC-8: reopens the payment-info step and discards the cached payment config', async () => {
    let configRequests = 0;
    server.use(
      http.get(`${API_URL}/payment-config`, () => {
        configRequests += 1;
        return HttpResponse.json({ data: buildPaymentConfig() });
      }),
    );
    const store = createAppStore(statusState({ status: 'DECLINED' }));
    await store.dispatch(baseApi.endpoints.getPaymentConfig.initiate());

    store.dispatch(retryPayment(PRODUCT_ID));
    await Promise.all(store.dispatch(baseApi.util.getRunningQueriesThunk()));

    expect(store.getState().checkout).toMatchObject({
      step: 'PAYMENT_INFO',
      productId: PRODUCT_ID,
      delivery,
      card: null,
      idempotencyKey: null,
    });
    expect(store.getState().transaction).toEqual(initialTransactionState);
    expect(configRequests).toBe(2);
  });
});
