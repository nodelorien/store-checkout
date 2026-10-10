import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { App } from '@/App';
import type { RootState } from '@/app/store';
import type { Delivery, Transaction } from '@/shared/api/types';
import {
  API_URL,
  TRANSACTION_ID,
  buildDelivery,
  buildTransaction,
  errorEnvelope,
} from '@/test/builders';
import { renderWithProviders } from '@/test/renderWithProviders';
import { server } from '@/test/server';
import { paymentInfoState, statusState } from '@/test/states';

const STATUS_URL = `/transactions/${TRANSACTION_ID}`;

function serve(transaction: Partial<Transaction> = {}, delivery: Partial<Delivery> = {}) {
  server.use(
    http.get(`${API_URL}/transactions/:id`, () =>
      HttpResponse.json({ data: buildTransaction(transaction) }),
    ),
    http.get(`${API_URL}/transactions/:id/delivery`, () =>
      HttpResponse.json({ data: buildDelivery(delivery) }),
    ),
  );
}

function renderStatus(preloadedState: Partial<RootState> = statusState()) {
  const user = userEvent.setup({ delay: null });
  return { user, ...renderWithProviders(<App />, { preloadedState, route: STATUS_URL }) };
}

const tracking = () => screen.findByRole('region', { name: 'Order tracking' });
const stepStates = (region: HTMLElement) =>
  within(region)
    .getAllByRole('listitem')
    .map((item) => `${item.textContent?.replace(' · now', '')}:${item.dataset.state}`);

