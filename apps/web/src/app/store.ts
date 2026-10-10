import {
  configureStore,
  type Middleware,
  type ThunkAction,
  type ThunkDispatch,
  type UnknownAction,
} from '@reduxjs/toolkit';
import { baseApi } from '@/shared/api/baseApi';
import { createPersistenceMiddleware } from './persistence/persistenceMiddleware';
import { rootReducer, type RootState } from './rootReducer';

interface StoreOptions {
  /** Appended after the app's own middleware (used by tests to observe every action). */
  extraMiddleware?: Middleware[];
}

export function createAppStore(
  preloadedState?: Partial<RootState>,
  { extraMiddleware = [] }: StoreOptions = {},
) {
  return configureStore({
    reducer: rootReducer,
    preloadedState,
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware()
        .prepend(createPersistenceMiddleware().middleware)
        .concat(baseApi.middleware, ...extraMiddleware),
  });
}

export type AppStore = ReturnType<typeof createAppStore>;
export type AppDispatch = AppStore['dispatch'];
export type AppThunkDispatch = ThunkDispatch<RootState, undefined, UnknownAction>;
export type AppThunk<Result = void> = ThunkAction<Result, RootState, undefined, UnknownAction>;
export type { RootState };
