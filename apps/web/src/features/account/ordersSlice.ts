import { createSlice } from '@reduxjs/toolkit';
import { z } from 'zod';
import { baseApi } from '@/shared/api/baseApi';

export const MAX_ORDERS = 20;
export const ORDERS_STORAGE_KEY = 'orders:v1';

/** What this device remembers of a purchase: enough to find it again, nothing personal. */
const orderSchema = z.object({
  id: z.string().min(1).max(100),
  reference: z.string().min(1).max(100),
  placedAt: z.iso.datetime(),
});
const ordersSchema = z.array(orderSchema).max(MAX_ORDERS);

export type OrderEntry = z.infer<typeof orderSchema>;
export interface OrdersState {
  items: OrderEntry[];
}

export const initialOrdersState: OrdersState = { items: [] };

const ordersSlice = createSlice({
  name: 'orders',
  initialState: initialOrdersState,
  reducers: {},
  extraReducers: (builder) => {
    // Every payment attempt that reached the API, newest first. A replayed idempotent request
    // returns the same transaction and must not be listed twice.
    builder.addMatcher(baseApi.endpoints.createTransaction.matchFulfilled, (state, action) => {
      const { id, reference, createdAt } = action.payload;
      if (state.items.some((order) => order.id === id)) return;
      state.items.unshift({ id, reference, placedAt: createdAt });
      state.items.length = Math.min(state.items.length, MAX_ORDERS);
    });
  },
});

export const ordersReducer = ordersSlice.reducer;

/** Reads the stored list; anything unreadable or malformed is "no orders". */
export function loadOrders(storage: Pick<Storage, 'getItem'> = window.localStorage): OrdersState {
  try {
    const parsed = ordersSchema.safeParse(JSON.parse(storage.getItem(ORDERS_STORAGE_KEY) ?? '[]'));
    return { items: parsed.success ? parsed.data : [] };
  } catch {
    return initialOrdersState;
  }
}

/** Writes the list field by field (allow-list), so nothing else can ever be stored with it. */
export function saveOrders(
  state: OrdersState,
  storage: Pick<Storage, 'setItem'> = window.localStorage,
): void {
  try {
    const entries = state.items.map(({ id, reference, placedAt }) => ({ id, reference, placedAt }));
    storage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Storage is a convenience: without it the list simply does not survive a reload.
  }
}
