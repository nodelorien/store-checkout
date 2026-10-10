import { createSelector } from '@reduxjs/toolkit';
import type { RootState } from '@/app/store';
import { baseApi } from '@/shared/api/baseApi';
import type { OrderAmounts } from '@/shared/api/types';
import { INSTALLMENT_OPTIONS, MAX_QUANTITY_PER_ORDER } from './checkoutSlice';

const selectProductsResult = baseApi.endpoints.getProducts.select();
const selectPaymentConfigResult = baseApi.endpoints.getPaymentConfig.select();

export const selectCheckout = (state: RootState) => state.checkout;
export const selectCheckoutStep = (state: RootState) => state.checkout.step;
export const selectQuantity = (state: RootState) => state.checkout.quantity;
export const selectInstallments = (state: RootState) => state.checkout.installments;
export const selectDelivery = (state: RootState) => state.checkout.delivery;
export const selectTokenizedCard = (state: RootState) => state.checkout.card;
export const selectAcceptedTerms = (state: RootState) => state.checkout.acceptedTerms;
export const selectSubmission = (state: RootState) => state.checkout.submission;
export const selectNotice = (state: RootState) => state.checkout.notice;

export const selectIsTokenizing = (state: RootState) =>
  state.checkout.submission.status === 'tokenizing';
export const selectIsPaying = (state: RootState) => state.checkout.submission.status === 'paying';

/** The notice belongs to the dialog while it is open and to the page otherwise. */
export const selectPageNotice = (state: RootState) =>
  state.checkout.step === 'PAYMENT_INFO' ? null : state.checkout.notice;
export const selectDialogNotice = (state: RootState) =>
  state.checkout.step === 'PAYMENT_INFO' ? state.checkout.notice : null;

export const selectProducts = (state: RootState) => selectProductsResult(state).data;
export const selectPaymentConfig = (state: RootState) => selectPaymentConfigResult(state).data;

/** Joins `productId` with the products cache. `null` until the catalogue has loaded. */
export const selectSelectedProduct = createSelector(
  [selectProducts, (state: RootState) => state.checkout.productId],
  (products, productId) => products?.find((product) => product.id === productId) ?? null,
);

export const selectMaxQuantity = createSelector([selectSelectedProduct], (product) =>
  Math.max(0, Math.min(product?.stock ?? 0, MAX_QUANTITY_PER_ORDER)),
);

/**
 * Amounts shown before paying: product price and the fees of the payment config. The API
 * recomputes them when charging; after payment the transaction's own amounts are shown.
 */
export const selectOrderAmounts = createSelector(
  [selectSelectedProduct, selectQuantity, selectPaymentConfig],
  (product, quantity, config): OrderAmounts | null => {
    if (!product || !config) return null;

    const subtotalInCents = product.priceInCents * quantity;
    return {
      subtotalInCents,
      baseFeeInCents: config.baseFeeInCents,
      deliveryFeeInCents: config.deliveryFeeInCents,
      totalInCents: subtotalInCents + config.baseFeeInCents + config.deliveryFeeInCents,
    };
  },
);

export interface InstallmentPlan {
  installments: number;
  /** Total divided by the number of instalments, rounded up to the peso. Before bank interest. */
  perInstallmentInCents: number;
}

/** One plan per offered option, for the total about to be charged. Empty until it is known. */
export const selectInstallmentPlans = createSelector([selectOrderAmounts], (amounts) =>
  amounts
    ? INSTALLMENT_OPTIONS.map((installments): InstallmentPlan => ({
        installments,
        perInstallmentInCents: Math.ceil(amounts.totalInCents / installments / 100) * 100,
      }))
    : [],
);

/** `now` is injected (epoch ms) so the rule is testable and the selector stays pure. */
export const selectIsCardTokenValid = (state: RootState, now: number): boolean => {
  const card = state.checkout.card;
  if (!card) return false;

  const expiresAt = Date.parse(card.expiresAt);
  return Number.isFinite(expiresAt) && expiresAt > now;
};

/** Everything needed to charge is present and consistent (regardless of a payment in flight). */
export const selectIsOrderPayable = (state: RootState, now: number): boolean => {
  const { step, delivery, acceptedTerms, idempotencyKey, quantity } = state.checkout;
  const maxQuantity = selectMaxQuantity(state);

  return (
    step === 'SUMMARY' &&
    delivery !== null &&
    acceptedTerms &&
    idempotencyKey !== null &&
    selectOrderAmounts(state) !== null &&
    quantity >= 1 &&
    quantity <= maxQuantity &&
    selectIsCardTokenValid(state, now)
  );
};

export const selectCanPay = (state: RootState, now: number): boolean =>
  !selectIsPaying(state) && selectIsOrderPayable(state, now);
