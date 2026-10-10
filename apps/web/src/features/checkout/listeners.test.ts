import { createAppStore } from '@/app/store';
import { PRODUCT_ID, buildCatalogue, buildProduct } from '@/test/builders';
import { seedProducts } from '@/test/seed';
import { checkoutState, paymentInfoState, statusState, summaryState } from '@/test/states';
import { paymentRetried, productSelected } from './checkoutSlice';
import { selectCheckoutGuard } from './listeners';
import { resumeCheckout } from './thunks';

describe('checkout guard', () => {
  it('waits for the catalogue before judging a restored checkout', () => {
    const store = createAppStore(summaryState());

    store.dispatch({ type: 'anything' });

    expect(selectCheckoutGuard(store.getState())).toBe('none');
    expect(store.getState().checkout.step).toBe('SUMMARY');
  });

  it('leaves a healthy checkout alone', async () => {
    const store = createAppStore(summaryState({ quantity: 2 }));

    await seedProducts(store);

    expect(store.getState().checkout).toMatchObject({ step: 'SUMMARY', quantity: 2 });
  });

  it.each([
    ['is missing from the catalogue', [buildProduct({ id: 'other' })]],
    ['is sold out', [buildProduct({ stock: 0 })]],
  ])('AC-7: resets with a notice when the product %s', async (_label, products) => {
    const store = createAppStore(paymentInfoState());

    await seedProducts(store, products);

    expect(store.getState().checkout).toMatchObject({
      step: 'PRODUCTS',
      productId: null,
      notice: 'The product you selected is no longer available.',
    });
  });

  it('AC-7: also applies when retrying a payment for a product that sold out meanwhile', async () => {
    const store = createAppStore(statusState({ status: 'DECLINED' }));
    await seedProducts(store, [buildProduct({ stock: 0 })]);
    expect(store.getState().checkout.step).toBe('STATUS');

    store.dispatch(paymentRetried({ productId: PRODUCT_ID }));

    expect(store.getState().checkout).toMatchObject({
      step: 'PRODUCTS',
      notice: 'The product you selected is no longer available.',
    });
  });

  it('AC-9: reduces a quantity above the stock to the stock', async () => {
    const store = createAppStore(paymentInfoState({ quantity: 7 }));

    await seedProducts(store, [buildProduct({ stock: 3 })]);

    expect(store.getState().checkout).toMatchObject({ step: 'PAYMENT_INFO', quantity: 3 });
  });

  it('does nothing outside the overlay steps', async () => {
    const store = createAppStore({ checkout: checkoutState({ productId: 'gone', quantity: 9 }) });

    await seedProducts(store, buildCatalogue());

    expect(store.getState().checkout).toMatchObject({ step: 'PRODUCTS', quantity: 9 });
  });

  it('accepts a product selected from the loaded catalogue', async () => {
    const store = createAppStore();
    await seedProducts(store);

    store.dispatch(productSelected(PRODUCT_ID));

    expect(store.getState().checkout).toMatchObject({ step: 'PAYMENT_INFO', notice: null });
  });
});

describe('resumeCheckout', () => {
  const NOW = Date.parse('2026-10-09T15:00:00.000Z');

  it('AC-4: keeps a summary whose token is still valid', () => {
    const store = createAppStore(summaryState());

    store.dispatch(resumeCheckout(NOW));

    expect(store.getState().checkout).toMatchObject({ step: 'SUMMARY', notice: null });
  });

  it.each([
    [
      'expired',
      {
        card: {
          tokenId: 't',
          brand: 'VISA' as const,
          lastFour: '4242',
          expiresAt: '2026-10-09T14:00:00.000Z',
        },
      },
    ],
    ['missing', { card: null }],
  ])('AC-5: sends a summary with an %s token back to the card step', (_label, overrides) => {
    const store = createAppStore(summaryState(overrides));

    store.dispatch(resumeCheckout(NOW));

    expect(store.getState().checkout).toMatchObject({
      step: 'PAYMENT_INFO',
      card: null,
      notice: 'Please re-enter your card',
    });
  });

  it.each([
    ['the products step', { checkout: checkoutState() }],
    ['the payment-info step', paymentInfoState()],
    ['the status step', statusState()],
  ])('leaves %s untouched', (_label, preloaded) => {
    const store = createAppStore(preloaded);
    const before = store.getState().checkout;

    store.dispatch(resumeCheckout());

    expect(store.getState().checkout).toBe(before);
  });
});
