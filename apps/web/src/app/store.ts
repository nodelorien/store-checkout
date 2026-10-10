import { configureStore } from '@reduxjs/toolkit';
import { rootReducer, type RootState } from './rootReducer';

export function createAppStore(preloadedState?: Partial<RootState>) {
  return configureStore({ reducer: rootReducer, preloadedState });
}

export type AppStore = ReturnType<typeof createAppStore>;
export type AppDispatch = AppStore['dispatch'];
export type { RootState };
