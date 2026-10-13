import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay as networkDelay, http, HttpResponse } from 'msw';
import { App } from '@/App';
import type { RootState } from '@/app/store';
import { initialCheckoutState } from '@/features/checkout';
import type { Transaction } from '@/shared/api/types';
import { delay } from '@/shared/lib/delay';
import {
  API_URL,
  PRODUCT_ID,
  TRANSACTION_ID,
  buildCatalogue,
  buildDelivery,
  buildTransaction,
  errorEnvelope,
} from '@/test/builders';
import { createGate } from '@/test/gate';
import { renderWithProviders } from '@/test/renderWithProviders';
import { server } from '@/test/server';
import { delivery, paymentInfoState, statusState } from '@/test/states';
import { initialTransactionState } from '../transactionSlice';

jest.mock('@/shared/lib/delay', () => jest.requireActual('@/test/delayMock'));

const delayMock = jest.mocked(delay);
const STATUS_URL = `/transactions/${TRANSACTION_ID}`;

function serveTransaction(overrides: Partial<Transaction>) {
  server.use(
    http.get(`${API_URL}/transactions/:id`, () =>
      HttpResponse.json({ data: buildTransaction(overrides) }),
    ),
  );
}

function renderStatus(
  preloadedState: Partial<RootState> = statusState(),
  route: string = STATUS_URL,
) {
  const user = userEvent.setup({ delay: null });
  return { user, ...renderWithProviders(<App />, { preloadedState, route }) };
}

const location = () => screen.getByTestId('location').textContent;
const row = (label: string) => screen.getByText(label).parentElement as HTMLElement;

