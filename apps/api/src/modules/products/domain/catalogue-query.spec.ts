import { aProduct } from '../../../../test/builders/product.builder';
import { expectErr, expectOk } from '../../../../test/helpers/result-assertions';
import { CatalogueQuery, CatalogueQueryInput } from './catalogue-query';
import { Product } from './product';

const id = (n: number): string => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const item = (n: number, name: string, priceInCents: number, description = 'A thing'): Product =>
  aProduct().withId(id(n)).with({ name, description, priceInCents }).build();

/** Deliberately not in any sorted order. */
const CATALOGUE = [
  item(3, 'Terra Backpack', 24_990_000, 'Water-resistant backpack with a LAPTOP sleeve'),
  item(1, 'Aurora Desk Lamp', 18_990_000, 'Dimmable LED lamp'),
  item(4, 'Prism Monitor', 18_990_000, 'Sharp display for any laptop'),
  item(2, 'Nimbus Headphones', 45_990_000, 'Wireless over-ear headphones'),
  item(5, 'drift keyboard', 38_990_000, 'Compact mechanical keyboard'),
];

const run = (input: CatalogueQueryInput = {}, products: readonly Product[] = CATALOGUE) =>
  expectOk(CatalogueQuery.create(input)).apply(products);

const names = (input?: CatalogueQueryInput, products?: readonly Product[]): string[] =>
  run(input, products).items.map((product) => product.name);

describe('CatalogueQuery.create', () => {
  it('AC-1: defaults to page 1, no page size, no search and the order by name', () => {
    const query = expectOk(CatalogueQuery.create());

    expect(query).toMatchObject({ page: 1, pageSize: undefined, search: '', sort: 'name' });
  });

  it('AC-3: trims and lower-cases the search term', () => {
    expect(expectOk(CatalogueQuery.create({ search: '  LaMp ' })).search).toBe('lamp');
  });

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])('AC-7: rejects page %p', (page) => {
    const error = expectErr(CatalogueQuery.create({ page }), 'VALIDATION_ERROR');

    expect(error.details[0].field).toBe('page');
  });

  it.each([0, 49, 2.5, Number.NaN])('AC-7: rejects pageSize %p', (pageSize) => {
    const error = expectErr(CatalogueQuery.create({ pageSize }), 'VALIDATION_ERROR');

    expect(error.details[0].field).toBe('pageSize');
  });

  it('AC-7: accepts the page size limits 1 and 48', () => {
    expect(CatalogueQuery.create({ pageSize: 1 }).isOk()).toBe(true);
    expect(CatalogueQuery.create({ pageSize: 48 }).isOk()).toBe(true);
  });

  it('AC-7: rejects a search longer than 60 characters after trimming', () => {
    expect(CatalogueQuery.create({ search: ` ${'x'.repeat(60)} ` }).isOk()).toBe(true);
    const error = expectErr(CatalogueQuery.create({ search: 'x'.repeat(61) }), 'VALIDATION_ERROR');

    expect(error.details[0].field).toBe('search');
  });

  it('AC-7: rejects an unknown sort', () => {
    const error = expectErr(CatalogueQuery.create({ sort: 'cheapest' }), 'VALIDATION_ERROR');

    expect(error.details[0]).toEqual({
      field: 'sort',
      message: 'sort must be one of featured, name, price-asc, price-desc',
    });
  });
});

