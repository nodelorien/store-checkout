import { aProduct, PRODUCT_ID } from '../../../../../test/builders/product.builder';
import { InMemoryProductRepository } from '../../../../../test/fakes/in-memory-product.repository';
import { expectErr, expectOk } from '../../../../../test/helpers/result-assertions';
import { DomainErrors } from '../../../../shared/errors/domain-error';
import { GetProductStockUseCase } from './get-product-stock.use-case';
import { GetProductUseCase } from './get-product.use-case';
import { ListProductsUseCase } from './list-products.use-case';

const OTHER_ID = '11111111-1111-4111-8111-111111111111';

function setup() {
  const repository = new InMemoryProductRepository([
    aProduct().withId(OTHER_ID).with({ name: 'Terra Backpack' }).withStock(0).build(),
    aProduct().with({ name: 'Aurora Desk Lamp' }).withStock(5).build(),
  ]);
  return {
    repository,
    list: new ListProductsUseCase(repository),
    get: new GetProductUseCase(repository),
    stock: new GetProductStockUseCase(repository),
  };
}

describe('ListProductsUseCase', () => {
  it('AC-1: returns every product as a view, sorted by name, with its meta', async () => {
    const { list } = setup();

    const { items, meta } = expectOk(await list.execute());

    expect(items.map((view) => view.name)).toEqual(['Aurora Desk Lamp', 'Terra Backpack']);
    expect(items[0]).toEqual({
      id: PRODUCT_ID,
      name: 'Aurora Desk Lamp',
      description: 'Dimmable LED desk lamp',
      priceInCents: 12_990_000,
      currency: 'COP',
      imageUrl: '/images/products/aurora-desk-lamp.svg',
      stock: 5,
    });
    expect(meta).toEqual({ page: 1, pageSize: 2, total: 2, totalPages: 1 });
  });

  it('AC-1: returns an empty list for an empty catalogue', async () => {
    const list = new ListProductsUseCase(new InMemoryProductRepository());

    expect(expectOk(await list.execute())).toEqual({
      items: [],
      meta: { page: 1, pageSize: 1, total: 0, totalPages: 1 },
    });
  });

  it('AC-2: applies search, sort and paging to the stored catalogue', async () => {
    const { list } = setup();

    // Both fixtures share the description and the price, so the name breaks the tie.
    const page = expectOk(
      await list.execute({ search: 'LED desk', sort: 'price-desc', page: 2, pageSize: 1 }),
    );

    expect(page.items.map((view) => view.name)).toEqual(['Terra Backpack']);
    expect(page.meta).toEqual({ page: 2, pageSize: 1, total: 2, totalPages: 2 });
  });

  it('AC-7: returns VALIDATION_ERROR for an invalid query without reading the store', async () => {
    const { list, repository } = setup();
    const findAll = jest.spyOn(repository, 'findAll');

    expectErr(await list.execute({ pageSize: 49 }), 'VALIDATION_ERROR');
    expect(findAll).not.toHaveBeenCalled();
  });

  it('AC-6: propagates a persistence failure', async () => {
    const { list, repository } = setup();
    repository.failWith = DomainErrors.persistence();

    expectErr(await list.execute(), 'PERSISTENCE_ERROR');
  });
});

describe('GetProductUseCase', () => {
  it('AC-2: returns the product view', async () => {
    const { get } = setup();

    expect(expectOk(await get.execute(PRODUCT_ID))).toMatchObject({ id: PRODUCT_ID, stock: 5 });
  });

  it('AC-3: returns PRODUCT_NOT_FOUND for an unknown id', async () => {
    const { get } = setup();

    expectErr(await get.execute('22222222-2222-4222-8222-222222222222'), 'PRODUCT_NOT_FOUND');
  });

  it('AC-6: propagates a persistence failure', async () => {
    const { get, repository } = setup();
    repository.failWith = DomainErrors.persistence();

    expectErr(await get.execute(PRODUCT_ID), 'PERSISTENCE_ERROR');
  });
});

describe('GetProductStockUseCase', () => {
  it('AC-5: returns the stock resource', async () => {
    const { stock } = setup();

    expect(expectOk(await stock.execute(OTHER_ID))).toEqual({
      productId: OTHER_ID,
      stock: 0,
      updatedAt: '2026-10-01T00:00:00.000Z',
    });
  });

  it('AC-3: returns PRODUCT_NOT_FOUND for an unknown id', async () => {
    const { stock } = setup();

    expectErr(await stock.execute('22222222-2222-4222-8222-222222222222'), 'PRODUCT_NOT_FOUND');
  });

  it('AC-6: propagates a persistence failure', async () => {
    const { stock, repository } = setup();
    repository.failWith = DomainErrors.persistence();

    expectErr(await stock.execute(PRODUCT_ID), 'PERSISTENCE_ERROR');
  });
});
