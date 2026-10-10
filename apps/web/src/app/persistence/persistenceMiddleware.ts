import { createListenerMiddleware } from '@reduxjs/toolkit';
import type { RootState } from '../rootReducer';
import { isEmptySnapshot, toSnapshot, type PersistedSlices } from './snapshot';
import { clear, save } from './storage';

export const SAVE_DEBOUNCE_MS = 250;

/** Writes the allow-listed snapshot now (also used to flush when the page is being hidden). */
export function persistState(state: PersistedSlices, now: Date = new Date()): void {
  const snapshot = toSnapshot(state, now);
  if (isEmptySnapshot(snapshot)) {
    clear();
  } else {
    save(snapshot);
  }
}

/**
 * Saves after any action that changed the `checkout` or `transaction` slice (including RTK Query
 * results reduced by them), debounced so typing in the delivery form does not hit storage per key.
 */
export function createPersistenceMiddleware() {
  const listener = createListenerMiddleware();

  listener.startListening({
    predicate: (_action, currentState, previousState) => {
      const current = currentState as RootState;
      const previous = previousState as RootState;
      return current.checkout !== previous.checkout || current.transaction !== previous.transaction;
    },
    effect: async (_action, api) => {
      api.cancelActiveListeners();
      await api.delay(SAVE_DEBOUNCE_MS);
      persistState(api.getState() as RootState);
    },
  });

  return listener;
}
