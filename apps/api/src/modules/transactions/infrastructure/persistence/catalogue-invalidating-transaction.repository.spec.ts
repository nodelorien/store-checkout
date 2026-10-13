import { aProduct, PRODUCT_ID } from '../../../../../test/builders/product.builder';
import {
  aDelivery,
  aTransaction,
  TRANSACTION_ID,
} from '../../../../../test/builders/transaction.builder';
import { InMemoryProductRepository } from '../../../../../test/fakes/in-memory-product.repository';
import { InMemoryTransactionRepository } from '../../../../../test/fakes/in-memory-transaction.repository';
import { expectErr, expectOk } from '../../../../../test/helpers/result-assertions';
import { CatalogueInvalidatingTransactionRepository } from './catalogue-invalidating-transaction.repository';

function setup(stock = 5) {
  const products = new InMemoryProductRepository([aProduct().withStock(stock).build()]);
  const inner = new InMemoryTransactionRepository(products);
  const catalogue = { invalidate: jest.fn(async () => undefined) };
  const repository = new CatalogueInvalidatingTransactionRepository(inner, catalogue);
  return { products, inner, catalogue, repository };
}

describe('CatalogueInvalidatingTransactionRepository', () => {
  it('AC-2: invalidates the catalogue once the approval has changed stock', async () => {
    const { products, inner, catalogue, repository } = setup();
    inner.seed(aTransaction().build());

    const outcome = await repository.resolveApproved(
      aTransaction().approved().build(),
      aDelivery().build(),
    );

    expect(expectOk(outcome)).toBe('APPLIED');
    expect(products.stockOf(PRODUCT_ID)).toBe(3);
    expect(catalogue.invalidate).toHaveBeenCalledTimes(1);
  });

  it('AC-2: an approval that was already resolved invalidates nothing', async () => {
    const { inner, catalogue, repository } = setup();
    inner.seed(aTransaction().approved().build());

    const outcome = await repository.resolveApproved(
      aTransaction().approved().build(),
      aDelivery().build(),
    );

    expect(expectOk(outcome)).toBe('ALREADY_RESOLVED');
    expect(catalogue.invalidate).not.toHaveBeenCalled();
  });

  it('AC-2: an approval that found no stock invalidates nothing', async () => {
    const { inner, catalogue, repository } = setup(1);
    inner.seed(aTransaction().build());

    const outcome = await repository.resolveApproved(
      aTransaction().approved().build(),
      aDelivery().build(),
    );

    expect(expectOk(outcome)).toBe('OUT_OF_STOCK');
    expect(catalogue.invalidate).not.toHaveBeenCalled();
  });

  it('AC-2: a failed write invalidates nothing', async () => {
    const { inner, catalogue, repository } = setup();
    inner.seed(aTransaction().build());
    inner.failOn('resolveApproved');

    expectErr(
      await repository.resolveApproved(aTransaction().approved().build(), aDelivery().build()),
      'PERSISTENCE_ERROR',
    );
    expect(catalogue.invalidate).not.toHaveBeenCalled();
  });

  it('AC-2: a declined payment leaves the catalogue alone', async () => {
    const { inner, catalogue, repository } = setup();
    inner.seed(aTransaction().build());

    expect(expectOk(await repository.resolveFailed(aTransaction().declined().build()))).toBe(
      'APPLIED',
    );
    expect(catalogue.invalidate).not.toHaveBeenCalled();
  });

  it('passes every other operation straight through', async () => {
    const { inner, catalogue, repository } = setup();
    const transaction = aTransaction().build();

    expect(expectOk(await repository.create(transaction, 'key-12345678'))).toBe('CREATED');
    expect(expectOk(await repository.create(transaction, 'key-12345678'))).toBe('DUPLICATE_KEY');
    expect(expectOk(await repository.findById(TRANSACTION_ID)).id).toBe(TRANSACTION_ID);
    expect(expectOk(await repository.findByIdempotencyKey('key-12345678'))?.id).toBe(
      TRANSACTION_ID,
    );
    expect(expectOk(await repository.findByReference(transaction.reference))?.id).toBe(
      TRANSACTION_ID,
    );
    expectOk(await repository.attachGatewayId(TRANSACTION_ID, 'gw-9', '2026-10-09T15:00:01.000Z'));

    expect(inner.only().toProps().gatewayTransactionId).toBe('gw-9');
    expect(catalogue.invalidate).not.toHaveBeenCalled();
  });
});
