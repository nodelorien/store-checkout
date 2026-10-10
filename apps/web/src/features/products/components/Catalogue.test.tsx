import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import type { Product } from '@/shared/api/types';
import { API_URL, buildProduct, errorEnvelope } from '@/test/builders';
import { installViewportObserver } from '@/test/motion';
import { renderWithProviders } from '@/test/renderWithProviders';
import { server } from '@/test/server';
import { mockWideViewport } from '@/test/viewport';
import { ProductsPage } from '../pages/ProductsPage';

const PRODUCTS: Product[] = Array.from({ length: 18 }, (_, index) =>
  buildProduct({
    id: `00000000-0000-4000-8000-0000000000${String(index + 10)}`,
    name: `Product ${String(index + 1).padStart(2, '0')}`,
    description: index === 4 ? 'A desk lamp' : 'Something useful',
    priceInCents: (index + 1) * 1_000_000,
  }),
);

/** Answers like the API: search, order and slice; records what was asked. */
function serveCatalogue(failPage?: number) {
  const requests: Record<string, string>[] = [];
  let failures = failPage === undefined ? 0 : 1;

  server.use(
    http.get(`${API_URL}/products`, ({ request }) => {
      const query = Object.fromEntries(new URL(request.url).searchParams);
      if (!query.pageSize) return HttpResponse.json({ data: PRODUCTS });
      requests.push(query);

      const page = Number(query.page);
      if (page === failPage && failures > 0) {
        failures -= 1;
        return HttpResponse.json(errorEnvelope('INTERNAL_ERROR'), { status: 500 });
      }
      const search = (query.search ?? '').toLowerCase();
      let items = PRODUCTS.filter((product) =>
        `${product.name} ${product.description}`.toLowerCase().includes(search),
      );
      if (query.sort === 'price-desc') items = [...items].reverse();
      const pageSize = Number(query.pageSize);
      const total = items.length;
      return HttpResponse.json({
        data: items.slice((page - 1) * pageSize, page * pageSize),
        meta: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
      });
    }),
  );
  return requests;
}

const names = () =>
  screen.getAllByRole('article').map((card) => within(card).getByRole('heading').textContent);
const location = () => screen.getByTestId('location').textContent;

function renderPage(route = '/') {
  const user = userEvent.setup({ delay: null });
  return { user, ...renderWithProviders(<ProductsPage />, { route }) };
}

