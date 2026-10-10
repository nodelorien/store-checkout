import { screen, waitFor, within } from '@testing-library/react';
import { delay as networkDelay, http, HttpResponse } from 'msw';
import { toSnapshot } from '@/app/persistence/snapshot';
import { save } from '@/app/persistence/storage';
import {
  API_URL,
  PRODUCT_ID,
  TRANSACTION_ID,
  VISA_NUMBER,
  buildCatalogue,
  buildPaymentConfig,
  buildProduct,
  buildTransaction,
} from '@/test/builders';
import {
  cardFields,
  completePaymentInfo,
  continueButton,
  deliveryFields,
  fillCard,
  fillDelivery,
  termsCheckbox,
} from '@/test/checkoutForm';
import { server } from '@/test/server';
import { currentPath, startApp, storedSnapshot } from '@/test/startApp';
import {
  IDEMPOTENCY_KEY,
  delivery,
  paymentInfoState,
  statusState,
  summaryState,
  tokenizedCard,
} from '@/test/states';

jest.mock('@/shared/lib/delay', () => jest.requireActual('@/test/delayMock'));

const STATUS_URL = `/transactions/${TRANSACTION_ID}`;

const lampCard = async () =>
  within(await screen.findByRole('article', { name: 'Aurora Desk Lamp' }));
const payWithCard = async () =>
  (await lampCard()).getByRole('button', { name: 'Pay with credit card' });
const checkoutDialog = () => screen.findByRole('dialog', { name: 'Checkout' });
const summarySheet = () => screen.findByRole('dialog', { name: 'Order summary' });
const payButton = async () => {
  const button = within(await summarySheet()).getByRole('button', { name: /^Pay/ });
  await waitFor(() => expect(button).toBeEnabled());
  return button;
};

interface PaymentAttempt {
  idempotencyKey: string | null;
  acceptanceToken: unknown;
}

/**
 * A small stateful fake of the API: every `/payment-config` read issues a new single-use
 * acceptance token, and each payment attempt gets the status queued for it.
 */
function fakeApi(statuses: Array<'APPROVED' | 'DECLINED' | 'PENDING'> = ['APPROVED']) {
  const attempts: PaymentAttempt[] = [];
  const transactions = new Map<string, ReturnType<typeof buildTransaction>>();
  let configReads = 0;
  let productReads = 0;
  let stock = 12;

  server.use(
    http.get(`${API_URL}/products`, () => {
      productReads += 1;
      return HttpResponse.json({
        data: buildCatalogue().map((product) =>
          product.id === PRODUCT_ID ? { ...product, stock } : product,
        ),
      });
    }),
    http.get(`${API_URL}/payment-config`, () => {
      configReads += 1;
      return HttpResponse.json({
        data: buildPaymentConfig({
          acceptance: {
            token: `acceptance-${configReads}`,
            permalink: 'https://gateway.test/terms.pdf',
          },
        }),
      });
    }),
    http.post(`${API_URL}/transactions`, async ({ request }) => {
      const body = (await request.json()) as { acceptanceToken: unknown };
      const idempotencyKey = request.headers.get('Idempotency-Key');
      attempts.push({ idempotencyKey, acceptanceToken: body.acceptanceToken });

      // Same key → the original transaction, as the contract promises.
      const existing = idempotencyKey ? transactions.get(idempotencyKey) : undefined;
      if (existing) return HttpResponse.json({ data: existing });

      const status = statuses[Math.min(transactions.size, statuses.length - 1)] ?? 'APPROVED';
      const transaction = buildTransaction({
        id: transactions.size === 0 ? TRANSACTION_ID : `${TRANSACTION_ID}-${transactions.size}`,
        status,
        statusMessage: status === 'DECLINED' ? 'Insufficient funds' : null,
      });
      if (status === 'APPROVED') stock -= 1;
      if (idempotencyKey) transactions.set(idempotencyKey, transaction);
      return HttpResponse.json({ data: transaction }, { status: 201 });
    }),
    http.get(`${API_URL}/transactions/:id`, ({ params }) => {
      const transaction = [...transactions.values()].find((item) => item.id === params.id);
      return HttpResponse.json({
        data: transaction ?? buildTransaction({ id: String(params.id) }),
      });
    }),
  );

  return { attempts, productReads: () => productReads };
}

