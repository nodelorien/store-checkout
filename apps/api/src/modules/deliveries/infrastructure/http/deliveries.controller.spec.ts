import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import {
  aDelivery,
  AN_ADDRESS,
  DELIVERY_ID,
  TRANSACTION_ID,
} from '../../../../../test/builders/transaction.builder';
import { FakeClock } from '../../../../../test/fakes/fake-system';
import { InMemoryDeliveryRepository } from '../../../../../test/fakes/in-memory-delivery.repository';
import { createHttpTestApp } from '../../../../../test/helpers/test-app';
import { DomainErrors } from '../../../../shared/errors/domain-error';
import { CLOCK } from '../../../../shared/ports/clock.port';
import { DELIVERY_REPOSITORY } from '../../application/ports/delivery-repository.port';
import { GetDeliveryByTransactionUseCase } from '../../application/use-cases/get-delivery-by-transaction.use-case';
import { GetDeliveryUseCase } from '../../application/use-cases/get-delivery.use-case';
import { UpdateDeliveryAddressUseCase } from '../../application/use-cases/update-delivery-address.use-case';
import { DeliveriesController } from './deliveries.controller';

const UNKNOWN_ID = '22222222-2222-4222-8222-222222222222';

describe('DeliveriesController', () => {
  let app: NestExpressApplication;
  let repository: InMemoryDeliveryRepository;

  beforeEach(async () => {
    repository = new InMemoryDeliveryRepository();
    repository.seed(aDelivery().build());
    app = await createHttpTestApp({
      controllers: [DeliveriesController],
      providers: [
        { provide: DELIVERY_REPOSITORY, useValue: repository },
        { provide: CLOCK, useValue: new FakeClock('2026-10-09T16:00:00.000Z') },
        GetDeliveryUseCase,
        GetDeliveryByTransactionUseCase,
        UpdateDeliveryAddressUseCase,
      ],
    });
  });

  afterEach(async () => {
    await app.close();
  });

  const server = () => request(app.getHttpServer());
  const patch = (id: string, payload: object) =>
    server().patch(`/api/v1/deliveries/${id}`).send(payload);

  it('AC-1: GET /deliveries/:id answers 200 with the delivery', async () => {
    const response = await server().get(`/api/v1/deliveries/${DELIVERY_ID}`).expect(200);

    expect(response.body).toEqual({
      data: {
        id: DELIVERY_ID,
        transactionId: TRANSACTION_ID,
        customerId: 'c0ffee00-0000-4000-8000-00000000c001',
        productId: '6f1d2c3b-4a5e-4f60-8a7b-9c0d1e2f3a4b',
        quantity: 2,
        address: AN_ADDRESS,
        status: 'PENDING',
        createdAt: '2026-10-09T15:00:05.000Z',
        updatedAt: '2026-10-09T15:00:05.000Z',
      },
    });
  });

  it('AC-1: answers 404 DELIVERY_NOT_FOUND and 400 for a non-UUID id', async () => {
    const missing = await server().get(`/api/v1/deliveries/${UNKNOWN_ID}`).expect(404);
    const invalid = await server().get('/api/v1/deliveries/abc').expect(400);

    expect(missing.body.error.code).toBe('DELIVERY_NOT_FOUND');
    expect(invalid.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('AC-2: GET /transactions/:id/delivery answers 200 with the delivery', async () => {
    const response = await server()
      .get(`/api/v1/transactions/${TRANSACTION_ID}/delivery`)
      .expect(200);

    expect(response.body.data.id).toBe(DELIVERY_ID);
  });

  it('AC-2: GET /transactions/:id/delivery answers 404 when there is no delivery', async () => {
    const response = await server().get(`/api/v1/transactions/${UNKNOWN_ID}/delivery`).expect(404);

    expect(response.body.error.code).toBe('DELIVERY_NOT_FOUND');
    await server().get('/api/v1/transactions/abc/delivery').expect(400);
  });

  it('AC-3: PATCH /deliveries/:id merges the sent fields', async () => {
    const response = await patch(DELIVERY_ID, { city: 'Medellín', region: 'Antioquia' }).expect(
      200,
    );

    expect(response.body.data.address).toEqual({
      ...AN_ADDRESS,
      city: 'Medellín',
      region: 'Antioquia',
    });
    expect(response.body.data.updatedAt).toBe('2026-10-09T16:00:00.000Z');
  });

  it('AC-4: PATCH answers 409 DELIVERY_NOT_EDITABLE once shipped', async () => {
    repository.seed(aDelivery().with({ status: 'SHIPPED' }).build());

    const response = await patch(DELIVERY_ID, { city: 'Cali' }).expect(409);

    expect(response.body.error.code).toBe('DELIVERY_NOT_EDITABLE');
  });

  it.each([
    ['an empty body', {}, 'address'],
    ['a short addressLine1', { addressLine1: 'x' }, 'addressLine1'],
    ['another country', { country: 'US' }, 'country'],
    ['a bad postal code', { postalCode: '1' }, 'postalCode'],
    ['a non-address property', { status: 'DELIVERED' }, 'status'],
    ['a non-string city', { city: 5 }, 'city'],
  ])('AC-5: PATCH answers 400 VALIDATION_ERROR for %s', async (_name, payload, field) => {
    const response = await patch(DELIVERY_ID, payload).expect(400);

    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.details.map((detail: { field: string }) => detail.field)).toContain(
      field,
    );
    expect(repository.items.get(DELIVERY_ID)?.status).toBe('PENDING');
  });

  it('AC-1: PATCH answers 404 for an unknown delivery', async () => {
    const response = await patch(UNKNOWN_ID, { city: 'Cali' }).expect(404);

    expect(response.body.error.code).toBe('DELIVERY_NOT_FOUND');
  });

  it('AC-6: answers 500 PERSISTENCE_ERROR when the store fails', async () => {
    repository.failWith = DomainErrors.persistence();

    const response = await server().get(`/api/v1/deliveries/${DELIVERY_ID}`).expect(500);

    expect(response.body.error.code).toBe('PERSISTENCE_ERROR');
  });

  it('AC-7: marks delivery responses as no-store', async () => {
    const byId = await server().get(`/api/v1/deliveries/${DELIVERY_ID}`);
    const byTransaction = await server().get(`/api/v1/transactions/${TRANSACTION_ID}/delivery`);

    expect(byId.headers['cache-control']).toBe('no-store');
    expect(byTransaction.headers['cache-control']).toBe('no-store');
  });
});
