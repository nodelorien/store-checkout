import { combineReducers } from '@reduxjs/toolkit';
import { ordersReducer } from '@/features/account';
import { checkoutReducer } from '@/features/checkout';
import { transactionReducer } from '@/features/transaction';
import { baseApi } from '@/shared/api/baseApi';

export const rootReducer = combineReducers({
  [baseApi.reducerPath]: baseApi.reducer,
  checkout: checkoutReducer,
  transaction: transactionReducer,
  orders: ordersReducer,
});

export type RootState = ReturnType<typeof rootReducer>;