describe('checkout journey', () => {
  it('AC-10: product page → modal → summary backdrop → approved → back with refreshed stock', async () => {
    const api = fakeApi(['APPROVED']);
    const { user } = startApp();

    // 1. Product page
    expect((await lampCard()).getByText('12 in stock')).toBeInTheDocument();

    // 2. Card and delivery info in a modal
    await user.click(await payWithCard());
    expect(await checkoutDialog()).toBeInTheDocument();
    await completePaymentInfo(user);

    // 3. Summary in a backdrop
    const sheet = await summarySheet();
    expect(screen.getByTestId('summary-backdrop')).toContainElement(sheet);
    expect(within(sheet).getByText('VISA •••• 4242')).toBeInTheDocument();
    await user.click(await payButton());

    // 4. Final status
    expect(await screen.findByRole('heading', { name: 'Payment approved' })).toBeInTheDocument();
    expect(currentPath()).toBe(STATUS_URL);
    expect(screen.getByText('TX-20261009-7K2M9QXA')).toBeInTheDocument();
    const readsBeforeReturning = api.productReads();

    // 5. Back to the product page with the stock refreshed
    await user.click(screen.getByRole('button', { name: 'Back to store' }));

    expect((await lampCard()).getByText('11 in stock')).toBeInTheDocument();
    expect(currentPath()).toBe('/');
    expect(api.productReads()).toBeGreaterThan(readsBeforeReturning);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() => expect(storedSnapshot()).toBeNull());
    expect(api.attempts).toHaveLength(1);
  });

  it('AC-11: declined → "Try again" returns to the card step and retries with a new acceptance token', async () => {
    const api = fakeApi(['DECLINED', 'APPROVED']);
    const { user } = startApp();

    await user.click(await payWithCard());
    await checkoutDialog();
    await completePaymentInfo(user);
    await user.click(await payButton());

    expect(await screen.findByRole('heading', { name: 'Payment declined' })).toBeInTheDocument();
    expect(screen.getByText('Insufficient funds. You have not been charged.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Try again' }));

    // Back on the card step: same product, delivery kept, card must be typed again.
    const dialog = await checkoutDialog();
    expect(within(dialog).getByText('Aurora Desk Lamp')).toBeInTheDocument();
    expect(cardFields.number()).toHaveValue('');
    expect(cardFields.cvc()).toHaveValue('');
    expect(deliveryFields.fullName()).toHaveValue('Ada Lovelace');
    expect(termsCheckbox()).toBeChecked();

    await fillCard(user);
    await user.click(continueButton());
    await user.click(await payButton());

    expect(await screen.findByRole('heading', { name: 'Payment approved' })).toBeInTheDocument();
    expect(api.attempts).toHaveLength(2);
    const [first, second] = api.attempts;
    expect(first?.acceptanceToken).toMatch(/^acceptance-\d+$/);
    expect(second?.acceptanceToken).toMatch(/^acceptance-\d+$/);
    expect(second?.acceptanceToken).not.toBe(first?.acceptanceToken);
    expect(second?.idempotencyKey).not.toBe(first?.idempotencyKey);
  });
});