describe('TransactionStatusPage', () => {
  beforeEach(() => delayMock.mockClear());

  it('AC-1: the store redirects to the result while the checkout is in the status step', async () => {
    renderStatus(statusState(), '/');

    expect(await screen.findByRole('heading', { name: 'Payment approved' })).toBeInTheDocument();
    expect(location()).toBe(STATUS_URL);
  });

  it('AC-2: approved shows reference, API amounts, card, delivery address and only "Back to store"', async () => {
    serveTransaction({
      amounts: {
        subtotalInCents: 25980000,
        baseFeeInCents: 250000,
        deliveryFeeInCents: 800000,
        totalInCents: 27030000,
      },
      quantity: 2,
    });
    // The form's delivery recap shows only until the API's delivery arrives, so hold that answer.
    const deliveryApi = createGate();
    server.use(
      http.get(`${API_URL}/transactions/:id/delivery`, async () => {
        await deliveryApi.opened;
        return HttpResponse.json({ data: buildDelivery() });
      }),
    );
    renderStatus();

    expect(await screen.findByRole('heading', { name: 'Payment approved' })).toBeInTheDocument();
    expect(row('Reference')).toHaveTextContent('TX-20261009-7K2M9QXA');
    expect(row('Product')).toHaveTextContent('Aurora Desk Lamp × 2');
    expect(row('Card')).toHaveTextContent('VISA •••• 4242');
    expect(row('Subtotal')).toHaveTextContent(/\$\s259\.800$/);
    expect(row('Base fee')).toHaveTextContent(/\$\s2\.500$/);
    expect(row('Delivery fee')).toHaveTextContent(/\$\s8\.000$/);
    expect(row('Total paid')).toHaveTextContent(/\$\s270\.300$/);
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
    expect(screen.getByText('Cra 7 # 71-21, Apto 501, Bogota, Cundinamarca')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back to store' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument();

    deliveryApi.open();
    expect(await screen.findByRole('region', { name: 'Order tracking' })).toBeInTheDocument();
    expect(screen.queryByText('Ada Lovelace')).not.toBeInTheDocument();
  });

  it('AC-3: declined shows the gateway reason with "Try again" and "Back to store"', async () => {
    serveTransaction({ status: 'DECLINED', statusMessage: 'Insufficient funds', deliveryId: null });
    renderStatus(statusState({ status: 'DECLINED' }));

    expect(await screen.findByRole('heading', { name: 'Payment declined' })).toBeInTheDocument();
    expect(screen.getByText('Insufficient funds. You have not been charged.')).toBeInTheDocument();
    expect(row('Total')).toHaveTextContent(/\$\s140\.400$/);
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back to store' })).toBeInTheDocument();
    expect(screen.queryByText('Delivering to')).not.toBeInTheDocument();
  });

  it.each([
    ['ERROR', 'Payment failed', 'We could not complete the payment. You have not been charged.'],
    ['VOIDED', 'Payment voided', 'This payment was cancelled. You have not been charged.'],
  ] as const)(
    'AC-4: %s shows generic failure copy and both actions',
    async (status, title, copy) => {
      serveTransaction({ status, statusMessage: 'internal detail' });
      renderStatus(statusState({ status }));

      expect(await screen.findByRole('heading', { name: title })).toBeInTheDocument();
      expect(screen.getByText(copy)).toBeInTheDocument();
      expect(screen.queryByText(/internal detail/)).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Back to store' })).toBeInTheDocument();
    },
  );

  it('AC-5 AC-11: pending polls and announces the result when it resolves', async () => {
    let reads = 0;
    server.use(
      http.get(`${API_URL}/transactions/:id`, async () => {
        reads += 1;
        await networkDelay(20);
        return HttpResponse.json({
          data: buildTransaction({ status: reads >= 3 ? 'APPROVED' : 'PENDING' }),
        });
      }),
    );
    const { store } = renderStatus(statusState({ status: 'PENDING' }));

    expect(
      await screen.findByRole('heading', { name: 'Processing your payment…' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Processing' })).toBeInTheDocument();
    const liveRegion = screen.getByRole('status');
    expect(liveRegion).toHaveAttribute('aria-live', 'polite');
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument();

    await waitFor(() => expect(liveRegion).toHaveTextContent('Payment approved'));
    expect(reads).toBe(3);
    expect(delayMock).toHaveBeenCalledWith(2000, expect.any(AbortSignal));
    expect(store.getState().transaction.status).toBe('APPROVED');
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('AC-6: still pending after 30 attempts offers "Check again", which polls again', async () => {
    let reads = 0;
    let resolved = false;
    server.use(
      http.get(`${API_URL}/transactions/:id`, () => {
        reads += 1;
        return HttpResponse.json({
          data: buildTransaction({ status: resolved ? 'APPROVED' : 'PENDING' }),
        });
      }),
    );
    const { user, store } = renderStatus(statusState({ status: 'PENDING' }));

    expect(await screen.findByRole('heading', { name: 'Still processing' })).toBeInTheDocument();
    expect(store.getState().transaction.polling).toEqual({ attempts: 30, timedOut: true });
    expect(reads).toBe(31);

    resolved = true;
    await user.click(screen.getByRole('button', { name: 'Check again' }));

    expect(await screen.findByRole('heading', { name: 'Payment approved' })).toBeInTheDocument();
    expect(store.getState().transaction.polling.timedOut).toBe(false);
  });

  it('AC-7: "Back to store" clears the flow, returns to the products and refetches the stock', async () => {
    let productRequests = 0;
    server.use(
      http.get(`${API_URL}/products`, () => {
        productRequests += 1;
        const catalogue = buildCatalogue();
        return HttpResponse.json({
          data: catalogue.map((product) =>
            product.id === PRODUCT_ID ? { ...product, stock: 11 } : product,
          ),
        });
      }),
    );
    const { user, store } = renderStatus();

    await user.click(await screen.findByRole('button', { name: 'Back to store' }));

    const lamp = within(await screen.findByRole('article', { name: 'Aurora Desk Lamp' }));
    expect(lamp.getByText('11 in stock')).toBeInTheDocument();
    expect(location()).toBe('/');
    expect(productRequests).toBeGreaterThanOrEqual(1);
    expect(store.getState().checkout).toEqual(initialCheckoutState);
    expect(store.getState().transaction).toEqual(initialTransactionState);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('AC-8: "Try again" returns to the card step for the same product keeping delivery data', async () => {
    serveTransaction({ status: 'DECLINED' });
    const { user, store } = renderStatus(statusState({ status: 'DECLINED' }));

    await user.click(await screen.findByRole('button', { name: 'Try again' }));

    const dialog = await screen.findByRole('dialog', { name: 'Checkout' });
    expect(location()).toBe('/');
    expect(within(dialog).getByText('Aurora Desk Lamp')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Card number')).toHaveValue('');
    expect(within(dialog).getByLabelText('Full name')).toHaveValue('Ada Lovelace');
    expect(store.getState().checkout).toMatchObject({
      step: 'PAYMENT_INFO',
      productId: PRODUCT_ID,
      delivery,
      card: null,
      idempotencyKey: null,
    });
    expect(store.getState().transaction).toEqual(initialTransactionState);
  });

  it('AC-9: shows a loading state while the transaction is read', async () => {
    server.use(
      http.get(`${API_URL}/transactions/:id`, async () => {
        await networkDelay(40);
        return HttpResponse.json({ data: buildTransaction() });
      }),
    );
    renderStatus();

    expect(screen.getByRole('status')).toHaveTextContent('Loading your transaction…');

    expect(await screen.findByRole('heading', { name: 'Payment approved' })).toBeInTheDocument();
  });

  it('AC-9: an unknown transaction shows "Transaction not found"', async () => {
    server.use(
      http.get(`${API_URL}/transactions/:id`, () =>
        HttpResponse.json(errorEnvelope('TRANSACTION_NOT_FOUND'), { status: 404 }),
      ),
    );
    const { user } = renderStatus({}, '/transactions/unknown');

    expect(
      await screen.findByRole('heading', { name: 'Transaction not found' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Back to store' }));

    expect(location()).toBe('/');
  });

  it('AC-9: a failed read shows an alert and recovers with "Retry"', async () => {
    server.use(
      http.get(
        `${API_URL}/transactions/:id`,
        () => HttpResponse.json(errorEnvelope('PERSISTENCE_ERROR'), { status: 500 }),
        { once: true },
      ),
    );
    const { user } = renderStatus();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Something went wrong. Please try again.');

    await user.click(within(alert).getByRole('button', { name: 'Retry' }));

    expect(await screen.findByRole('heading', { name: 'Payment approved' })).toBeInTheDocument();
  });

  it('AC-10: polling stops when the page is left', async () => {
    let reads = 0;
    server.use(
      http.get(`${API_URL}/transactions/:id`, () => {
        reads += 1;
        return HttpResponse.json({ data: buildTransaction({ status: 'PENDING' }) });
      }),
    );
    // Never resolves: the poll is parked in its first wait until aborted.
    delayMock.mockImplementation(
      (_ms, signal) =>
        new Promise<void>((_resolve, reject) => {
          signal?.addEventListener('abort', () => reject(new Error('aborted')));
        }),
    );
    const { user, store } = renderStatus(statusState({ status: 'PENDING' }));
    await screen.findByRole('heading', { name: 'Processing your payment…' });
    const signal = delayMock.mock.calls[0]?.[1];
    expect(signal?.aborted).toBe(false);

    await user.click(screen.getByRole('button', { name: 'Back to store' }));

    expect(signal?.aborted).toBe(true);
    expect(reads).toBe(1);
    expect(store.getState().transaction.polling.attempts).toBe(0);
    delayMock.mockReset();
  });

  it('viewing another transaction does not discard a checkout in progress', async () => {
    const { user, store } = renderStatus(paymentInfoState({ delivery }), '/transactions/other-id');

    expect(await screen.findByRole('heading', { name: 'Payment approved' })).toBeInTheDocument();
    expect(screen.queryByText('Delivering to')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Back to store' }));

    expect(store.getState().checkout).toMatchObject({
      step: 'PAYMENT_INFO',
      productId: PRODUCT_ID,
      delivery,
    });
    expect(await screen.findByRole('dialog', { name: 'Checkout' })).toBeInTheDocument();
  });
});
