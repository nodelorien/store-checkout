import { createListenerMiddleware } from '@reduxjs/toolkit';
import { saveOrders, type OrdersState } from './ordersSlice';

interface WithOrders {
  orders: OrdersState;
}

/** Stores the order list whenever it changes. */
export function createOrdersListenerMiddleware() {
  const listener = createListenerMiddleware();

  listener.startListening({
    predicate: (_action, current, previous) =>
      (current as WithOrders).orders !== (previous as WithOrders).orders,
    effect: (_action, api) => saveOrders((api.getState() as WithOrders).orders),
  });

  return listener;
}
