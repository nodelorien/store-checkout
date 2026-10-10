import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { App } from '@/App';
import { createAppStore } from '@/app/store';
import { baseApi } from '@/shared/api/baseApi';
import type { CreateTransactionArgs, Transaction } from '@/shared/api/types';
import { API_URL, TRANSACTION_ID, buildTransaction, errorEnvelope } from '@/test/builders';
import { renderWithProviders } from '@/test/renderWithProviders';
import { server } from '@/test/server';
import { startApp } from '@/test/startApp';
import {
  MAX_ORDERS,
  ORDERS_STORAGE_KEY,
  loadOrders,
  saveOrders,
  type OrderEntry,
} from './ordersSlice';
import { initialsOf } from './profile';

const order = (index: number): OrderEntry => ({
  id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
  reference: `TX-20261010-${String(index).padStart(8, '0')}`,
  placedAt: `2026-10-10T12:${String(index % 60).padStart(2, '0')}:00.000Z`,
});

async function pay(store: ReturnType<typeof createAppStore>, transaction: Partial<Transaction>) {
  server.use(
    http.post(`${API_URL}/transactions`, () =>
      HttpResponse.json({ data: buildTransaction(transaction) }, { status: 201 }),
    ),
  );
  await store.dispatch(
    baseApi.endpoints.createTransaction.initiate({
      body: {},
      idempotencyKey: 'key-12345678',
    } as CreateTransactionArgs),
  );
}

const renderApp = (route: string, orders: OrderEntry[] = []) => {
  const user = userEvent.setup({ delay: null });
  const view = renderWithProviders(<App />, {
    preloadedState: { orders: { items: orders } },
    route,
  });
  return { user, ...view };
};

describe('remembered orders', () => {
  it('AC-2: a payment that reached the API is remembered by id, reference and date only', async () => {
    const store = createAppStore();

    await pay(store, { id: 'tx-1', reference: 'TX-1', createdAt: '2026-10-10T12:00:00.000Z' });

    expect(store.getState().orders.items).toEqual([
      { id: 'tx-1', reference: 'TX-1', placedAt: '2026-10-10T12:00:00.000Z' },
    ]);
    expect(JSON.parse(window.localStorage.getItem(ORDERS_STORAGE_KEY)!)).toEqual([
      { id: 'tx-1', reference: 'TX-1', placedAt: '2026-10-10T12:00:00.000Z' },
    ]);
  });

  it('AC-2: newest first, no duplicates when a request is replayed', async () => {
    const store = createAppStore();

    await pay(store, { id: 'tx-1', reference: 'TX-1' });
    await pay(store, { id: 'tx-2', reference: 'TX-2' });
    await pay(store, { id: 'tx-1', reference: 'TX-1' });

    expect(store.getState().orders.items.map((entry) => entry.id)).toEqual(['tx-2', 'tx-1']);
  });

  it(`AC-2: keeps at most ${MAX_ORDERS} orders`, async () => {
    const store = createAppStore({
      orders: { items: Array.from({ length: MAX_ORDERS }, (_, index) => order(index)) },
    });

    await pay(store, { id: 'tx-new', reference: 'TX-NEW' });

    const { items } = store.getState().orders;
    expect(items).toHaveLength(MAX_ORDERS);
    expect(items[0].id).toBe('tx-new');
  });

  it('AC-2: a failed request is not an order', async () => {
    const store = createAppStore();
    server.use(
      http.post(`${API_URL}/transactions`, () =>
        HttpResponse.json(errorEnvelope('OUT_OF_STOCK'), { status: 409 }),
      ),
    );

    await store.dispatch(
      baseApi.endpoints.createTransaction.initiate({
        body: {},
        idempotencyKey: 'key-12345678',
      } as CreateTransactionArgs),
    );

    expect(store.getState().orders.items).toEqual([]);
  });

  it.each([
    ['not JSON', '{oops'],
    ['not a list', '{"id":"x"}'],
    ['a list with extra data it must not trust', '[{"id":"","reference":"r","placedAt":"x"}]'],
  ])('AC-2: stored content that is %s is ignored', (_label, stored) => {
    window.localStorage.setItem(ORDERS_STORAGE_KEY, stored);

    expect(loadOrders().items).toEqual([]);
  });

  it('AC-2: stores only the allow-listed fields and survives storage failures', () => {
    const entry = { ...order(1), cardNumber: '4242424242424242' } as OrderEntry;
    saveOrders({ items: [entry] });

    expect(window.localStorage.getItem(ORDERS_STORAGE_KEY)).not.toContain('4242424242424242');
    expect(loadOrders().items).toEqual([order(1)]);

    const broken = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('quota');
      },
    };
    expect(() => saveOrders({ items: [order(1)] }, broken)).not.toThrow();
    expect(loadOrders(broken).items).toEqual([]);
  });

  it('AC-2: orders are still there after a reload', async () => {
    window.localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify([order(3)]));

    const { store } = startApp('/orders');

    expect(store.getState().orders.items).toEqual([order(3)]);
    expect(await screen.findByRole('link', { name: `Order ${order(3).reference}` })).toBeVisible();
  });
});

