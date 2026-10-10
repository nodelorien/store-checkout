import type { AppThunk, AppThunkDispatch } from '@/app/store';
import { baseApi } from '@/shared/api/baseApi';
import type { PaymentConfig } from '@/shared/api/types';
import { createUiError } from '@/shared/api/uiError';
import { tokenizeCard } from '@/shared/gateway/tokenizeCard';
import type { CardInput } from '@/shared/gateway/types';
import { createUuid } from '@/shared/lib/uuid';
import {
  cardTokenExpired,
  paymentInfoSubmitted,
  tokenizationFailed,
  tokenizationStarted,
  type DeliveryInfo,
} from './checkoutSlice';
import { selectIsCardTokenValid, selectIsTokenizing } from './selectors';

/**
 * Runs once at start-up, after the store was preloaded from the persisted snapshot, to make the
 * restored step safe to show. The steps themselves need no work here: the overlays follow
 * `checkout.step`, the status route follows the transaction id, and the card form starts empty
 * because card data is never persisted. What can have gone stale while the page was closed is the
 * gateway token: a summary without a usable token goes back to the payment-info step.
 * (Product availability is checked by the checkout listener once the catalogue has loaded.)
 */
export const resumeCheckout =
  (now: number = Date.now()): AppThunk =>
  (dispatch, getState) => {
    const state = getState();
    if (state.checkout.step === 'SUMMARY' && !selectIsCardTokenValid(state, now)) {
      dispatch(cardTokenExpired());
    }
  };

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
