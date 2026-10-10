import { createAsyncThunk } from '@reduxjs/toolkit';
import type { AppThunk, AppThunkDispatch, RootState } from '@/app/store';
import { checkoutReset, paymentRetried } from '@/features/checkout';
import { baseApi } from '@/shared/api/baseApi';
import { isFinalStatus } from '@/shared/api/types';
import { delay } from '@/shared/lib/delay';
import { pollAttempted, pollTimedOut } from './transactionSlice';

export const POLL_INTERVAL_MS = 2000;
export const MAX_POLL_ATTEMPTS = 30;

/**
 * While a transaction is `PENDING`, re-reads it every 2 s (the API reconciles with the gateway on
 * each read) until it is final, the attempts run out or the caller aborts (page left).
 */
export const pollTransaction = createAsyncThunk<
  void,
  string,
  { state: RootState; dispatch: AppThunkDispatch }
>('transaction/poll', async (id, { dispatch, getState, signal }) => {
  while (!signal.aborted) {
    if (getState().transaction.polling.attempts >= MAX_POLL_ATTEMPTS) {
      dispatch(pollTimedOut());
      return;
    }

    try {
      await delay(POLL_INTERVAL_MS, signal);
    } catch {
      return;
    }

    dispatch(pollAttempted());
    const result = await dispatch(
      baseApi.endpoints.getTransaction.initiate(id, { forceRefetch: true, subscribe: false }),
    );
    // A failed read just counts as an attempt: keep trying until the budget is spent.
    if (result.data && isFinalStatus(result.data.status)) return;
  }
});

/**
 * Step 4 → 5. Ends the flow: clears checkout and transaction state (the persistence listener then
 * removes the stored snapshot) and refetches the products so the stock shown is fresh.
 */
export const finishCheckout = (): AppThunk => (dispatch) => {
  dispatch(checkoutReset());
  dispatch(baseApi.util.invalidateTags(['Products']));
};

/**
 * After a failed payment: back to the payment-info step for the same product, with a new
 * idempotency key. The acceptance token is single-use, so the payment config is invalidated too.
 */
export const retryPayment =
  (productId: string): AppThunk =>
  (dispatch) => {
    dispatch(paymentRetried({ productId }));
    dispatch(baseApi.util.invalidateTags(['Products', 'PaymentConfig']));
  };