describe('CatalogueQuery.apply', () => {
  it('AC-1: without a page size returns everything in one page', () => {
    const page = run();

    expect(page.items).toHaveLength(5);
    expect(page.meta).toEqual({ page: 1, pageSize: 5, total: 5, totalPages: 1 });
  });

  it('AC-1: without a page size the page number is ignored', () => {
    const page = run({ page: 4 });

    expect(page.items).toHaveLength(5);
    expect(page.meta).toEqual({ page: 1, pageSize: 5, total: 5, totalPages: 1 });
  });

  it('AC-1: an empty result without a page size reports pageSize 1, never 0', () => {
    expect(run({}, []).meta).toEqual({ page: 1, pageSize: 1, total: 0, totalPages: 1 });
    expect(run({ search: 'nothing-matches' }).meta).toEqual({
      page: 1,
      pageSize: 1,
      total: 0,
      totalPages: 1,
    });
  });

  it('AC-2: slices the sorted list into pages', () => {
    expect(names({ pageSize: 2, sort: 'name' })).toEqual(['Aurora Desk Lamp', 'drift keyboard']);
    expect(names({ pageSize: 2, page: 2, sort: 'name' })).toEqual([
      'Nimbus Headphones',
      'Prism Monitor',
    ]);
    expect(names({ pageSize: 2, page: 3, sort: 'name' })).toEqual(['Terra Backpack']);
  });

  it('AC-2: reports total and totalPages = ceil(total / pageSize)', () => {
    expect(run({ pageSize: 2, page: 2 }).meta).toEqual({
      page: 2,
      pageSize: 2,
      total: 5,
      totalPages: 3,
    });
    expect(run({ pageSize: 5 }).meta.totalPages).toBe(1);
    expect(run({ pageSize: 48 }).meta).toEqual({ page: 1, pageSize: 48, total: 5, totalPages: 1 });
  });

  it('AC-2: totalPages is 1 for an empty result', () => {
    expect(run({ pageSize: 10, search: 'nothing-matches' })).toEqual({
      items: [],
      meta: { page: 1, pageSize: 10, total: 0, totalPages: 1 },
    });
  });

  it('AC-6: a page beyond the last one is empty, with the correct meta', () => {
    expect(run({ pageSize: 2, page: 9 })).toEqual({
      items: [],
      meta: { page: 9, pageSize: 2, total: 5, totalPages: 3 },
    });
  });

  it('AC-3: matches the name or the description, ignoring case', () => {
    expect(names({ search: 'LAMP' })).toEqual(['Aurora Desk Lamp']);
    expect(names({ search: 'laptop', sort: 'name' })).toEqual(['Prism Monitor', 'Terra Backpack']);
    expect(names({ search: 'KEYBOARD' })).toEqual(['drift keyboard']);
  });

  it('AC-3: an empty or blank search does not filter', () => {
    expect(names({ search: '' })).toHaveLength(5);
    expect(names({ search: '   ' })).toHaveLength(5);
  });

  it('AC-3: total counts the matches, and paging applies after the search', () => {
    const page = run({ search: 'laptop', pageSize: 1, page: 2, sort: 'name' });

    expect(page.items.map((product) => product.name)).toEqual(['Terra Backpack']);
    expect(page.meta).toEqual({ page: 2, pageSize: 1, total: 2, totalPages: 2 });
  });

  it('AC-4: without a sort the catalogue keeps the order it always had: by name', () => {
    const expected = [
      'Aurora Desk Lamp',
      'drift keyboard',
      'Nimbus Headphones',
      'Prism Monitor',
      'Terra Backpack',
    ];

    expect(names()).toEqual(expected);
    expect(names({ sort: 'name' })).toEqual(expected);
  });

  it('AC-4: featured is the curated order of the seed, whose ids are sequential', () => {
    const curated = [...CATALOGUE]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((product) => product.name);

    expect(names({ sort: 'featured' })).toEqual(curated);
  });

  it('AC-4: the order is deterministic whatever order the store returns', () => {
    const twins = [
      item(9, 'Twin', 1_000_000),
      item(7, 'Twin', 1_000_000),
      item(8, 'Twin', 1_000_000),
    ];
    const ids = (products: Product[]): string[] =>
      run({}, products).items.map((product) => product.id);

    expect(ids(twins)).toEqual([id(7), id(8), id(9)]);
    expect(ids([...twins].reverse())).toEqual([id(7), id(8), id(9)]);
    expect(ids([twins[0], twins[0]])).toEqual([id(9), id(9)]);
  });

  it('AC-5: sorts by price ascending and descending, ties by name', () => {
    expect(names({ sort: 'price-asc' })).toEqual([
      'Aurora Desk Lamp',
      'Prism Monitor',
      'Terra Backpack',
      'drift keyboard',
      'Nimbus Headphones',
    ]);
    expect(names({ sort: 'price-desc' })).toEqual([
      'Nimbus Headphones',
      'drift keyboard',
      'Terra Backpack',
      'Aurora Desk Lamp',
      'Prism Monitor',
    ]);
  });

  it('does not mutate the list it is given', () => {
    const before = CATALOGUE.map((product) => product.id);

    run({ sort: 'price-desc', pageSize: 2 });

    expect(CATALOGUE.map((product) => product.id)).toEqual(before);
  });
});
