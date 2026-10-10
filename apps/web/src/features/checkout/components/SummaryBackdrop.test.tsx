import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import { createAppStore } from '@/app/store';
import { baseApi } from '@/shared/api/baseApi';
import {
  API_URL,
  buildCatalogue,
  buildPaymentConfig,
  buildProduct,
  buildTransaction,
  errorEnvelope,
} from '@/test/builders';
import { renderWithProviders } from '@/test/renderWithProviders';
import { seedProducts } from '@/test/seed';
import { server } from '@/test/server';
import { IDEMPOTENCY_KEY, summaryState, tokenizedCard } from '@/test/states';
import { CheckoutFlow } from './CheckoutFlow';

async function renderSummary(overrides = {}, products = buildCatalogue()) {
  server.use(http.get(`${API_URL}/products`, () => HttpResponse.json({ data: products })));
  const store = createAppStore(summaryState(overrides));
  // A live subscription, as the product page underneath has: the catalogue survives invalidation.
  await store.dispatch(baseApi.endpoints.getProducts.initiate());
  const user = userEvent.setup({ delay: null });
  renderWithProviders(<CheckoutFlow />, { store });
  const sheet = await screen.findByRole('dialog', { name: 'Order summary' });
  return { store, user, sheet };
}

const row = (sheet: HTMLElement, label: string | RegExp) =>
  within(sheet).getByText(label).parentElement as HTMLElement;
const payButton = () => screen.getByRole('button', { name: /^Pay/ });

