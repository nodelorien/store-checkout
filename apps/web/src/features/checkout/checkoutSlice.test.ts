import { baseApi } from '@/shared/api/baseApi';
import { createUiError } from '@/shared/api/uiError';
import { PRODUCT_ID, buildTransaction } from '@/test/builders';
import { IDEMPOTENCY_KEY, checkoutState, delivery, tokenizedCard } from '@/test/states';
import {
  cardTokenExpired,
  checkoutDialogClosed,
  checkoutReducer,
  checkoutReset,
  deliveryDraftChanged,
  initialCheckoutState,
  noticeDismissed,
  paymentFailed,
  paymentInfoEditRequested,
  paymentInfoSubmitted,
  paymentRetried,
  productSelected,
  quantityChanged,
  termsAcceptanceChanged,
  tokenizationFailed,
  tokenizationStarted,
} from './checkoutSlice';

const summary = checkoutState({
  step: 'SUMMARY',
  productId: PRODUCT_ID,
  delivery,
  card: tokenizedCard,
  acceptedTerms: true,
  idempotencyKey: IDEMPOTENCY_KEY,
});

const paymentPending = { type: 'checkout/confirmPayment/pending' };

describe('checkoutSlice', () => {
  it('starts on the product page with nothing selected', () => {
    expect(checkoutReducer(undefined, { type: '@@init' })).toEqual(initialCheckoutState);
  });

  it('productSelected opens the payment-info step and keeps the delivery draft', () => {
    const state = checkoutReducer(
      checkoutState({ delivery, quantity: 3, notice: 'old', card: tokenizedCard }),
      productSelected(PRODUCT_ID),
    );

    expect(state).toMatchObject({
      step: 'PAYMENT_INFO',
      productId: PRODUCT_ID,
      quantity: 1,
      delivery,
      card: null,
      idempotencyKey: null,
      notice: null,
    });
  });

  it.each([
    [3, 3],
    [0, 1],
    [-4, 1],
    [99, 10],
    [2.9, 2],
    [Number.NaN, 1],
  ])('quantityChanged(%d) stores %d', (input, expected) => {
    expect(checkoutReducer(initialCheckoutState, quantityChanged(input)).quantity).toBe(expected);
  });

  it('stores the delivery draft and the terms acceptance', () => {
    let state = checkoutReducer(initialCheckoutState, deliveryDraftChanged(delivery));
    state = checkoutReducer(state, termsAcceptanceChanged(true));

    expect(state.delivery).toEqual(delivery);
    expect(state.acceptedTerms).toBe(true);
  });

  it('checkoutDialogClosed returns to the products keeping only the delivery draft', () => {
    const state = checkoutReducer(summary, checkoutDialogClosed());

    expect(state).toMatchObject({
      step: 'PRODUCTS',
      productId: null,
      card: null,
      idempotencyKey: null,
      delivery,
    });
  });

  it('tracks tokenization progress and failure', () => {
    const started = checkoutReducer(checkoutState({ notice: 'old' }), tokenizationStarted());
    expect(started.submission).toEqual({ status: 'tokenizing', error: null });
    expect(started.notice).toBeNull();

    const error = createUiError('CARD_REJECTED', 422);
    expect(checkoutReducer(started, tokenizationFailed(error)).submission).toEqual({
      status: 'failed',
      error,
    });
  });

  it('paymentInfoSubmitted moves to the summary with the token and a new idempotency key', () => {
    const state = checkoutReducer(
      checkoutState({ step: 'PAYMENT_INFO', productId: PRODUCT_ID }),
      paymentInfoSubmitted({ card: tokenizedCard, delivery, idempotencyKey: IDEMPOTENCY_KEY }),
    );

    expect(state).toMatchObject({
      step: 'SUMMARY',
      card: tokenizedCard,
      delivery,
      acceptedTerms: true,
      idempotencyKey: IDEMPOTENCY_KEY,
      submission: { status: 'idle', error: null },
    });
  });

  it('paymentInfoSubmitted reuses an idempotency key that may already have reached the API', () => {
    const state = checkoutReducer(
      checkoutState({ step: 'PAYMENT_INFO', productId: PRODUCT_ID, idempotencyKey: 'first-key' }),
      paymentInfoSubmitted({ card: tokenizedCard, delivery, idempotencyKey: 'second-key' }),
    );

    expect(state.idempotencyKey).toBe('first-key');
  });

  it('paymentInfoEditRequested goes back to the payment-info step keeping the key', () => {
    const failed = { ...summary, submission: { status: 'failed' as const, error: null } };
    const state = checkoutReducer(failed, paymentInfoEditRequested());

    expect(state).toMatchObject({
      step: 'PAYMENT_INFO',
      idempotencyKey: IDEMPOTENCY_KEY,
      submission: { status: 'idle' },
    });
  });

  it('cardTokenExpired drops the token and asks to re-enter the card', () => {
    const state = checkoutReducer(summary, cardTokenExpired());

    expect(state).toMatchObject({
      step: 'PAYMENT_INFO',
      card: null,
      notice: 'Please re-enter your card',
    });
  });

  it('tracks payment progress and failure', () => {
    const paying = checkoutReducer(summary, paymentPending);
    expect(paying.submission).toEqual({ status: 'paying', error: null });

    const error = createUiError('PAYMENT_GATEWAY_UNAVAILABLE', 502);
    const failed = checkoutReducer(paying, paymentFailed(error));
    expect(failed.submission).toEqual({ status: 'failed', error });
    expect(failed.step).toBe('SUMMARY');
  });

  it('moves to the status step when the transaction is created', () => {
    const paying = checkoutReducer(summary, paymentPending);
    const created = {
      type: `${baseApi.reducerPath}/executeMutation/fulfilled`,
      payload: buildTransaction(),
      meta: {
        requestId: 'r1',
        requestStatus: 'fulfilled',
        arg: { endpointName: 'createTransaction', type: 'mutation' },
      },
    };
    expect(baseApi.endpoints.createTransaction.matchFulfilled(created)).toBe(true);

    const state = checkoutReducer(paying, created);

    expect(state.step).toBe('STATUS');
    expect(state.submission.status).toBe('idle');
  });

  it('paymentRetried restarts the payment-info step with a fresh key for the same product', () => {
    const status = { ...summary, step: 'STATUS' as const };
    const state = checkoutReducer(status, paymentRetried({ productId: PRODUCT_ID }));

    expect(state).toMatchObject({
      step: 'PAYMENT_INFO',
      productId: PRODUCT_ID,
      card: null,
      idempotencyKey: null,
      delivery,
    });
  });

  it('noticeDismissed clears the notice', () => {
    expect(checkoutReducer(checkoutState({ notice: 'Hi' }), noticeDismissed()).notice).toBeNull();
  });

  it('checkoutReset clears everything, optionally leaving a notice', () => {
    expect(checkoutReducer(summary, checkoutReset())).toEqual(initialCheckoutState);
    expect(checkoutReducer(summary, checkoutReset({ notice: 'Sold out' }))).toEqual({
      ...initialCheckoutState,
      notice: 'Sold out',
    });
  });
});
