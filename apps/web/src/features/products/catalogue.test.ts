import { catalogueParams, toProductsPage } from '@/shared/api/baseApi';
import { buildCatalogue } from '@/test/builders';
import { hasMorePages, parseCatalogueView, resultsLabel, toSearchParams } from './catalogue';

const view = (query: string) => parseCatalogueView(new URLSearchParams(query));

describe('catalogue view in the address bar', () => {
  it('AC-4: reads page, search and order', () => {
    expect(view('q=lamp&sort=price-asc&page=3')).toEqual({
      page: 3,
      search: 'lamp',
      sort: 'price-asc',
    });
  });

  it.each(['', 'page=0', 'page=-2', 'page=1.5', 'page=abc', 'sort=cheapest'])(
    'AC-4: "%s" falls back to the default view',
    (query) => {
      expect(view(query)).toEqual({ page: 1, search: '', sort: 'featured' });
    },
  );

  it('AC-3: trims the search and limits it to 60 characters', () => {
    expect(view(`q=${'a'.repeat(80)}`).search).toHaveLength(60);
    expect(view('q=%20%20lamp%20').search).toBe('lamp');
  });

  it('AC-4: writes the shortest query string, leaving defaults out', () => {
    expect(toSearchParams({ page: 1, search: '', sort: 'featured' }).toString()).toBe('');
    expect(toSearchParams({ page: 2, search: 'desk lamp', sort: 'name' }).toString()).toBe(
      'q=desk+lamp&sort=name&page=2',
    );
  });
});

describe('catalogue helpers', () => {
  it('AC-1: there are more pages until every page has been loaded', () => {
    const meta = { page: 1, pageSize: 6, total: 18, totalPages: 3 };

    expect(hasMorePages(meta, 1)).toBe(true);
    expect(hasMorePages(meta, 3)).toBe(false);
    expect(hasMorePages(undefined, 1)).toBe(false);
  });

  it('AC-3: words the number of results', () => {
    expect(resultsLabel(18, '')).toBe('18 products');
    expect(resultsLabel(1, 'lamp')).toBe('1 product for “lamp”');
    expect(resultsLabel(0, 'zzz')).toBe('0 products for “zzz”');
  });

  it('sends the search only when there is one, and always the order', () => {
    expect(catalogueParams({ page: 2, pageSize: 8, search: '  ', sort: 'featured' })).toEqual({
      page: 2,
      pageSize: 8,
      sort: 'featured',
    });
    expect(catalogueParams({ page: 1, pageSize: 6, search: ' lamp ', sort: 'name' })).toEqual({
      page: 1,
      pageSize: 6,
      search: 'lamp',
      sort: 'name',
    });
  });

  it('AC-5: an answer without page information is the whole catalogue in one page', () => {
    const items = buildCatalogue();

    expect(toProductsPage(items, undefined).meta).toEqual({
      page: 1,
      pageSize: 6,
      total: 6,
      totalPages: 1,
    });
    expect(toProductsPage([], { page: 'x' }).meta).toEqual({
      page: 1,
      pageSize: 1,
      total: 0,
      totalPages: 1,
    });
    expect(
      toProductsPage(items, { page: 2, pageSize: 6, total: 18, totalPages: 3 }).meta.page,
    ).toBe(2);
  });
});
