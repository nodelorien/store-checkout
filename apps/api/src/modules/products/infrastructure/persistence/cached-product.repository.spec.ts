import { aProduct, PRODUCT_ID } from '../../../../../test/builders/product.builder';
import { InMemoryCache } from '../../../../../test/fakes/in-memory-cache';
import { InMemoryProductRepository } from '../../../../../test/fakes/in-memory-product.repository';
import { expectErr, expectOk } from '../../../../../test/helpers/result-assertions';
import { DomainErrors } from '../../../../shared/errors/domain-error';
import { CachedProductRepository } from './cached-product.repository';

const KEY = 'catalogue:test-products';

function setup() {
  const inner = new InMemoryProductRepository([aProduct().withStock(5).build()]);
  const findAll = jest.spyOn(inner, 'findAll');
  const cache = new InMemoryCache();
  const repository = new CachedProductRepository(inner, cache, {
    namespace: 'test-products',
    ttlSeconds: 60,
  });
  return { inner, findAll, cache, repository };
}

describe('CachedProductRepository', () => {
  it('AC-1: reads the store once and answers the same products from the cache', async () => {
    const { findAll, cache, repository } = setup();

    const first = expectOk(await repository.findAll());
    const second = expectOk(await repository.findAll());

    expect(findAll).toHaveBeenCalledTimes(1);
    expect(second.map((product) => product.toProps())).toEqual(
      first.map((product) => product.toProps()),
    );
    expect(second[0].stock).toBe(5);
    expect(cache.entries.get(KEY)?.ttlSeconds).toBe(60);
  });

  it('AC-2: after an invalidation the next read shows the stored stock', async () => {
    const { inner, findAll, cache, repository } = setup();
    expectOk(await repository.findAll());
    inner.setStock(PRODUCT_ID, 3);

    expect(expectOk(await repository.findAll())[0].stock).toBe(5);
    await repository.invalidate();

    expect(cache.deleted).toEqual([KEY]);
    expect(expectOk(await repository.findAll())[0].stock).toBe(3);
    expect(findAll).toHaveBeenCalledTimes(2);
  });

  it('AC-3: a failing store read is returned and not cached', async () => {
    const { inner, cache, repository } = setup();
    inner.failWith = DomainErrors.persistence();

    expectErr(await repository.findAll(), 'PERSISTENCE_ERROR');

    expect(cache.entries.size).toBe(0);
  });

  it('AC-5: an entry that is not a list is ignored', async () => {
    const { findAll, cache, repository } = setup();
    cache.entries.set(KEY, { value: '{"oops":true}', ttlSeconds: 60 });

    expect(expectOk(await repository.findAll())).toHaveLength(1);
    expect(findAll).toHaveBeenCalledTimes(1);
  });

  it('never caches a single product: the stock check before a charge reads the store', async () => {
    const { inner, cache, repository } = setup();
    const findById = jest.spyOn(inner, 'findById');

    expectOk(await repository.findById(PRODUCT_ID));
    inner.setStock(PRODUCT_ID, 0);

    expect(expectOk(await repository.findById(PRODUCT_ID)).stock).toBe(0);
    expect(findById).toHaveBeenCalledTimes(2);
    expect(cache.entries.size).toBe(0);
  });
});
