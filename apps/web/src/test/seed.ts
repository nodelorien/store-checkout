import type { AppStore } from '@/app/store';
import { baseApi } from '@/shared/api/baseApi';
import type { PaymentConfig, Product } from '@/shared/api/types';
import { buildCatalogue, buildPaymentConfig } from './builders';

/** Puts server data in the RTK Query cache without a request (for selector and thunk tests). */
export function seedProducts(store: AppStore, products: Product[] = buildCatalogue()) {
  return store.dispatch(baseApi.util.upsertQueryData('getProducts', undefined, products));
}

export function seedPaymentConfig(store: AppStore, config: PaymentConfig = buildPaymentConfig()) {
  return store.dispatch(baseApi.util.upsertQueryData('getPaymentConfig', undefined, config));
}
