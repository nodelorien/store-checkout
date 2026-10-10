import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { aProduct, PRODUCT_ID } from '../../../../../test/builders/product.builder';
import { InMemoryProductRepository } from '../../../../../test/fakes/in-memory-product.repository';
import { createHttpTestApp } from '../../../../../test/helpers/test-app';
import { DomainErrors } from '../../../../shared/errors/domain-error';
import { PRODUCT_REPOSITORY } from '../../application/ports/product-repository.port';
import { GetProductStockUseCase } from '../../application/use-cases/get-product-stock.use-case';
import { GetProductUseCase } from '../../application/use-cases/get-product.use-case';
import { ListProductsUseCase } from '../../application/use-cases/list-products.use-case';
import { ProductsController } from './products.controller';

const UNKNOWN_ID = '22222222-2222-4222-8222-222222222222';

describe('ProductsController', () => {
  let app: NestExpressApplication;
  let repository: InMemoryProductRepository;

  beforeEach(async () => {
    repository = new InMemoryProductRepository([aProduct().withStock(5).build()]);
    app = await createHttpTestApp({
      controllers: [ProductsController],
      providers: [
        { provide: PRODUCT_REPOSITORY, useValue: repository },
        ListProductsUseCase,
        GetProductUseCase,
        GetProductStockUseCase,
      ],
    });
  });

  afterEach(async () => {
    await app.close();
  });

  const get = (path: string) => request(app.getHttpServer()).get(`/api/v1/products${path}`);

  it('AC-1: GET /products answers 200 with the catalogue', async () => {
    const response = await get('').expect(200);

    expect(response.body).toEqual({
      data: [
        {
          id: PRODUCT_ID,
          name: 'Aurora Desk Lamp',
          description: 'Dimmable LED desk lamp',
          priceInCents: 12_990_000,
          currency: 'COP',
          imageUrl: '/images/products/aurora-desk-lamp.svg',
          stock: 5,
        },
      ],
    });
    expect(response.headers['cache-control']).toBe('max-age=0, must-revalidate');
  });

  it('AC-2: GET /products/:id answers 200 with the product', async () => {
    const response = await get(`/${PRODUCT_ID}`).expect(200);

    expect(response.body.data).toMatchObject({ id: PRODUCT_ID, stock: 5 });
  });

  it('AC-3: GET /products/:id answers 404 PRODUCT_NOT_FOUND', async () => {
    const response = await get(`/${UNKNOWN_ID}`).expect(404);

    expect(response.body.error).toMatchObject({ code: 'PRODUCT_NOT_FOUND', details: [] });
  });

  it('AC-3: GET /products/:id/stock answers 404 PRODUCT_NOT_FOUND', async () => {
    const response = await get(`/${UNKNOWN_ID}/stock`).expect(404);

    expect(response.body.error.code).toBe('PRODUCT_NOT_FOUND');
  });

  it('AC-4: answers 400 VALIDATION_ERROR for an id that is not a UUID', async () => {
    expect((await get('/not-a-uuid').expect(400)).body.error.code).toBe('VALIDATION_ERROR');
    expect((await get('/not-a-uuid/stock').expect(400)).body.error.code).toBe('VALIDATION_ERROR');
  });

  it('AC-5: GET /products/:id/stock answers 200 with the stock resource', async () => {
    const response = await get(`/${PRODUCT_ID}/stock`).expect(200);

    expect(response.body).toEqual({
      data: { productId: PRODUCT_ID, stock: 5, updatedAt: '2026-10-01T00:00:00.000Z' },
    });
  });

  it('AC-6: answers 500 PERSISTENCE_ERROR when the store fails', async () => {
    repository.failWith = DomainErrors.persistence('table missing');

    const response = await get('').expect(500);

    expect(response.body.error.code).toBe('PERSISTENCE_ERROR');
    expect(response.body.error.message).not.toContain('table');
  });

  it('documents the endpoints in OpenAPI', async () => {
    const response = await request(app.getHttpServer()).get('/api/docs-json').expect(200);

    expect(Object.keys(response.body.paths)).toEqual(
      expect.arrayContaining([
        '/api/v1/products',
        '/api/v1/products/{id}',
        '/api/v1/products/{id}/stock',
      ]),
    );
    expect(response.body.paths['/api/v1/products/{id}'].get.responses).toHaveProperty('404');
  });
});
