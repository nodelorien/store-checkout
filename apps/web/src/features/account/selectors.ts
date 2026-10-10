import type { RootState } from '@/app/store';

export const selectOrders = (state: RootState) => state.orders.items;

/** True on the device that placed the order: it may see and correct the delivery address. */
export const selectIsOwnOrder = (state: RootState, transactionId: string) =>
  state.orders.items.some((order) => order.id === transactionId);
