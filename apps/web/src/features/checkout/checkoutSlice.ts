import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { baseApi } from '@/shared/api/baseApi';
import type { CardBrand } from '@/shared/api/types';
import type { UiError } from '@/shared/api/uiError';

export const CHECKOUT_STEPS = ['PRODUCTS', 'PAYMENT_INFO', 'SUMMARY', 'STATUS'] as const;
export type CheckoutStep = (typeof CHECKOUT_STEPS)[number];

export const MAX_QUANTITY_PER_ORDER = 10;

export interface DeliveryInfo {
  fullName: string;
  email: string;
  phone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  region: string;
  postalCode: string;
}

/** What is kept of a card: the gateway token and display data. Never the card itself. */
export interface TokenizedCard {
  tokenId: string;
  brand: CardBrand;
  lastFour: string;
  expiresAt: string;
}

export interface CheckoutState {
  step: CheckoutStep;
  productId: string | null;
  quantity: number;
  delivery: DeliveryInfo | null;
  card: TokenizedCard | null;
  acceptedTerms: boolean;
  idempotencyKey: string | null;
  submission: { status: 'idle' | 'tokenizing' | 'paying' | 'failed'; error: UiError | null };
  notice: string | null;
}

export const NOTICES = {
  reenterCard: 'Please re-enter your card',
  productUnavailable: 'The product you selected is no longer available.',
  soldOut: 'Sorry, this product just sold out.',
} as const;

export const initialCheckoutState: CheckoutState = {
  step: 'PRODUCTS',
  productId: null,
  quantity: 1,
  delivery: null,
  card: null,
  acceptedTerms: false,
  idempotencyKey: null,
  submission: { status: 'idle', error: null },
  notice: null,
};

const idleSubmission = (): CheckoutState['submission'] => ({ status: 'idle', error: null });

function clampQuantity(quantity: number): number {
  if (!Number.isFinite(quantity)) return 1;
  return Math.min(MAX_QUANTITY_PER_ORDER, Math.max(1, Math.trunc(quantity)));
}

/** Starts the payment-info step for a product; the delivery draft is kept, the payment is not. */
function startPaymentInfo(state: CheckoutState, productId: string) {
  state.step = 'PAYMENT_INFO';
  state.productId = productId;
  state.card = null;
  state.idempotencyKey = null;
  state.submission = idleSubmission();
}

const checkoutSlice = createSlice({
  name: 'checkout',
  initialState: initialCheckoutState,
  reducers: {
    productSelected(state, action: PayloadAction<string>) {
      startPaymentInfo(state, action.payload);
      state.quantity = 1;
      state.notice = null;
    },
    quantityChanged(state, action: PayloadAction<number>) {
      state.quantity = clampQuantity(action.payload);
    },
    deliveryDraftChanged(state, action: PayloadAction<DeliveryInfo>) {
      state.delivery = action.payload;
    },
    termsAcceptanceChanged(state, action: PayloadAction<boolean>) {
      state.acceptedTerms = action.payload;
    },
    checkoutDialogClosed(state) {
      state.step = 'PRODUCTS';
      state.productId = null;
      state.quantity = 1;
      state.card = null;
      state.idempotencyKey = null;
      state.submission = idleSubmission();
      state.notice = null;
    },
    tokenizationStarted(state) {
      state.submission = { status: 'tokenizing', error: null };
      state.notice = null;
    },
    tokenizationFailed(state, action: PayloadAction<UiError>) {
      state.submission = { status: 'failed', error: action.payload };
    },
    paymentInfoSubmitted(
      state,
      action: PayloadAction<{
        card: TokenizedCard;
        delivery: DeliveryInfo;
        idempotencyKey: string;
      }>,
    ) {
      state.step = 'SUMMARY';
      state.card = action.payload.card;
      state.delivery = action.payload.delivery;
      state.acceptedTerms = true;
      // A key that may already have reached the API is reused so a retry can never charge twice.
      state.idempotencyKey ??= action.payload.idempotencyKey;
      state.submission = idleSubmission();
      state.notice = null;
    },
    paymentInfoEditRequested(state) {
      state.step = 'PAYMENT_INFO';
      state.submission = idleSubmission();
    },
    cardTokenExpired(state) {
      state.step = 'PAYMENT_INFO';
      state.card = null;
      state.submission = idleSubmission();
      state.notice = NOTICES.reenterCard;
    },
    paymentStarted(state) {
      state.submission = { status: 'paying', error: null };
    },
    paymentFailed(state, action: PayloadAction<UiError>) {
      state.submission = { status: 'failed', error: action.payload };
    },
    paymentRetried(state, action: PayloadAction<{ productId: string }>) {
      startPaymentInfo(state, action.payload.productId);
      state.quantity = clampQuantity(state.quantity);
      state.notice = null;
    },
    noticeDismissed(state) {
      state.notice = null;
    },
    checkoutReset(_state, action: PayloadAction<{ notice?: string } | undefined>) {
      return { ...initialCheckoutState, notice: action.payload?.notice ?? null };
    },
  },
  extraReducers: (builder) => {
    builder.addMatcher(baseApi.endpoints.createTransaction.matchFulfilled, (state) => {
      state.step = 'STATUS';
      state.submission = idleSubmission();
      state.notice = null;
    });
  },
});

export const checkoutReducer = checkoutSlice.reducer;
export const {
  productSelected,
  quantityChanged,
  deliveryDraftChanged,
  termsAcceptanceChanged,
  checkoutDialogClosed,
  tokenizationStarted,
  tokenizationFailed,
  paymentInfoSubmitted,
  paymentInfoEditRequested,
  cardTokenExpired,
  paymentStarted,
  paymentFailed,
  paymentRetried,
  noticeDismissed,
  checkoutReset,
} = checkoutSlice.actions;
