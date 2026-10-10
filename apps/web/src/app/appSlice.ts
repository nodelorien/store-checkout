import { createSlice } from '@reduxjs/toolkit';

export interface AppState {
  storeName: string;
}

const initialState: AppState = { storeName: 'Lumen Store' };

const appSlice = createSlice({
  name: 'app',
  initialState,
  reducers: {},
  selectors: {
    selectStoreName: (state) => state.storeName,
  },
});

export const appReducer = appSlice.reducer;
export const { selectStoreName } = appSlice.selectors;