describe('order tracking on the status screen', () => {
  it('AC-3: an approved order being prepared shows where it is in its journey', async () => {
    serve();
    renderStatus();

    const region = await tracking();
    expect(stepStates(region)).toEqual([
      'Payment approved:done',
      'Preparing your order:current',
      'On its way:upcoming',
      'Delivered:upcoming',
    ]);
    expect(
      within(region)
        .getByText(/Preparing your order/)
        .closest('li'),
    ).toHaveAttribute('aria-current', 'step');
  });

  it.each([
    ['SHIPPED', ['done', 'done', 'current', 'upcoming']],
    ['DELIVERED', ['done', 'done', 'done', 'done']],
  ] as const)('AC-3: a %s order marks its steps', async (status, expected) => {
    serve({}, { status });
    renderStatus();

    const states = stepStates(await tracking()).map((step) => step.split(':')[1]);
    expect(states).toEqual(expected);
  });

  it('AC-3: a declined payment has no order to track and does not ask for one', async () => {
    const deliveryRequested = jest.fn();
    server.use(
      http.get(`${API_URL}/transactions/:id`, () =>
        HttpResponse.json({ data: buildTransaction({ status: 'DECLINED', deliveryId: null }) }),
      ),
      http.get(`${API_URL}/transactions/:id/delivery`, () => {
        deliveryRequested();
        return HttpResponse.json(errorEnvelope('DELIVERY_NOT_FOUND'), { status: 404 });
      }),
    );
    renderStatus();

    expect(await screen.findByRole('heading', { name: 'Payment declined' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Order tracking' })).not.toBeInTheDocument();
    expect(deliveryRequested).not.toHaveBeenCalled();
  });

  it('AC-4: the device that placed the order sees the address and can correct it', async () => {
    serve();
    let sent: unknown;
    server.use(
      http.patch(`${API_URL}/deliveries/:id`, async ({ request }) => {
        sent = await request.json();
        server.use(
          http.get(`${API_URL}/transactions/:id/delivery`, () =>
            HttpResponse.json({
              data: buildDelivery({
                address: { ...buildDelivery().address, addressLine1: 'Calle 100 # 8A-55' },
              }),
            }),
          ),
        );
        return HttpResponse.json({ data: buildDelivery() });
      }),
    );
    const { user } = renderStatus();

    const region = await tracking();
    expect(within(region).getByText(/Cra 7 # 71-21, Apto 501, Bogotá/)).toBeInTheDocument();
    await user.click(within(region).getByRole('button', { name: 'Edit address' }));

    const dialog = await screen.findByRole('dialog', { name: 'Edit delivery address' });
    const address = within(dialog).getByLabelText('Address');
    await user.clear(address);
    await user.type(address, 'Calle 100 # 8A-55');
    await user.click(within(dialog).getByRole('button', { name: 'Save address' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(sent).toEqual({
      addressLine1: 'Calle 100 # 8A-55',
      addressLine2: 'Apto 501',
      city: 'Bogotá',
      region: 'Cundinamarca',
      postalCode: '110231',
    });
    expect(await screen.findByText(/Calle 100 # 8A-55/)).toBeInTheDocument();
  });

  it('AC-4: someone opening the link elsewhere sees the journey but not the address', async () => {
    serve();
    renderStatus(paymentInfoState());

    const region = await tracking();
    expect(within(region).queryByText(/Cra 7/)).not.toBeInTheDocument();
    expect(within(region).queryByRole('button', { name: 'Edit address' })).not.toBeInTheDocument();
  });

  it('AC-4: an order already on its way can no longer be edited', async () => {
    serve({}, { status: 'SHIPPED' });
    renderStatus();

    const region = await tracking();
    expect(within(region).getByText(/Cra 7 # 71-21/)).toBeInTheDocument();
    expect(within(region).queryByRole('button', { name: 'Edit address' })).not.toBeInTheDocument();
  });

  it('AC-5: an invalid address is explained inline and nothing is sent', async () => {
    serve();
    const patched = jest.fn();
    server.use(
      http.patch(`${API_URL}/deliveries/:id`, () => {
        patched();
        return HttpResponse.json({ data: buildDelivery() });
      }),
    );
    const { user } = renderStatus();

    await user.click(within(await tracking()).getByRole('button', { name: 'Edit address' }));
    const dialog = await screen.findByRole('dialog');
    await user.clear(within(dialog).getByLabelText('City'));
    await user.click(within(dialog).getByRole('button', { name: 'Save address' }));

    expect(await within(dialog).findByText('Enter your city')).toBeInTheDocument();
    expect(patched).not.toHaveBeenCalled();
  });

  it('AC-5: if the order shipped meanwhile, the dialog says so and stays open', async () => {
    serve();
    server.use(
      http.patch(`${API_URL}/deliveries/:id`, () =>
        HttpResponse.json(errorEnvelope('DELIVERY_NOT_EDITABLE'), { status: 409 }),
      ),
    );
    const { user } = renderStatus();

    await user.click(within(await tracking()).getByRole('button', { name: 'Edit address' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Save address' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(/already on its way/);
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});

describe('after the payment', () => {
  it('AC-6: a declined payment says what the customer can do next', async () => {
    serve({ status: 'DECLINED', deliveryId: null });
    renderStatus();

    const heading = await screen.findByRole('heading', { name: 'What you can do' });
    const steps = within(heading.parentElement!).getAllByRole('listitem');
    expect(steps).toHaveLength(3);
    expect(steps[2]).toHaveTextContent(/Try another card/);
  });

  it('AC-6: an approved payment has no such list', async () => {
    serve();
    renderStatus();

    await tracking();
    expect(screen.queryByRole('heading', { name: 'What you can do' })).not.toBeInTheDocument();
  });

  it('AC-7: the reference can be copied and the receipt printed', async () => {
    serve();
    const print = jest.spyOn(window, 'print').mockImplementation(() => undefined);
    const { user } = renderStatus();
    // After `userEvent.setup`, which installs its own clipboard.
    const writeText = jest.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);

    await user.click(await screen.findByRole('button', { name: 'Copy reference' }));
    expect(writeText).toHaveBeenCalledWith('TX-20261009-7K2M9QXA');
    expect(await screen.findByText('Reference copied')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Print receipt' }));
    expect(print).toHaveBeenCalledTimes(1);
    print.mockRestore();
  });

  it('AC-7: a payment that did not go through has no receipt to print', async () => {
    serve({ status: 'DECLINED', deliveryId: null });
    renderStatus();

    await screen.findByRole('heading', { name: 'Payment declined' });
    expect(screen.queryByRole('button', { name: 'Print receipt' })).not.toBeInTheDocument();
  });
});
