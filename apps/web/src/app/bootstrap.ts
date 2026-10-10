import { loadOrders } from '@/features/account';
import { resumeCheckout } from '@/features/checkout';
import { persistState } from './persistence/persistenceMiddleware';
import { fromSnapshot } from './persistence/snapshot';
import { load } from './persistence/storage';
import { createAppStore, type AppStore } from './store';

/**
 * Creates the store preloaded from the persisted snapshot (if valid), resumes the checkout, and
 * flushes the snapshot when the page is hidden so a refresh inside the debounce window loses nothing.
 */
export function bootstrapStore(target: Pick<Window, 'addEventListener'> = window): AppStore {
  const store = createAppStore({ ...fromSnapshot(load()), orders: loadOrders() });

  store.dispatch(resumeCheckout());
  target.addEventListener('pagehide', () => persistState(store.getState()));

  return store;
}
