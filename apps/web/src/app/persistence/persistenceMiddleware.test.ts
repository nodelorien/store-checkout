import { checkoutReset, productSelected } from '@/features/checkout';
import { deliveryDraftChanged, quantityChanged } from '@/features/checkout/checkoutSlice';
import { baseApi } from '@/shared/api/baseApi';
import { PRODUCT_ID } from '@/test/builders';
import { delivery, summaryState } from '@/test/states';
import { createAppStore } from '../store';
import { SAVE_DEBOUNCE_MS, persistState } from './persistenceMiddleware';
import { STORAGE_KEY } from './storage';

const stored = () => {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  return raw === null ? null : JSON.parse(raw);
};

describe('persistence middleware', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('AC-7: saves the snapshot after the debounce window', async () => {
    const store = createAppStore();

    store.dispatch(productSelected(PRODUCT_ID));
    await jest.advanceTimersByTimeAsync(SAVE_DEBOUNCE_MS - 1);
    expect(stored()).toBeNull();

    await jest.advanceTimersByTimeAsync(1);
    expect(stored()).toMatchObject({
      version: 1,
      checkout: { step: 'PAYMENT_INFO', productId: PRODUCT_ID },
    });
  });

  it('AC-7: collapses a burst of changes into one write with the latest state', async () => {
    const setItem = jest.spyOn(Storage.prototype, 'setItem');
    const store = createAppStore();

    store.dispatch(productSelected(PRODUCT_ID));
    store.dispatch(deliveryDraftChanged({ ...delivery, fullName: 'A' }));
    await jest.advanceTimersByTimeAsync(100);
    store.dispatch(deliveryDraftChanged(delivery));
    store.dispatch(quantityChanged(2));
    await jest.advanceTimersByTimeAsync(SAVE_DEBOUNCE_MS);

    expect(setItem).toHaveBeenCalledTimes(1);
    expect(stored().checkout).toMatchObject({ quantity: 2, delivery });
  });

  it('AC-7: removes the stored key when the flow is reset', async () => {
    const store = createAppStore(summaryState());
    persistState(store.getState());
    expect(stored()).not.toBeNull();

    store.dispatch(checkoutReset());
    await jest.advanceTimersByTimeAsync(SAVE_DEBOUNCE_MS);

    expect(stored()).toBeNull();
  });

  it('does not write for actions that leave checkout and transaction untouched', async () => {
    const setItem = jest.spyOn(Storage.prototype, 'setItem');
    const store = createAppStore(summaryState());

    store.dispatch(baseApi.util.resetApiState());
    await jest.advanceTimersByTimeAsync(SAVE_DEBOUNCE_MS);

    expect(setItem).not.toHaveBeenCalled();
  });

  it('AC-7: keeps working when storage throws', async () => {
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });
    const store = createAppStore();

    store.dispatch(productSelected(PRODUCT_ID));
    await jest.advanceTimersByTimeAsync(SAVE_DEBOUNCE_MS);

    expect(store.getState().checkout.step).toBe('PAYMENT_INFO');
  });
});