describe('catalogue on a phone (endless)', () => {
  it('AC-1: shows the first six products and appends the next page on demand', async () => {
    serveCatalogue();
    const { user } = renderPage();

    await screen.findByRole('article', { name: 'Product 01' });
    expect(names()).toHaveLength(6);
    expect(screen.getByText('18 products')).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Catalogue pages' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Load more products' }));
    await screen.findByRole('article', { name: 'Product 12' });
    expect(names()).toHaveLength(12);
    expect(names()[0]).toBe('Product 01');
  });

  it('AC-1: stops offering more once every product is shown', async () => {
    serveCatalogue();
    const { user } = renderPage();
    await screen.findByRole('article', { name: 'Product 01' });

    await user.click(screen.getByRole('button', { name: 'Load more products' }));
    await screen.findByRole('article', { name: 'Product 12' });
    await user.click(screen.getByRole('button', { name: 'Load more products' }));
    await screen.findByRole('article', { name: 'Product 18' });

    expect(names()).toHaveLength(18);
    expect(screen.queryByRole('button', { name: 'Load more products' })).not.toBeInTheDocument();
  });

  it('AC-1: loads the next page by itself when the end of the list scrolls into view', async () => {
    serveCatalogue();
    const { observers, restore } = installViewportObserver();
    try {
      renderPage();
      const button = await screen.findByRole('button', { name: 'Load more products' });

      const sentinel = observers.find((observer) =>
        observer.observe.mock.calls.some(([element]) => element === button.parentElement),
      );
      sentinel?.enter();

      expect(await screen.findByRole('article', { name: 'Product 07' })).toBeInTheDocument();
    } finally {
      restore();
    }
  });

  it('AC-5: a later page that fails keeps what was loaded and can be retried', async () => {
    serveCatalogue(2);
    const { user } = renderPage();
    await screen.findByRole('article', { name: 'Product 01' });

    await user.click(screen.getByRole('button', { name: 'Load more products' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('We could not load the products.');
    expect(names()).toHaveLength(6);

    await user.click(within(alert).getByRole('button', { name: 'Retry' }));
    expect(await screen.findByRole('article', { name: 'Product 07' })).toBeInTheDocument();
  });
});

describe('catalogue on a wide screen (numbered pages)', () => {
  let restore: () => void;
  beforeEach(() => {
    restore = mockWideViewport();
  });
  afterEach(() => restore());

  it('AC-2: shows eight products per page and moves by page number', async () => {
    const requests = serveCatalogue();
    const { user } = renderPage();

    await screen.findByRole('article', { name: 'Product 01' });
    expect(names()).toHaveLength(8);
    const pages = screen.getByRole('navigation', { name: 'Catalogue pages' });
    expect(within(pages).getByRole('button', { name: 'page 1' })).toHaveAttribute('aria-current');
    expect(screen.queryByRole('button', { name: 'Load more products' })).not.toBeInTheDocument();

    await user.click(within(pages).getByRole('button', { name: 'Go to page 3' }));

    await screen.findByRole('article', { name: 'Product 17' });
    expect(names()).toEqual(['Product 17', 'Product 18']);
    expect(location()).toBe('/?page=3');
    expect(requests.at(-1)).toMatchObject({ page: '3', pageSize: '8' });
  });

  it('AC-2: a page past the end goes to the last page that exists', async () => {
    serveCatalogue();
    renderPage('/?page=9');

    expect(await screen.findByRole('article', { name: 'Product 18' })).toBeInTheDocument();
    expect(location()).toBe('/?page=3');
  });

  it('AC-4: opens on the page, search and order in the address', async () => {
    const requests = serveCatalogue();
    renderPage('/?sort=price-desc&page=2');

    await screen.findByRole('article', { name: 'Product 10' });
    expect(names()[0]).toBe('Product 10');
    expect(screen.getByLabelText('Sort by')).toHaveTextContent('Price: high to low');
    expect(requests.at(-1)).toMatchObject({ page: '2', sort: 'price-desc' });
  });

  it('AC-6: a product on a later page can be bought', async () => {
    serveCatalogue();
    const { user } = renderPage('/?page=2');

    const card = await screen.findByRole('article', { name: 'Product 12' });
    await user.click(within(card).getByRole('button', { name: /pay with credit card/i }));

    const dialog = await screen.findByRole('dialog', { name: 'Checkout' });
    expect(within(dialog).getByText('Product 12')).toBeInTheDocument();
  });
});

describe('search and order', () => {
  it('AC-3: searching asks the API, shows the count and starts from the first page', async () => {
    const requests = serveCatalogue();
    const { user } = renderPage('/?page=2');
    await screen.findByRole('article', { name: 'Product 01' });

    await user.type(screen.getByLabelText('Search products'), 'lamp');

    expect(await screen.findByText('1 product for “lamp”')).toBeInTheDocument();
    expect(names()).toEqual(['Product 05']);
    expect(location()).toBe('/?q=lamp');
    expect(requests.at(-1)).toMatchObject({ search: 'lamp', page: '1' });
    // One request for the finished word, not one per keystroke.
    expect(requests.filter((request) => request.search?.startsWith('l'))).toHaveLength(1);
  });

  it('AC-3: no match explains it and offers to clear the search', async () => {
    serveCatalogue();
    const { user } = renderPage('/?q=zzz');

    expect(
      await screen.findByRole('heading', { name: 'No products match “zzz”' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('article')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Clear search' }));

    await screen.findByRole('article', { name: 'Product 01' });
    expect(screen.getByLabelText('Search products')).toHaveValue('');
    expect(location()).toBe('/');
  });

  it('AC-4: choosing an order asks the API for it and keeps it in the address', async () => {
    const requests = serveCatalogue();
    const { user } = renderPage();
    await screen.findByRole('article', { name: 'Product 01' });

    await user.click(screen.getByLabelText('Sort by'));
    await user.click(within(screen.getByRole('listbox')).getByText('Price: high to low'));

    await waitFor(() => expect(names()[0]).toBe('Product 18'));
    expect(location()).toBe('/?sort=price-desc');
    expect(requests.at(-1)).toMatchObject({ sort: 'price-desc', page: '1' });
  });
});
