import { createAppStore } from '@/app/store';
import { PRODUCT_ID, buildCatalogue, buildProduct } from '@/test/builders';
import { seedPaymentConfig, seedProducts } from '@/test/seed';
import { paymentInfoState, summaryState, tokenizedCard } from '@/test/states';
import {
  selectCanPay,
  selectDialogNotice,
  selectIsCardTokenValid,
  selectIsOrderPayable,
  selectIsPaying,
  selectIsTokenizing,
  selectMaxQuantity,
  selectOrderAmounts,
  selectPageNotice,
  selectSelectedProduct,
} from './selectors';

const NOW = Date.parse('2026-10-09T15:00:00.000Z');

async function storeWith(
  preloaded: Parameters<typeof createAppStore>[0],
  { products = buildCatalogue(), config = true } = {},
) {
  const store = createAppStore(preloaded);
  await seedProducts(store, products);
  if (config) await seedPaymentConfig(store);
  return store;
}

describe('checkout selectors', () => {
  it('selectSelectedProduct joins the product id with the products cache', async () => {
    const store = await storeWith(paymentInfoState());

    expect(selectSelectedProduct(store.getState())).toMatchObject({
      id: PRODUCT_ID,
      name: 'Aurora Desk Lamp',
    });
  });

  it('selectSelectedProduct is null before the catalogue loads or when the product is gone', async () => {
    expect(selectSelectedProduct(createAppStore(paymentInfoState()).getState())).toBeNull();

    const store = await storeWith(paymentInfoState({ productId: 'missing' }));
    expect(selectSelectedProduct(store.getState())).toBeNull();
  });

  it.each([
    [12, 10],
    [5, 5],
    [1, 1],
    [0, 0],
  ])('selectMaxQuantity with stock %d is %d', async (stock, expected) => {
    const store = await storeWith(paymentInfoState(), { products: [buildProduct({ stock })] });

    expect(selectMaxQuantity(store.getState())).toBe(expected);
  });

  it('AC-1: selectOrderAmounts adds subtotal, base fee and delivery fee', async () => {
    const store = await storeWith(summaryState());

    expect(selectOrderAmounts(store.getState())).toEqual({
      subtotalInCents: 12990000,
      baseFeeInCents: 250000,
      deliveryFeeInCents: 800000,
      totalInCents: 14040000,
    });
  });

  it('AC-1: selectOrderAmounts multiplies the price by the quantity', async () => {
    const store = await storeWith(summaryState({ quantity: 3 }));

    expect(selectOrderAmounts(store.getState())).toMatchObject({
      subtotalInCents: 38970000,
      totalInCents: 40020000,
    });
  });

  it('selectOrderAmounts is null until product and fees are known', async () => {
    const store = await storeWith(summaryState(), { config: false });

    expect(selectOrderAmounts(store.getState())).toBeNull();
  });

  it.each([
    ['a future expiry', '2026-10-09T15:00:00.001Z', true],
    ['the exact instant', '2026-10-09T15:00:00.000Z', false],
    ['a past expiry', '2026-10-09T14:59:59.000Z', false],
    ['an unparseable expiry', 'soon', false],
  ])('selectIsCardTokenValid with %s', (_label, expiresAt, expected) => {
    const state = createAppStore(
      summaryState({ card: { ...tokenizedCard, expiresAt } }),
    ).getState();

    expect(selectIsCardTokenValid(state, NOW)).toBe(expected);
  });

  it('selectIsCardTokenValid is false without a token', () => {
    const state = createAppStore(summaryState({ card: null })).getState();

    expect(selectIsCardTokenValid(state, NOW)).toBe(false);
  });

  it('selectCanPay is true for a complete summary', async () => {
    const store = await storeWith(summaryState());

    expect(selectCanPay(store.getState(), NOW)).toBe(true);
  });

  it.each([
    ['paying already', summaryState({ submission: { status: 'paying', error: null } })],
    ['another step', summaryState({ step: 'PAYMENT_INFO' })],
    ['no delivery', summaryState({ delivery: null })],
    ['terms not accepted', summaryState({ acceptedTerms: false })],
    ['no idempotency key', summaryState({ idempotencyKey: null })],
    ['an expired token', summaryState({ card: { ...tokenizedCard, expiresAt: '2020-01-01' } })],
  ])('selectCanPay is false with %s', async (_label, preloaded) => {
    const store = await storeWith(preloaded, {
      products: [...buildCatalogue(), buildProduct({ id: 'grinder', stock: 1 })],
    });

    expect(selectCanPay(store.getState(), NOW)).toBe(false);
  });

  it('selectCanPay is false while fees are unknown', async () => {
    const store = await storeWith(summaryState(), { config: false });

    expect(selectCanPay(store.getState(), NOW)).toBe(false);
  });

  it('routes the notice to the dialog while it is open and to the page otherwise', () => {
    const inDialog = createAppStore(paymentInfoState({ notice: 'Hello' })).getState();
    const onPage = createAppStore(
      paymentInfoState({ step: 'PRODUCTS', productId: null, notice: 'Hello' }),
    ).getState();

    expect(selectDialogNotice(inDialog)).toBe('Hello');
    expect(selectPageNotice(inDialog)).toBeNull();
    expect(selectDialogNotice(onPage)).toBeNull();
    expect(selectPageNotice(onPage)).toBe('Hello');
  });

  it('exposes the submission progress flags', () => {
    const tokenizing = createAppStore(
      paymentInfoState({ submission: { status: 'tokenizing', error: null } }),
    ).getState();
    const paying = createAppStore(
      summaryState({ submission: { status: 'paying', error: null } }),
    ).getState();

    expect(selectIsTokenizing(tokenizing)).toBe(true);
    expect(selectIsPaying(tokenizing)).toBe(false);
    expect(selectIsPaying(paying)).toBe(true);
  });

  it('selectIsOrderPayable is false when the quantity exceeds the stock', async () => {
    const store = await storeWith(summaryState(), { products: [buildProduct({ stock: 1 })] });
    const state = store.getState();
    // Built by hand: in a running store the checkout listener would correct the quantity first.
    const overStock = { ...state, checkout: { ...state.checkout, quantity: 2 } };

    expect(selectIsOrderPayable(state, NOW)).toBe(true);
    expect(selectIsOrderPayable(overStock, NOW)).toBe(false);
    expect(selectCanPay(overStock, NOW)).toBe(false);
  });
});
