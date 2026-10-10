import {
  aDelivery,
  AN_ADDRESS,
  DELIVERY_ID,
  TRANSACTION_ID,
} from '../../../../../test/builders/transaction.builder';
import { FakeClock } from '../../../../../test/fakes/fake-system';
import { InMemoryDeliveryRepository } from '../../../../../test/fakes/in-memory-delivery.repository';
import { expectErr, expectOk } from '../../../../../test/helpers/result-assertions';
import { DomainErrors } from '../../../../shared/errors/domain-error';
import { GetDeliveryByTransactionUseCase } from './get-delivery-by-transaction.use-case';
import { GetDeliveryUseCase } from './get-delivery.use-case';
import { UpdateDeliveryAddressUseCase } from './update-delivery-address.use-case';

function setup(delivery = aDelivery().build()) {
  const repository = new InMemoryDeliveryRepository();
  repository.seed(delivery);
  return {
    repository,
    get: new GetDeliveryUseCase(repository),
    getByTransaction: new GetDeliveryByTransactionUseCase(repository),
    update: new UpdateDeliveryAddressUseCase(repository, new FakeClock('2026-10-09T16:00:00.000Z')),
  };
}

describe('GetDeliveryUseCase', () => {
  it('AC-1: returns the delivery view', async () => {
    const { get } = setup();

    expect(expectOk(await get.execute(DELIVERY_ID))).toEqual({
      id: DELIVERY_ID,
      transactionId: TRANSACTION_ID,
      customerId: 'c0ffee00-0000-4000-8000-00000000c001',
      productId: '6f1d2c3b-4a5e-4f60-8a7b-9c0d1e2f3a4b',
      quantity: 2,
      address: AN_ADDRESS,
      status: 'PENDING',
      createdAt: '2026-10-09T15:00:05.000Z',
      updatedAt: '2026-10-09T15:00:05.000Z',
    });
  });

  it('AC-1: renders absent optional address fields as null', async () => {
    const { get } = setup(
      aDelivery()
        .with({
          address: { addressLine1: 'Cra 7 # 71-21', city: 'Bogotá', region: 'DC', country: 'CO' },
        })
        .build(),
    );

    expect(expectOk(await get.execute(DELIVERY_ID)).address).toMatchObject({
      addressLine2: null,
      postalCode: null,
    });
  });

  it('AC-1: returns DELIVERY_NOT_FOUND for an unknown id', async () => {
    const { get } = setup();

    expectErr(await get.execute('nope'), 'DELIVERY_NOT_FOUND');
  });

  it('AC-6: propagates a persistence failure', async () => {
    const { get, repository } = setup();
    repository.failWith = DomainErrors.persistence();

    expectErr(await get.execute(DELIVERY_ID), 'PERSISTENCE_ERROR');
  });
});

describe('GetDeliveryByTransactionUseCase', () => {
  it('AC-2: returns the delivery of the transaction', async () => {
    const { getByTransaction } = setup();

    expect(expectOk(await getByTransaction.execute(TRANSACTION_ID)).id).toBe(DELIVERY_ID);
  });

  it('AC-2: returns DELIVERY_NOT_FOUND when the transaction has no delivery', async () => {
    const { getByTransaction } = setup();

    expectErr(await getByTransaction.execute('other-transaction'), 'DELIVERY_NOT_FOUND');
  });

  it('AC-6: propagates a persistence failure', async () => {
    const { getByTransaction, repository } = setup();
    repository.failWith = DomainErrors.persistence();

    expectErr(await getByTransaction.execute(TRANSACTION_ID), 'PERSISTENCE_ERROR');
  });
});

describe('UpdateDeliveryAddressUseCase', () => {
  it('AC-3: merges the sent fields into the address and stores it', async () => {
    const { update, repository } = setup();

    const view = expectOk(
      await update.execute(DELIVERY_ID, { city: ' Medellín ', region: 'Antioquia' }),
    );

    expect(view.address).toEqual({ ...AN_ADDRESS, city: 'Medellín', region: 'Antioquia' });
    expect(view.updatedAt).toBe('2026-10-09T16:00:00.000Z');
    expect(view.createdAt).toBe('2026-10-09T15:00:05.000Z');
    expect(repository.items.get(DELIVERY_ID)?.address.city).toBe('Medellín');
  });

  it('AC-3: removes addressLine2 when it is sent empty', async () => {
    const { update } = setup();

    const view = expectOk(await update.execute(DELIVERY_ID, { addressLine2: '' }));

    expect(view.address.addressLine2).toBeNull();
    expect(view.address.addressLine1).toBe('Cra 7 # 71-21');
  });

  it.each(['SHIPPED', 'DELIVERED'] as const)(
    'AC-4: returns DELIVERY_NOT_EDITABLE for a %s delivery',
    async (status) => {
      const { update, repository } = setup(aDelivery().with({ status }).build());

      expectErr(await update.execute(DELIVERY_ID, { city: 'Cali' }), 'DELIVERY_NOT_EDITABLE');
      expect(repository.items.get(DELIVERY_ID)?.address.city).toBe('Bogotá');
    },
  );

  it('AC-4: returns DELIVERY_NOT_EDITABLE when the delivery ships between read and write', async () => {
    const { update, repository } = setup();
    repository.beforeUpdate = () =>
      repository.seed(aDelivery().with({ status: 'SHIPPED' }).build());

    expectErr(await update.execute(DELIVERY_ID, { city: 'Cali' }), 'DELIVERY_NOT_EDITABLE');
  });

  it('AC-5: returns VALIDATION_ERROR for an empty patch without reading the store', async () => {
    const { update, repository } = setup();
    repository.failWith = DomainErrors.persistence();

    const error = expectErr(await update.execute(DELIVERY_ID, {}), 'VALIDATION_ERROR');

    expect(error.details).toEqual([
      { field: 'address', message: 'at least one address field is required' },
    ]);
  });

  it('AC-5: ignores properties that are not address fields', async () => {
    const { update } = setup();
    const patch = { status: 'DELIVERED', quantity: 99 } as unknown as { city?: string };

    expectErr(await update.execute(DELIVERY_ID, patch), 'VALIDATION_ERROR');
  });

  it('AC-5: validates the merged address in the domain', async () => {
    const { update } = setup();

    const error = expectErr(
      await update.execute(DELIVERY_ID, { country: 'US', city: 'X' }),
      'VALIDATION_ERROR',
    );

    expect(error.details.map((detail) => detail.field)).toEqual([
      'address.city',
      'address.country',
    ]);
  });

  it('AC-1: returns DELIVERY_NOT_FOUND for an unknown id', async () => {
    const { update } = setup();

    expectErr(await update.execute('nope', { city: 'Cali' }), 'DELIVERY_NOT_FOUND');
  });

  it('AC-6: propagates a persistence failure', async () => {
    const { update, repository } = setup();
    repository.failWith = DomainErrors.persistence();

    expectErr(await update.execute(DELIVERY_ID, { city: 'Cali' }), 'PERSISTENCE_ERROR');
  });
});
