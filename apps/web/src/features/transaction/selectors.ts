import type { RootState } from '@/app/store';

export const selectFlowTransactionId = (state: RootState) => state.transaction.id;
export const selectPolling = (state: RootState) => state.transaction.polling;
