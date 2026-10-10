import type { AppThunk, AppThunkDispatch } from '@/app/store';
import { baseApi } from '@/shared/api/baseApi';
import type { PaymentConfig } from '@/shared/api/types';
import { createUiError } from '@/shared/api/uiError';
import { tokenizeCard } from '@/shared/gateway/tokenizeCard';
import type { CardInput } from '@/shared/gateway/types';
import { createUuid } from '@/shared/lib/uuid';
import {
  paymentInfoSubmitted,
  tokenizationFailed,
  tokenizationStarted,
  type DeliveryInfo,
} from './checkoutSlice';
import { selectIsTokenizing } from './selectors';

/** Reads `/payment-config`, from the cache unless a fresh copy is required. */
export async function loadPaymentConfig(
  dispatch: AppThunkDispatch,
  { fresh = false } = {},
): Promise<PaymentConfig | null> {
  const request = dispatch(
    baseApi.endpoints.getPaymentConfig.initiate(undefined, { forceRefetch: fresh }),
  );
  try {
    return await request.unwrap();
  } catch {
    return null;
  } finally {
    request.unsubscribe();
  }
}

/**
 * Step 2 → 3. Tokenizes the card with the gateway and keeps only the token.
 *
 * Deliberately a hand-written thunk and not `createAsyncThunk`: that helper copies its argument
 * into `meta.arg` of every lifecycle action, which would put the card number and CVC in Redux
 * actions (and DevTools). Here the card only exists as a function argument.
 */
export const submitPaymentInfo =
  (card: CardInput, delivery: DeliveryInfo): AppThunk<Promise<boolean>> =>
  async (dispatch, getState) => {
    if (selectIsTokenizing(getState())) return false;
    dispatch(tokenizationStarted());

    const config = await loadPaymentConfig(dispatch);
    if (!config) {
      dispatch(tokenizationFailed(createUiError('PAYMENT_CONFIG_UNAVAILABLE')));
      return false;
    }

    const result = await tokenizeCard(
      { tokenizationUrl: config.tokenizationUrl, publicKey: config.publicKey },
      card,
    );
    if (!result.ok) {
      dispatch(tokenizationFailed(result.error));
      return false;
    }

    dispatch(paymentInfoSubmitted({ card: result.token, delivery, idempotencyKey: createUuid() }));
    return true;
  };
