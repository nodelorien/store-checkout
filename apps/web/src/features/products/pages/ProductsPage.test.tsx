import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import { API_URL, buildCatalogue, buildProduct, errorEnvelope } from '@/test/builders';
import { renderWithProviders } from '@/test/renderWithProviders';
import { server } from '@/test/server';
import { checkoutState } from '@/test/states';
import { ProductsPage } from './ProductsPage';

const card = (name: string) => screen.findByRole('article', { name });

describe('ProductsPage', () => {
  it('AC-1: renders name, description, price and stock of each product', async () => {
    renderWithProviders(<ProductsPage />);

    const lamp = within(await card('Aurora Desk Lamp'));
    expect(lamp.getByRole('heading', { name: 'Aurora Desk Lamp' })).toBeInTheDocument();
    expect(lamp.getByText(/Dimmable LED desk lamp/)).toBeInTheDocument();
    expect(lamp.getByText(/^\$\s129\.900$/)).toBeInTheDocument();
    expect(lamp.getByText('12 in stock')).toBeInTheDocument();
    expect(lamp.getByRole('img', { name: 'Aurora Desk Lamp' })).toHaveAttribute(
      'src',
      '/images/products/aurora-desk-lamp.svg',
    );

    expect(screen.getAllByRole('article')).toHaveLength(6);
    expect(screen.getAllByRole('listitem')).toHaveLength(6);
  });

  it('AC-2: a product with stock 0 is sold out and cannot be paid', async () => {
    renderWithProviders(<ProductsPage />);

    const keyboard = within(await card('Drift Mechanical Keyboard'));
    expect(keyboard.getByText('Sold out')).toBeInTheDocument();
    expect(keyboard.getByRole('button', { name: 'Pay with credit card' })).toBeDisabled();
  });

  it('AC-3: a product with stock 1 warns about low stock and can be paid', async () => {
    renderWithProviders(<ProductsPage />);

    const grinder = within(await card('Ember Coffee Grinder'));
    expect(grinder.getByText('Only 1 left')).toBeInTheDocument();
    expect(grinder.getByRole('button', { name: 'Pay with credit card' })).toBeEnabled();
  });

  it('AC-4: pressing "Pay with credit card" starts the checkout for that product', async () => {
    const { store } = renderWithProviders(<ProductsPage />);

    const headphones = within(await card('Nimbus Headphones'));
    await userEvent.click(headphones.getByRole('button', { name: 'Pay with credit card' }));

    expect(store.getState().checkout).toMatchObject({
      step: 'PAYMENT_INFO',
      productId: buildCatalogue()[1]?.id,
      quantity: 1,
    });
  });

  it('AC-5: shows skeleton placeholders while loading', async () => {
    server.use(
      http.get(`${API_URL}/products`, async () => {
        await delay(50);
        return HttpResponse.json({ data: buildCatalogue() });
      }),
    );
    renderWithProviders(<ProductsPage />);

    expect(screen.getByRole('status')).toHaveTextContent('Loading products…');
    expect(screen.getByRole('list')).toHaveAttribute('aria-busy', 'true');
    expect(screen.queryByRole('article')).not.toBeInTheDocument();

    await card('Aurora Desk Lamp');
    expect(screen.queryByText('Loading products…')).not.toBeInTheDocument();
  });

  it('AC-6: shows an alert when loading fails and recovers with Retry', async () => {
    server.use(
      http.get(
        `${API_URL}/products`,
        () => HttpResponse.json(errorEnvelope('PERSISTENCE_ERROR'), { status: 500 }),
        { once: true },
      ),
    );
    renderWithProviders(<ProductsPage />);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('We could not load the products.');

    await userEvent.click(within(alert).getByRole('button', { name: 'Retry' }));

    expect(await card('Aurora Desk Lamp')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('AC-7: shows an empty state when there are no products', async () => {
    server.use(http.get(`${API_URL}/products`, () => HttpResponse.json({ data: [] })));
    renderWithProviders(<ProductsPage />);

    expect(await screen.findByRole('heading', { name: 'No products available' })).toBeVisible();
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
  });

  it('AC-8: only the first images load eagerly; the rest are lazy', async () => {
    renderWithProviders(<ProductsPage />);
    await card('Aurora Desk Lamp');

    const images = screen.getAllByRole('img');
    expect(images[0]).toHaveAttribute('loading', 'eager');
    expect(images[0]).toHaveAttribute('fetchpriority', 'high');
    expect(images[1]).toHaveAttribute('loading', 'eager');
    for (const image of images.slice(2)) {
      expect(image).toHaveAttribute('loading', 'lazy');
    }
  });

  it('AC-9: shows the checkout notice and lets the user dismiss it', async () => {
    const { store } = renderWithProviders(<ProductsPage />, {
      preloadedState: { checkout: checkoutState({ notice: 'Sorry, this product just sold out.' }) },
    });

    expect(await screen.findByText('Sorry, this product just sold out.')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /close/i }));

    await waitFor(() => expect(store.getState().checkout.notice).toBeNull());
    expect(screen.queryByText('Sorry, this product just sold out.')).not.toBeInTheDocument();
  });

  it('keeps long names inside the card', async () => {
    server.use(
      http.get(`${API_URL}/products`, () =>
        HttpResponse.json({ data: [buildProduct({ name: 'Extraordinarily'.repeat(20) })] }),
      ),
    );
    renderWithProviders(<ProductsPage />);

    const heading = await screen.findByRole('heading', { level: 3 });
    expect(heading).toHaveStyle({ overflow: 'hidden' });
  });
});
