import { configureStore, type ThunkAction, type UnknownAction } from '@reduxjs/toolkit';
import { baseApi } from '@/shared/api/baseApi';
import { createPersistenceMiddleware } from './persistence/persistenceMiddleware';
import { rootReducer, type RootState } from './rootReducer';

export function createAppStore(preloadedState?: Partial<RootState>) {
  return configureStore({
    reducer: rootReducer,
    preloadedState,
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware()
        .prepend(createPersistenceMiddleware().middleware)
        .concat(baseApi.middleware),
  });
}

export type AppStore = ReturnType<typeof createAppStore>;
export type AppDispatch = AppStore['dispatch'];
export type AppThunk<Result = void> = ThunkAction<Result, RootState, unknown, UnknownAction>;
export type { RootState };