describe('refresh recovery', () => {
  it('AC-1: with nothing persisted the product page is shown', async () => {
    const app = startApp();
    await lampCard();

    app.refresh();

    expect(await screen.findByRole('article', { name: 'Aurora Desk Lamp' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(currentPath()).toBe('/');
  });

  it('AC-2 AC-3: the payment-info step reopens with delivery data and empty card inputs', async () => {
    const app = startApp();
    await app.user.click(await payWithCard());
    await checkoutDialog();
    await app.user.click(screen.getByRole('button', { name: 'Increase quantity' }));
    await fillCard(app.user, { holder: 'Ada Holder Lovelace' });
    await fillDelivery(app.user);
    await app.user.click(termsCheckbox());

    const { store } = app.refresh();

    const dialog = await checkoutDialog();
    expect(within(dialog).getByText('Aurora Desk Lamp')).toBeInTheDocument();
    expect(within(dialog).getByRole('status', { name: 'Quantity: 2' })).toBeInTheDocument();
    expect(deliveryFields.fullName()).toHaveValue('Ada Lovelace');
    expect(deliveryFields.email()).toHaveValue('ada@example.com');
    expect(deliveryFields.addressLine1()).toHaveValue('Cra 7 # 71-21');
    expect(deliveryFields.postalCode()).toHaveValue('110231');
    expect(termsCheckbox()).toBeChecked();
    expect(cardFields.number()).toHaveValue('');
    expect(cardFields.holder()).toHaveValue('');
    expect(cardFields.expiry()).toHaveValue('');
    expect(cardFields.cvc()).toHaveValue('');

    const snapshot = storedSnapshot() ?? '';
    expect(snapshot).toContain('"step":"PAYMENT_INFO"');
    expect(snapshot).not.toContain(VISA_NUMBER);
    expect(snapshot).not.toContain('4242 4242');
    expect(snapshot).not.toContain('Ada Holder Lovelace');
    expect(snapshot).not.toContain('08/30');
    expect(snapshot).not.toMatch(/"(number|cvc|expiry|holder|exp_month|exp_year)"/);
    expect(JSON.stringify(store.getState())).not.toContain(VISA_NUMBER);
  });

  it('AC-4: the summary reopens with brand and last four when the token is still valid', async () => {
    const app = startApp();
    await app.user.click(await payWithCard());
    await checkoutDialog();
    await completePaymentInfo(app.user);
    await summarySheet();

    const { user, store } = app.refresh();

    const sheet = await summarySheet();
    expect(within(sheet).getByRole('img', { name: 'VISA' })).toBeInTheDocument();
    expect(within(sheet).getByText('VISA •••• 4242')).toBeInTheDocument();
    expect(within(sheet).getByText('Ada Lovelace')).toBeInTheDocument();
    expect(storedSnapshot()).not.toContain(VISA_NUMBER);
    expect(storedSnapshot()).not.toContain('acceptance');

    await user.click(await payButton());

    expect(await screen.findByRole('heading', { name: 'Payment approved' })).toBeInTheDocument();
    expect(store.getState().checkout.step).toBe('STATUS');
  });

  it('AC-5: an expired token sends the summary back to the card step with a notice', async () => {
    save(
      toSnapshot(summaryState({ card: { ...tokenizedCard, expiresAt: '2020-01-01T00:00:00Z' } })),
    );

    const { store } = startApp();

    const dialog = await checkoutDialog();
    expect(within(dialog).getByText('Please re-enter your card')).toBeInTheDocument();
    expect(cardFields.number()).toHaveValue('');
    expect(deliveryFields.fullName()).toHaveValue('Ada Lovelace');
    expect(screen.queryByRole('dialog', { name: 'Order summary' })).not.toBeInTheDocument();
    expect(store.getState().checkout).toMatchObject({ step: 'PAYMENT_INFO', card: null });
  });

  it('AC-5: a summary restored without any token also goes back to the card step', async () => {
    save(toSnapshot(summaryState({ card: null })));

    startApp();

    expect(within(await checkoutDialog()).getByText('Please re-enter your card')).toBeVisible();
  });

  it('AC-6: the status page is restored on its own URL', async () => {
    const app = startApp();
    await app.user.click(await payWithCard());
    await checkoutDialog();
    await completePaymentInfo(app.user);
    await app.user.click(await payButton());
    await screen.findByRole('heading', { name: 'Payment approved' });

    app.refresh();

    expect(await screen.findByRole('heading', { name: 'Payment approved' })).toBeInTheDocument();
    expect(currentPath()).toBe(STATUS_URL);
    expect(screen.getByText('Cra 7 # 71-21, Apto 501, Bogota, Cundinamarca')).toBeInTheDocument();
  });

  it('AC-6: reloading on the store while in the status step leads to the status page', async () => {
    save(toSnapshot(statusState()));

    startApp('/');

    expect(await screen.findByRole('heading', { name: 'Payment approved' })).toBeInTheDocument();
    expect(currentPath()).toBe(STATUS_URL);
  });

  it('AC-6: a pending transaction resumes polling after the reload and resolves', async () => {
    let reads = 0;
    server.use(
      http.get(`${API_URL}/transactions/:id`, () => {
        reads += 1;
        return HttpResponse.json({
          data: buildTransaction({ status: reads >= 3 ? 'APPROVED' : 'PENDING' }),
        });
      }),
    );
    save(toSnapshot(statusState({ status: 'PENDING' })));

    const { store } = startApp(STATUS_URL);

    expect(await screen.findByRole('heading', { name: 'Payment approved' })).toBeInTheDocument();
    expect(reads).toBe(3);
    expect(store.getState().transaction.status).toBe('APPROVED');
    await waitFor(() => expect(storedSnapshot()).toContain('"status":"APPROVED"'));
  });

  it.each([
    ['is sold out', [buildProduct({ stock: 0 })]],
    ['no longer exists', [buildProduct({ id: 'another-product', name: 'Another product' })]],
  ])('AC-7: resets to the products with a notice when the product %s', async (_label, products) => {
    server.use(http.get(`${API_URL}/products`, () => HttpResponse.json({ data: products })));
    save(toSnapshot(summaryState()));

    const { store } = startApp();

    expect(
      await screen.findByText('The product you selected is no longer available.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(store.getState().checkout).toMatchObject({ step: 'PRODUCTS', productId: null });
    await waitFor(() => expect(storedSnapshot()).toBeNull());
  });

  it('AC-8: paying again after a reload mid-payment reuses the idempotency key', async () => {
    const keys: Array<string | null> = [];
    server.use(
      http.post(`${API_URL}/transactions`, async ({ request }) => {
        keys.push(request.headers.get('Idempotency-Key'));
        // The first request is still in flight when the page is reloaded.
        if (keys.length === 1) await networkDelay(300);
        return HttpResponse.json(
          { data: buildTransaction() },
          { status: keys.length === 1 ? 201 : 200 },
        );
      }),
    );
    save(toSnapshot(summaryState()));
    const app = startApp();
    await app.user.click(await payButton());
    await waitFor(() => expect(keys).toHaveLength(1));

    const { user, store } = app.refresh();

    expect(store.getState().checkout).toMatchObject({
      step: 'SUMMARY',
      idempotencyKey: IDEMPOTENCY_KEY,
      submission: { status: 'idle' },
    });
    await user.click(await payButton());

    expect(await screen.findByRole('heading', { name: 'Payment approved' })).toBeInTheDocument();
    expect(keys).toEqual([IDEMPOTENCY_KEY, IDEMPOTENCY_KEY]);
  });

  it('AC-9: a restored quantity above the current stock is reduced to the stock', async () => {
    server.use(
      http.get(`${API_URL}/products`, () =>
        HttpResponse.json({ data: [buildProduct({ stock: 2 })] }),
      ),
    );
    save(toSnapshot(paymentInfoState({ quantity: 5, delivery })));

    const { store } = startApp();

    const dialog = await checkoutDialog();
    expect(within(dialog).getByRole('status', { name: 'Quantity: 2' })).toBeInTheDocument();
    expect(store.getState().checkout.quantity).toBe(2);
  });

  it('shows the overlay once the catalogue loads after a failed first attempt', async () => {
    server.use(http.get(`${API_URL}/products`, () => HttpResponse.error(), { once: true }));
    save(toSnapshot(paymentInfoState({ delivery })));

    const { user, store } = startApp();

    const alert = await screen.findByRole('alert');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(store.getState().checkout.step).toBe('PAYMENT_INFO');

    await user.click(within(alert).getByRole('button', { name: 'Retry' }));

    expect(await checkoutDialog()).toBeInTheDocument();
  });
});
