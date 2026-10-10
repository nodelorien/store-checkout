import { createListenerMiddleware } from '@reduxjs/toolkit';
import type { RootState } from '@/app/store';
import { NOTICES, checkoutReset, quantityChanged } from './checkoutSlice';
import { selectMaxQuantity, selectProducts, selectSelectedProduct } from './selectors';

type Guard = 'none' | 'product-unavailable' | 'quantity-above-stock';

/**
 * What must be corrected for the checkout overlays to be safe to show. Evaluated only once the
 * catalogue is known, so a restored checkout is not thrown away while products are loading.
 */
export function selectCheckoutGuard(state: RootState): Guard {
  const { step, quantity } = state.checkout;
  if (step !== 'PAYMENT_INFO' && step !== 'SUMMARY') return 'none';
  if (selectProducts(state) === undefined) return 'none';

  const product = selectSelectedProduct(state);
  if (!product || product.stock <= 0) return 'product-unavailable';
  if (quantity > selectMaxQuantity(state)) return 'quantity-above-stock';
  return 'none';
}

/**
 * Keeps the checkout consistent with the catalogue, both after a refresh (restored product gone or
 * sold out) and during a session (stock changed, "Try again" on a product that sold out).
 */
export function createCheckoutListenerMiddleware() {
  const listener = createListenerMiddleware();

  listener.startListening({
    predicate: (_action, currentState) => selectCheckoutGuard(currentState as RootState) !== 'none',
    effect: (_action, api) => {
      const state = api.getState() as RootState;
      const guard = selectCheckoutGuard(state);

      if (guard === 'product-unavailable') {
        api.dispatch(checkoutReset({ notice: NOTICES.productUnavailable }));
      } else if (guard === 'quantity-above-stock') {
        api.dispatch(quantityChanged(selectMaxQuantity(state)));
      }
    },
  });

  return listener;
}