describe('SummaryBackdrop', () => {
  it('AC-1: shows subtotal, base fee, delivery fee and their total', async () => {
    const { sheet } = await renderSummary();

    expect(row(sheet, 'Aurora Desk Lamp × 1')).toHaveTextContent(/\$\s129\.900$/);
    await waitFor(() => expect(row(sheet, 'Base fee')).toHaveTextContent(/\$\s2\.500$/));
    expect(row(sheet, 'Delivery fee')).toHaveTextContent(/\$\s8\.000$/);
    expect(row(sheet, 'Total')).toHaveTextContent(/\$\s140\.400$/);
    expect(payButton()).toHaveAccessibleName(/^Pay\s\$\s140\.400$/);
  });

  it('AC-1: the total follows the quantity', async () => {
    const { sheet } = await renderSummary({ quantity: 3 });

    expect(row(sheet, 'Aurora Desk Lamp × 3')).toHaveTextContent(/\$\s389\.700$/);
    await waitFor(() => expect(row(sheet, 'Total')).toHaveTextContent(/\$\s400\.200$/));
  });

  it('AC-2: is a labelled modal dialog rendered inside a Material Backdrop', async () => {
    const { sheet } = await renderSummary();
    const backdrop = screen.getByTestId('summary-backdrop');

    expect(backdrop).toHaveClass('MuiBackdrop-root');
    expect(backdrop).toContainElement(sheet);
    expect(sheet).toHaveAttribute('aria-modal', 'true');
    expect(within(sheet).getByRole('heading', { name: 'Order summary' })).toBeInTheDocument();
  });

  it('AC-3: shows the card brand with the last four and the delivery address', async () => {
    const { sheet } = await renderSummary({
      card: { ...tokenizedCard, brand: 'MASTERCARD', lastFour: '4444' },
    });

    expect(within(sheet).getByRole('img', { name: 'MasterCard' })).toBeInTheDocument();
    expect(within(sheet).getByText('MasterCard •••• 4444')).toBeInTheDocument();
    expect(within(sheet).getByText('Ada Lovelace')).toBeInTheDocument();
    expect(
      within(sheet).getByText('Cra 7 # 71-21, Apto 501, Bogota, Cundinamarca'),
    ).toBeInTheDocument();
  });

  it('AC-4: paying posts the transaction and moves to the status step', async () => {
    let key: string | null = null;
    server.use(
      http.post(`${API_URL}/transactions`, ({ request }) => {
        key = request.headers.get('Idempotency-Key');
        return HttpResponse.json({ data: buildTransaction() }, { status: 201 });
      }),
    );
    const { user, store } = await renderSummary();
    await waitFor(() => expect(payButton()).toBeEnabled());

    await user.click(payButton());

    await waitFor(() => expect(store.getState().checkout.step).toBe('STATUS'));
    expect(key).toBe(IDEMPOTENCY_KEY);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('AC-5: disables the actions while paying and cannot be dismissed', async () => {
    let requests = 0;
    server.use(
      http.post(`${API_URL}/transactions`, async () => {
        requests += 1;
        await delay(120);
        return HttpResponse.json({ data: buildTransaction() }, { status: 201 });
      }),
    );
    const { user, store } = await renderSummary();
    await waitFor(() => expect(payButton()).toBeEnabled());

    await user.click(payButton());

    const processing = await screen.findByRole('button', { name: /Processing payment/ });
    expect(processing).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Edit details' })).toBeDisabled();
    await user.keyboard('{Escape}');
    await user.click(screen.getByTestId('summary-backdrop'));
    expect(store.getState().checkout.step).toBe('SUMMARY');

    await waitFor(() => expect(store.getState().checkout.step).toBe('STATUS'));
    expect(requests).toBe(1);
  });

  it('AC-6: an API error shows an alert and keeps the user on the summary', async () => {
    server.use(
      http.post(
        `${API_URL}/transactions`,
        () => HttpResponse.json(errorEnvelope('PAYMENT_GATEWAY_UNAVAILABLE'), { status: 502 }),
        { once: true },
      ),
    );
    const { user, store, sheet } = await renderSummary();
    await waitFor(() => expect(payButton()).toBeEnabled());

    await user.click(payButton());

    const alert = await within(sheet).findByRole('alert');
    expect(alert).toHaveTextContent(
      'The payment service is temporarily unavailable. Please try again in a moment.',
    );
    expect(store.getState().checkout.step).toBe('SUMMARY');
    expect(screen.getByRole('dialog', { name: 'Order summary' })).toBeInTheDocument();

    await waitFor(() => expect(payButton()).toBeEnabled());
    await user.click(payButton());

    await waitFor(() => expect(store.getState().checkout.step).toBe('STATUS'));
  });

  it('AC-7: OUT_OF_STOCK closes the summary and returns to the products', async () => {
    server.use(
      http.post(`${API_URL}/transactions`, () =>
        HttpResponse.json(errorEnvelope('OUT_OF_STOCK'), { status: 409 }),
      ),
    );
    const { user, store } = await renderSummary();
    await waitFor(() => expect(payButton()).toBeEnabled());

    await user.click(payButton());

    await waitFor(() => expect(store.getState().checkout.step).toBe('PRODUCTS'));
    expect(store.getState().checkout.notice).toBe('Sorry, this product just sold out.');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('AC-8: an expired token returns to the payment-info step asking for the card again', async () => {
    const { user, store } = await renderSummary({
      card: { ...tokenizedCard, expiresAt: '2020-01-01T00:00:00.000Z' },
    });
    await waitFor(() => expect(payButton()).toBeEnabled());

    await user.click(payButton());

    expect(await screen.findByRole('dialog', { name: 'Checkout' })).toBeInTheDocument();
    expect(screen.getByText('Please re-enter your card')).toBeInTheDocument();
    expect(store.getState().checkout.card).toBeNull();
  });

  it('AC-9: "Edit details" returns to the payment-info step', async () => {
    const { user, store } = await renderSummary();

    await user.click(screen.getByRole('button', { name: 'Edit details' }));

    expect(store.getState().checkout.step).toBe('PAYMENT_INFO');
    expect(await screen.findByRole('dialog', { name: 'Checkout' })).toBeInTheDocument();
  });

  it('AC-9: Escape returns to the payment-info step', async () => {
    const { user, store } = await renderSummary();

    await user.keyboard('{Escape}');

    expect(store.getState().checkout.step).toBe('PAYMENT_INFO');
  });

  it('AC-9: a click on the dimmed area dismisses, a click inside the sheet does not', async () => {
    const { user, store, sheet } = await renderSummary();

    await user.click(within(sheet).getByRole('heading', { name: 'Order summary' }));
    expect(store.getState().checkout.step).toBe('SUMMARY');

    await user.click(screen.getByTestId('summary-backdrop'));
    expect(store.getState().checkout.step).toBe('PAYMENT_INFO');
  });

  it('AC-10: pay is disabled while the fees load', async () => {
    server.use(
      http.get(`${API_URL}/payment-config`, async () => {
        await delay(60);
        return HttpResponse.json({ data: buildPaymentConfig() });
      }),
    );
    const { sheet } = await renderSummary();

    expect(payButton()).toBeDisabled();
    expect(within(sheet).getAllByLabelText('Loading amount')).toHaveLength(3);

    await waitFor(() => expect(payButton()).toBeEnabled());
  });

  it('AC-10: shows an alert with retry when the fees cannot be loaded', async () => {
    server.use(
      http.get(
        `${API_URL}/payment-config`,
        () => HttpResponse.json(errorEnvelope('PERSISTENCE_ERROR'), { status: 500 }),
        { once: true },
      ),
    );
    const { user, sheet } = await renderSummary();

    const alert = await within(sheet).findByRole('alert');
    expect(alert).toHaveTextContent('We could not load the fees.');
    expect(payButton()).toBeDisabled();

    await user.click(within(alert).getByRole('button', { name: 'Retry' }));

    await waitFor(() => expect(payButton()).toBeEnabled());
    expect(within(sheet).queryByRole('alert')).not.toBeInTheDocument();
  });

  it('does not render the summary without a known product', async () => {
    const store = createAppStore(summaryState({ productId: 'gone' }));
    await seedProducts(store, [buildProduct()]);
    renderWithProviders(<CheckoutFlow />, { store });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
