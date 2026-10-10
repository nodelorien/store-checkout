import { createAsyncThunk } from '@reduxjs/toolkit';
import type { AppThunkDispatch, RootState } from '@/app/store';
import { baseApi } from '@/shared/api/baseApi';
import type { CreateTransactionBody, PaymentConfig, Transaction } from '@/shared/api/types';
import { createUiError, isUiError, type UiError } from '@/shared/api/uiError';
import {
  CONFIRM_PAYMENT_TYPE,
  NOTICES,
  cardTokenExpired,
  checkoutReset,
  paymentFailed,
  type CheckoutState,
} from './checkoutSlice';
import { selectIsCardTokenValid, selectIsOrderPayable, selectIsPaying } from './selectors';
import { loadPaymentConfig } from './thunks';

type ReadyCheckout = CheckoutState & {
  productId: string;
  delivery: NonNullable<CheckoutState['delivery']>;
  card: NonNullable<CheckoutState['card']>;
  idempotencyKey: string;
};

function isReady(checkout: CheckoutState): checkout is ReadyCheckout {
  return Boolean(
    checkout.productId && checkout.delivery && checkout.card && checkout.idempotencyKey,
  );
}

/** Body of `POST /transactions`. Prices and fees are never sent: the API computes them. */
export function buildTransactionBody(
  checkout: ReadyCheckout,
  config: PaymentConfig,
): CreateTransactionBody {
  const { delivery, card } = checkout;

  return {
    productId: checkout.productId,
    quantity: checkout.quantity,
    cardToken: card.tokenId,
    cardBrand: card.brand,
    cardLastFour: card.lastFour,
    installments: checkout.installments,
    acceptanceToken: config.acceptance.token,
    customer: { fullName: delivery.fullName, email: delivery.email, phone: delivery.phone },
    delivery: {
      addressLine1: delivery.addressLine1,
      ...(delivery.addressLine2 ? { addressLine2: delivery.addressLine2 } : {}),
      city: delivery.city,
      region: delivery.region,
      country: 'CO',
      ...(delivery.postalCode ? { postalCode: delivery.postalCode } : {}),
    },
  };
}

/**
 * Step 3 → 4. Creates the transaction (the API charges the card) with the persisted idempotency
 * key, so pressing twice, retrying or refreshing mid-request can never charge twice.
 */
export const confirmPayment = createAsyncThunk<
  Transaction,
  void,
  { state: RootState; dispatch: AppThunkDispatch; rejectValue: UiError }
>(
  CONFIRM_PAYMENT_TYPE,
  async (_, { dispatch, getState, rejectWithValue }) => {
    const fail = (error: UiError) => {
      dispatch(paymentFailed(error));
      return rejectWithValue(error);
    };

    const state = getState();
    const now = Date.now();
    if (state.checkout.card && !selectIsCardTokenValid(state, now)) {
      dispatch(cardTokenExpired());
      return rejectWithValue(createUiError('CARD_TOKEN_EXPIRED'));
    }
    const checkout = state.checkout;
    if (!selectIsOrderPayable(state, now) || !isReady(checkout)) {
      return fail(createUiError('CHECKOUT_INCOMPLETE'));
    }

    // The acceptance token is single-use: never pay with a cached configuration.
    const config = await loadPaymentConfig(dispatch, { fresh: true });
    if (!config) return fail(createUiError('PAYMENT_CONFIG_UNAVAILABLE'));

    try {
      return await dispatch(
        baseApi.endpoints.createTransaction.initiate({
          body: buildTransactionBody(checkout, config),
          idempotencyKey: checkout.idempotencyKey,
        }),
      ).unwrap();
    } catch (error) {
      const uiError = isUiError(error) ? error : createUiError('UNEXPECTED_ERROR');
      if (uiError.code === 'OUT_OF_STOCK') {
        dispatch(checkoutReset({ notice: NOTICES.soldOut }));
        return rejectWithValue(uiError);
      }
      return fail(uiError);
    }
  },
  { condition: (_, { getState }) => !selectIsPaying(getState()) },
);
