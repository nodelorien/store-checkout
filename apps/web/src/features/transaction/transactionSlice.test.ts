import { createAppStore } from '@/app/store';
import { checkoutReset, paymentRetried, productSelected } from '@/features/checkout';
import { baseApi } from '@/shared/api/baseApi';
import { API_URL, PRODUCT_ID, TRANSACTION_ID, buildTransaction } from '@/test/builders';
import { server } from '@/test/server';
import { statusState } from '@/test/states';
import { http, HttpResponse } from 'msw';
import {
  initialTransactionState,
  pollAttempted,
  pollTimedOut,
  pollingRestarted,
  transactionReducer,
} from './transactionSlice';

describe('transactionSlice', () => {
  it('counts polling attempts, times out and restarts', () => {
    let state = transactionReducer(initialTransactionState, pollAttempted());
    state = transactionReducer(state, pollAttempted());
    state = transactionReducer(state, pollTimedOut());
    expect(state.polling).toEqual({ attempts: 2, timedOut: true });

    expect(transactionReducer(state, pollingRestarted()).polling).toEqual({
      attempts: 0,
      timedOut: false,
    });
  });

  it('stores the created transaction', async () => {
    server.use(
      http.post(`${API_URL}/transactions`, () =>
        HttpResponse.json({ data: buildTransaction({ status: 'PENDING' }) }, { status: 201 }),
      ),
    );
    const store = createAppStore();

    await store.dispatch(
      baseApi.endpoints.createTransaction.initiate({
        idempotencyKey: 'key',
        body: {} as never,
      }),
    );

    expect(store.getState().transaction).toEqual({
      id: TRANSACTION_ID,
      reference: 'TX-20261009-7K2M9QXA',
      status: 'PENDING',
      polling: { attempts: 0, timedOut: false },
    });
    expect(store.getState().checkout.step).toBe('STATUS');
  });

  it('updates the status when the tracked transaction is read again', async () => {
    const store = createAppStore(statusState({ status: 'PENDING' }));

    await store.dispatch(baseApi.endpoints.getTransaction.initiate(TRANSACTION_ID));

    expect(store.getState().transaction.status).toBe('APPROVED');
  });

  it('ignores a transaction that is not the one of the flow in progress', async () => {
    const store = createAppStore();

    await store.dispatch(baseApi.endpoints.getTransaction.initiate('another-id'));

    expect(store.getState().transaction).toEqual(initialTransactionState);
  });

  it.each([
    ['checkoutReset', checkoutReset()],
    ['paymentRetried', paymentRetried({ productId: PRODUCT_ID })],
    ['productSelected', productSelected(PRODUCT_ID)],
  ])('is cleared by %s', (_name, action) => {
    expect(transactionReducer(statusState().transaction, action)).toEqual(initialTransactionState);
  });
});
