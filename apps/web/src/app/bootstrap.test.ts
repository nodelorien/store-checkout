import { initialCheckoutState, productSelected } from '@/features/checkout';
import { PRODUCT_ID } from '@/test/builders';
import { summaryState } from '@/test/states';
import { bootstrapStore } from './bootstrap';
import { toSnapshot } from './persistence/snapshot';
import { STORAGE_KEY, save } from './persistence/storage';

describe('bootstrapStore', () => {
  it('AC-8: starts from defaults when nothing valid is stored', () => {
    window.localStorage.setItem(STORAGE_KEY, '{"version":99}');

    const store = bootstrapStore();

    expect(store.getState().checkout).toEqual(initialCheckoutState);
  });

  it('AC-8: preloads the store from a valid snapshot', () => {
    save(toSnapshot(summaryState()));

    const store = bootstrapStore();

    expect(store.getState().checkout).toEqual(summaryState().checkout);
  });

  it('flushes the snapshot immediately when the page is hidden', () => {
    const target = new EventTarget();
    const store = bootstrapStore(target as unknown as Window);

    store.dispatch(productSelected(PRODUCT_ID));
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();

    target.dispatchEvent(new Event('pagehide'));

    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}')).toMatchObject({
      checkout: { step: 'PAYMENT_INFO', productId: PRODUCT_ID },
    });
  });
});
