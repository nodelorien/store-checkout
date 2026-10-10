import { createSlice, isAnyOf } from '@reduxjs/toolkit';
import {
  checkoutDialogClosed,
  checkoutReset,
  paymentRetried,
  productSelected,
} from '@/features/checkout';
import { baseApi } from '@/shared/api/baseApi';
import type { TransactionStatus } from '@/shared/api/types';

export interface TransactionState {
  id: string | null;
  reference: string | null;
  status: TransactionStatus | null;
  polling: { attempts: number; timedOut: boolean };
}

export const initialTransactionState: TransactionState = {
  id: null,
  reference: null,
  status: null,
  polling: { attempts: 0, timedOut: false },
};

const transactionSlice = createSlice({
  name: 'transaction',
  initialState: initialTransactionState,
  reducers: {
    pollAttempted(state) {
      state.polling.attempts += 1;
    },
    pollTimedOut(state) {
      state.polling.timedOut = true;
    },
    pollingRestarted(state) {
      state.polling = { attempts: 0, timedOut: false };
    },
  },
  extraReducers: (builder) => {
    builder
      .addMatcher(baseApi.endpoints.createTransaction.matchFulfilled, (_state, action) => ({
        id: action.payload.id,
        reference: action.payload.reference,
        status: action.payload.status,
        polling: { attempts: 0, timedOut: false },
      }))
      .addMatcher(baseApi.endpoints.getTransaction.matchFulfilled, (state, action) => {
        // Only the transaction of the flow in progress is tracked; viewing another one by URL
        // must not hijack the checkout.
        if (state.id === action.payload.id) {
          state.reference = action.payload.reference;
          state.status = action.payload.status;
        }
      })
      .addMatcher(
        isAnyOf(checkoutReset, paymentRetried, productSelected, checkoutDialogClosed),
        () => initialTransactionState,
      );
  },
});

export const transactionReducer = transactionSlice.reducer;
export const { pollAttempted, pollTimedOut, pollingRestarted } = transactionSlice.actions;
