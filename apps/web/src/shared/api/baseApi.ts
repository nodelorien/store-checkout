import {
  createApi,
  fetchBaseQuery,
  type BaseQueryFn,
  type FetchArgs,
  type FetchBaseQueryMeta,
} from '@reduxjs/toolkit/query/react';
import { env } from '@/shared/config/env';
import {
  isFinalStatus,
  type CatalogueQuery,
  type CreateTransactionArgs,
  type Delivery,
  type DeliveryAddressPatch,
  type PageMeta,
  type PaymentConfig,
  type Product,
  type ProductsPage,
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

/** What the envelope carries besides `data`; endpoints read it in `transformResponse`. */
export type ApiMeta = FetchBaseQueryMeta & { page?: unknown };

function isPageMeta(value: unknown): value is PageMeta {
  if (typeof value !== 'object' || value === null) return false;
  const meta = value as Record<string, unknown>;
  return ['page', 'pageSize', 'total', 'totalPages'].every((key) => Number.isInteger(meta[key]));
}

/** Page of products; an answer without `meta` is treated as the whole catalogue in one page. */
export function toProductsPage(items: Product[], meta: unknown): ProductsPage {
  return {
    items,
    meta: isPageMeta(meta)
      ? meta
      : { page: 1, pageSize: Math.max(1, items.length), total: items.length, totalPages: 1 },
  };
}

export function catalogueParams(query: CatalogueQuery): Record<string, string | number> {
  const search = query.search.trim();
  return {
    page: query.page,
    pageSize: query.pageSize,
    ...(search ? { search } : {}),
    // Always explicit: without it the API keeps its original alphabetical order.
    sort: query.sort,
  };
}

/** Unwraps the `{ data }` envelope and turns every failure into a `UiError`. */
export const apiBaseQuery: BaseQueryFn<
  string | FetchArgs,
  unknown,
  UiError,
  object,
  ApiMeta
> = async (args, api, extraOptions) => {
  const result = await rawBaseQuery(args, api, extraOptions);

  if (result.error) {
    return { error: toUiError(result.error) };
  }
  if (!hasData(result.data)) {
    return { error: createUiError('UNEXPECTED_RESPONSE', result.meta?.response?.status ?? null) };
  }
  const page = 'meta' in result.data ? result.data.meta : undefined;
  return { data: result.data.data, meta: result.meta && { ...result.meta, page } };
};

export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery: apiBaseQuery,
  tagTypes: ['Products', 'PaymentConfig', 'Transaction', 'Delivery'],
  endpoints: (build) => ({
    getProducts: build.query<Product[], void>({
      query: () => '/products',
      providesTags: ['Products'],
    }),
    getProductsPage: build.query<ProductsPage, CatalogueQuery>({
      query: (query) => ({ url: '/products', params: catalogueParams(query) }),
      transformResponse: (items: Product[], meta) => toProductsPage(items, meta?.page),
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
    getTransactionDelivery: build.query<Delivery, string>({
      query: (transactionId) => `/transactions/${encodeURIComponent(transactionId)}/delivery`,
      providesTags: (_result, _error, transactionId) => [{ type: 'Delivery', id: transactionId }],
    }),
    updateDeliveryAddress: build.mutation<
      Delivery,
      { deliveryId: string; transactionId: string; address: DeliveryAddressPatch }
    >({
      query: ({ deliveryId, address }) => ({
        url: `/deliveries/${encodeURIComponent(deliveryId)}`,
        method: 'PATCH',
        body: address,
      }),
      // Also on failure: a 409 means the delivery moved on, so the shown status is stale.
      invalidatesTags: (_result, _error, { transactionId }) => [
        { type: 'Delivery', id: transactionId },
      ],
    }),
  }),
});

export const {
  useGetProductsQuery,
  useGetProductsPageQuery,
  useGetPaymentConfigQuery,
  useCreateTransactionMutation,
  useGetTransactionQuery,
  useGetTransactionDeliveryQuery,
  useUpdateDeliveryAddressMutation,
} = baseApi;
