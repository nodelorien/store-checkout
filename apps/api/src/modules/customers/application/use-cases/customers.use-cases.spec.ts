import { aCustomer, CUSTOMER_ID } from '../../../../../test/builders/customer.builder';
import { FakeClock, FakeIdGenerator } from '../../../../../test/fakes/fake-system';
import { InMemoryCustomerRepository } from '../../../../../test/fakes/in-memory-customer.repository';
import { expectErr, expectOk } from '../../../../../test/helpers/result-assertions';
import { DomainErrors } from '../../../../shared/errors/domain-error';
import { GetCustomerUseCase } from './get-customer.use-case';
import { UpsertCustomerUseCase } from './upsert-customer.use-case';

const contact = { fullName: 'Grace Hopper', email: 'Grace@Example.com ', phone: '3005556677' };

function setup(existing = [aCustomer().build()]) {
  const repository = new InMemoryCustomerRepository(existing);
  return {
    repository,
    upsert: new UpsertCustomerUseCase(repository, new FakeClock(), new FakeIdGenerator()),
    get: new GetCustomerUseCase(repository),
  };
}

describe('UpsertCustomerUseCase', () => {
  it('AC-1: creates a customer for an unknown e-mail', async () => {
    const { upsert, repository } = setup();

    const output = expectOk(await upsert.execute(contact));

    expect(output).toEqual({
      created: true,
      customer: {
        id: '00000000-0000-4000-8000-000000000001',
        fullName: 'Grace Hopper',
        email: 'grace@example.com',
        phone: '3005556677',
        createdAt: '2026-10-09T15:00:00.000Z',
        updatedAt: '2026-10-09T15:00:00.000Z',
      },
    });
    expect(repository.items.size).toBe(2);
  });

  it('AC-2: updates the existing customer when the e-mail is known, whatever its casing', async () => {
    const { upsert, repository } = setup();

    const output = expectOk(
      await upsert.execute({
        fullName: 'Ada King',
        email: ' ADA@example.com',
        phone: '3110000000',
      }),
    );

    expect(output.created).toBe(false);
    expect(output.customer).toEqual({
      id: CUSTOMER_ID,
      fullName: 'Ada King',
      email: 'ada@example.com',
      phone: '3110000000',
      createdAt: '2026-10-01T00:00:00.000Z',
      updatedAt: '2026-10-09T15:00:00.000Z',
    });
    expect(repository.items.size).toBe(1);
  });

  it('AC-6: returns VALIDATION_ERROR for an invalid e-mail without touching the store', async () => {
    const { upsert, repository } = setup([]);

    expectErr(await upsert.execute({ ...contact, email: 'nope' }), 'VALIDATION_ERROR');
    expect(repository.items.size).toBe(0);
  });

  it('AC-6: returns VALIDATION_ERROR for an invalid name or phone (new and existing)', async () => {
    const { upsert, repository } = setup();

    expectErr(await upsert.execute({ ...contact, fullName: 'G' }), 'VALIDATION_ERROR');
    expectErr(
      await upsert.execute({ fullName: 'Ada', email: 'ada@example.com', phone: 'x' }),
      'VALIDATION_ERROR',
    );
    expect(repository.items.get(CUSTOMER_ID)?.phone).toBe('+573001234567');
  });

  it('AC-5: propagates a failure of the e-mail lookup', async () => {
    const { upsert, repository } = setup();
    repository.failWith = DomainErrors.persistence();

    expectErr(await upsert.execute(contact), 'PERSISTENCE_ERROR');
  });

  it('AC-5: propagates a failure of the save', async () => {
    const { upsert, repository } = setup();
    repository.failOnSave = DomainErrors.persistence();

    expectErr(await upsert.execute(contact), 'PERSISTENCE_ERROR');
  });
});

describe('GetCustomerUseCase', () => {
  it('AC-4: returns the customer view', async () => {
    const { get } = setup();

    expect(expectOk(await get.execute(CUSTOMER_ID))).toMatchObject({
      id: CUSTOMER_ID,
      email: 'ada@example.com',
    });
  });

  it('AC-4: returns CUSTOMER_NOT_FOUND for an unknown id', async () => {
    const { get } = setup();

    expectErr(await get.execute('nope'), 'CUSTOMER_NOT_FOUND');
  });

  it('AC-5: propagates a persistence failure', async () => {
    const { get, repository } = setup();
    repository.failWith = DomainErrors.persistence();

    expectErr(await get.execute(CUSTOMER_ID), 'PERSISTENCE_ERROR');
  });
});
