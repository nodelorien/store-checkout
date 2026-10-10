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
  it('AC-1: returns every product as a view, sorted by name', async () => {
    const { list } = setup();

    const views = expectOk(await list.execute());

    expect(views.map((view) => view.name)).toEqual(['Aurora Desk Lamp', 'Terra Backpack']);
    expect(views[0]).toEqual({
      id: PRODUCT_ID,
      name: 'Aurora Desk Lamp',
      description: 'Dimmable LED desk lamp',
      priceInCents: 12_990_000,
      currency: 'COP',
      imageUrl: '/images/products/aurora-desk-lamp.svg',
      stock: 5,
    });
  });

  it('AC-1: returns an empty list for an empty catalogue', async () => {
    const list = new ListProductsUseCase(new InMemoryProductRepository());

    expect(expectOk(await list.execute())).toEqual([]);
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