describe('account menu', () => {
  it('AC-1: the header shows the signed-in customer and where their account leads', async () => {
    const { user } = renderApp('/', [order(1), order(2)]);

    const account = screen.getByRole('button', { name: 'Account: Alex Rivera' });
    expect(account).toHaveTextContent('AR');
    expect(account).toHaveTextContent('Alex');
    await user.click(account);

    const menu = await screen.findByRole('menu');
    expect(within(menu).getByText('alex.rivera@example.com')).toBeInTheDocument();
    expect(
      within(menu)
        .getAllByRole('menuitem')
        .map((item) => item.textContent),
    ).toEqual(['Store', 'My orders', 'Insights']);
    expect(within(menu).getByText(/Demo session/)).toBeInTheDocument();
  });

  it('AC-1: choosing a destination goes there and closes the menu', async () => {
    const { user } = renderApp('/');

    await user.click(screen.getByRole('button', { name: /Account/ }));
    await user.click(await screen.findByRole('menuitem', { name: 'My orders' }));

    expect(await screen.findByRole('heading', { name: 'My orders' })).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('/orders');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('builds initials from the first and last name', () => {
    expect(initialsOf('Alex Rivera')).toBe('AR');
    expect(initialsOf('  ada  king lovelace ')).toBe('AL');
    expect(initialsOf('Cher')).toBe('C');
    expect(initialsOf('')).toBe('');
  });
});

describe('My orders', () => {
  it('AC-3: without purchases it says so and leads back to the store', async () => {
    const { user } = renderApp('/orders');

    expect(await screen.findByRole('heading', { name: 'No orders yet' })).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'Browse products' }));
    expect(screen.getByTestId('location')).toHaveTextContent('/');
  });

  it('AC-3: lists each purchase with its current status and total, newest first', async () => {
    server.use(
      http.get(`${API_URL}/transactions/:id`, ({ params }) =>
        HttpResponse.json({
          data: buildTransaction({
            id: String(params.id),
            status: params.id === order(2).id ? 'DECLINED' : 'APPROVED',
          }),
        }),
      ),
    );
    renderApp('/orders', [order(2), order(1)]);

    const rows = await screen.findAllByRole('listitem');
    expect(rows).toHaveLength(2);
    expect(await within(rows[0]).findByText('Declined')).toBeInTheDocument();
    expect(await within(rows[1]).findByText('Approved')).toBeInTheDocument();
    expect(within(rows[1]).getByText('Aurora Desk Lamp × 1')).toBeInTheDocument();
    expect(within(rows[1]).getByText(/140\.400/)).toBeInTheDocument();
    expect(within(rows[0]).getByRole('link')).toHaveAttribute(
      'href',
      `/transactions/${order(2).id}`,
    );
  });

  it('AC-3: an order whose details cannot be read still shows what the device remembers', async () => {
    server.use(
      http.get(`${API_URL}/transactions/:id`, () =>
        HttpResponse.json(errorEnvelope('INTERNAL_ERROR'), { status: 500 }),
      ),
    );
    renderApp('/orders', [order(1)]);

    expect(await screen.findByText('Details are unavailable right now.')).toBeInTheDocument();
    expect(screen.getByText(new RegExp(order(1).reference))).toBeInTheDocument();
  });

  it('AC-4: reopening an own order later still shows its address and lets it be corrected', async () => {
    const own = { ...order(1), id: TRANSACTION_ID };
    renderApp(`/transactions/${TRANSACTION_ID}`, [own]);

    const tracking = await screen.findByRole('region', { name: 'Order tracking' });
    expect(within(tracking).getByText(/Cra 7 # 71-21/)).toBeInTheDocument();
    expect(within(tracking).getByRole('button', { name: 'Edit address' })).toBeInTheDocument();
  });
});
