import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { aCustomer, CUSTOMER_ID } from '../../../../../test/builders/customer.builder';
import { FakeClock, FakeIdGenerator } from '../../../../../test/fakes/fake-system';
import { InMemoryCustomerRepository } from '../../../../../test/fakes/in-memory-customer.repository';
import { createHttpTestApp } from '../../../../../test/helpers/test-app';
import { DomainErrors } from '../../../../shared/errors/domain-error';
import { CLOCK } from '../../../../shared/ports/clock.port';
import { ID_GENERATOR } from '../../../../shared/ports/id-generator.port';
import { CUSTOMER_REPOSITORY } from '../../application/ports/customer-repository.port';
import { GetCustomerUseCase } from '../../application/use-cases/get-customer.use-case';
import { UpsertCustomerUseCase } from '../../application/use-cases/upsert-customer.use-case';
import { CustomersController } from './customers.controller';

const body = { fullName: 'Grace Hopper', email: 'Grace@Example.com', phone: '+573005556677' };

describe('CustomersController', () => {
  let app: NestExpressApplication;
  let repository: InMemoryCustomerRepository;

  beforeEach(async () => {
    repository = new InMemoryCustomerRepository([aCustomer().build()]);
    app = await createHttpTestApp({
      controllers: [CustomersController],
      providers: [
        { provide: CUSTOMER_REPOSITORY, useValue: repository },
        { provide: CLOCK, useValue: new FakeClock() },
        { provide: ID_GENERATOR, useValue: new FakeIdGenerator() },
        UpsertCustomerUseCase,
        GetCustomerUseCase,
      ],
    });
  });

  afterEach(async () => {
    await app.close();
  });

  const put = (payload: object) =>
    request(app.getHttpServer()).put('/api/v1/customers').send(payload);

  it('AC-1: PUT /customers answers 201 when the customer is created', async () => {
    const response = await put(body).expect(201);

    expect(response.body).toEqual({
      data: {
        id: '00000000-0000-4000-8000-000000000001',
        fullName: 'Grace Hopper',
        email: 'grace@example.com',
        phone: '+573005556677',
        createdAt: '2026-10-09T15:00:00.000Z',
        updatedAt: '2026-10-09T15:00:00.000Z',
      },
    });
  });

  it('AC-2: PUT /customers answers 200 with the same id when the e-mail is known', async () => {
    const response = await put({ ...body, email: 'ADA@example.com' }).expect(200);

    expect(response.body.data).toMatchObject({
      id: CUSTOMER_ID,
      fullName: 'Grace Hopper',
      createdAt: '2026-10-01T00:00:00.000Z',
    });
  });

  it('AC-2: trims string fields before validating', async () => {
    const response = await put({
      fullName: '  Grace Hopper ',
      email: ' grace@example.com ',
      phone: ' +573005556677 ',
    }).expect(201);

    expect(response.body.data).toMatchObject({ fullName: 'Grace Hopper', phone: '+573005556677' });
  });

  it.each([
    ['email', { ...body, email: 'not-an-email' }],
    ['phone', { ...body, phone: '300-555' }],
    ['fullName', { ...body, fullName: 'Al' }],
    ['fullName', { ...body, fullName: 'x'.repeat(101) }],
    ['fullName', { ...body, fullName: 42 }],
    ['cardNumber', { ...body, cardNumber: '4242424242424242' }],
  ])('AC-3: answers 400 VALIDATION_ERROR for an invalid %s', async (field, payload) => {
    const response = await put(payload).expect(400);

    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.details.map((detail: { field: string }) => detail.field)).toContain(
      field,
    );
  });

  it('AC-3: answers 400 for an empty body', async () => {
    const response = await put({}).expect(400);

    expect(response.body.error.details.length).toBeGreaterThanOrEqual(3);
  });

  it('AC-4: GET /customers/:id answers 200 with the customer', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/customers/${CUSTOMER_ID}`)
      .expect(200);

    expect(response.body.data).toMatchObject({ id: CUSTOMER_ID, email: 'ada@example.com' });
  });

  it('AC-4: GET /customers/:id answers 404 for an unknown id and 400 for a non-UUID', async () => {
    const server = app.getHttpServer();
    const missing = await request(server)
      .get('/api/v1/customers/22222222-2222-4222-8222-222222222222')
      .expect(404);
    const invalid = await request(server).get('/api/v1/customers/abc').expect(400);

    expect(missing.body.error.code).toBe('CUSTOMER_NOT_FOUND');
    expect(invalid.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('AC-5: answers 500 PERSISTENCE_ERROR when the store fails', async () => {
    repository.failWith = DomainErrors.persistence();

    expect((await put(body).expect(500)).body.error.code).toBe('PERSISTENCE_ERROR');
  });

  it('AC-7: marks customer responses as no-store', async () => {
    const response = await put(body);

    expect(response.headers['cache-control']).toBe('no-store');
  });
});
