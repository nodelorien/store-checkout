import {
  createApi,
  fetchBaseQuery,
  type BaseQueryFn,
  type FetchArgs,
} from '@reduxjs/toolkit/query/react';
import { env } from '@/shared/config/env';
import {
  isFinalStatus,
  type CreateTransactionArgs,
  type PaymentConfig,
  type Product,
  type Transaction,
} from './types';
import { createUiError, toUiError, type UiError } from './uiError';

const rawBaseQuery = fetchBaseQuery({
  baseUrl: env.apiBaseUrl,
  prepareHeaders: (headers) => {
    headers.set('Accept', 'application/json');
    return headers;
  },
});

function hasData(body: unknown): body is { data: unknown } {
  return typeof body === 'object' && body !== null && 'data' in body;
}

/** Unwraps the `{ data }` envelope and turns every failure into a `UiError`. */
export const apiBaseQuery: BaseQueryFn<string | FetchArgs, unknown, UiError> = async (
  args,
  api,
  extraOptions,
) => {
  const result = await rawBaseQuery(args, api, extraOptions);

  if (result.error) {
    return { error: toUiError(result.error) };
  }
  if (!hasData(result.data)) {
    return { error: createUiError('UNEXPECTED_RESPONSE', result.meta?.response?.status ?? null) };
  }
  return { data: result.data.data };
};

export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery: apiBaseQuery,
  tagTypes: ['Products', 'PaymentConfig', 'Transaction'],
  endpoints: (build) => ({
    getProducts: build.query<Product[], void>({
      query: () => '/products',
      providesTags: ['Products'],
    }),
    getPaymentConfig: build.query<PaymentConfig, void>({
      query: () => '/payment-config',
      providesTags: ['PaymentConfig'],
    }),
    createTransaction: build.mutation<Transaction, CreateTransactionArgs>({
      query: ({ body, idempotencyKey }) => ({
        url: '/transactions',
        method: 'POST',
        body,
        headers: { 'Idempotency-Key': idempotencyKey },
      }),
      // Runs on success and on failure: stock may have changed either way (e.g. OUT_OF_STOCK),
      // and the acceptance token in the payment config is single-use, so it is spent by any attempt.
      invalidatesTags: ['Products', 'PaymentConfig'],
    }),
    getTransaction: build.query<Transaction, string>({
      query: (id) => `/transactions/${encodeURIComponent(id)}`,
      providesTags: (_result, _error, id) => [{ type: 'Transaction', id }],
      async onQueryStarted(_id, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          if (isFinalStatus(data.status)) {
            dispatch(baseApi.util.invalidateTags(['Products']));
          }
        } catch {
          // The error is already in the cache entry; nothing to invalidate.
        }
      },
    }),
  }),
});

export const {
  useGetProductsQuery,
  useGetPaymentConfigQuery,
  useCreateTransactionMutation,
  useGetTransactionQuery,
} = baseApi;
