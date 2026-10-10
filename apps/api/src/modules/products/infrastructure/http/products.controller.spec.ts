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
      meta: { page: 1, pageSize: 1, total: 1, totalPages: 1 },
    });
    expect(response.headers['cache-control']).toBe('max-age=0, must-revalidate');
  });

  describe('catalogue query', () => {
    const OTHER = (n: number): string => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

    beforeEach(() => {
      const add = (n: number, name: string, priceInCents: number, description: string): void => {
        const product = aProduct()
          .withId(OTHER(n))
          .with({ name, priceInCents, description })
          .build();
        repository.items.set(product.id, product);
      };
      add(1, 'Terra Backpack', 24_990_000, 'Backpack with a laptop sleeve');
      add(2, 'Nimbus Headphones', 45_990_000, 'Wireless headphones');
      add(3, 'Prism Monitor', 9_990_000, 'Display for any LAPTOP');
    });

    const namesOf = (body: { data: { name: string }[] }): string[] =>
      body.data.map((product) => product.name);

    it('AC-2: pages the catalogue and reports the meta', async () => {
      const response = await get('?page=2&pageSize=3').expect(200);

      expect(namesOf(response.body)).toEqual(['Terra Backpack']);
      expect(response.body.meta).toEqual({ page: 2, pageSize: 3, total: 4, totalPages: 2 });
      expect(response.headers['cache-control']).toBe('max-age=0, must-revalidate');
    });

    it('AC-3: searches name and description, case-insensitively, after trimming', async () => {
      const response = await get('?search=%20%20laptop%20').expect(200);

      expect(namesOf(response.body)).toEqual(['Prism Monitor', 'Terra Backpack']);
      expect(response.body.meta).toEqual({ page: 1, pageSize: 2, total: 2, totalPages: 1 });
    });

    it('AC-3: an empty search does not filter', async () => {
      expect((await get('?search=').expect(200)).body.meta.total).toBe(4);
    });

    it('AC-4: the default order is by name; featured is the curated order of the seed', async () => {
      const plain = namesOf((await get('').expect(200)).body);

      expect(plain).toEqual([
        'Aurora Desk Lamp',
        'Nimbus Headphones',
        'Prism Monitor',
        'Terra Backpack',
      ]);
      expect(namesOf((await get('?sort=name').expect(200)).body)).toEqual(plain);

      const featured = (await get('?sort=featured').expect(200)).body as {
        data: { id: string }[];
      };
      const ids = featured.data.map((product) => product.id);
      expect(ids).toEqual([...ids].sort((a, b) => a.localeCompare(b)));
      expect(ids).toHaveLength(plain.length);
    });

    it('AC-5: sorts by price in both directions', async () => {
      expect(namesOf((await get('?sort=price-asc').expect(200)).body)).toEqual([
        'Prism Monitor',
        'Aurora Desk Lamp',
        'Terra Backpack',
        'Nimbus Headphones',
      ]);
      expect(namesOf((await get('?sort=price-desc&pageSize=1').expect(200)).body)).toEqual([
        'Nimbus Headphones',
      ]);
    });

    it('AC-6: a page beyond the last one answers 200 with an empty list', async () => {
      const response = await get('?page=7&pageSize=2').expect(200);

      expect(response.body).toEqual({
        data: [],
        meta: { page: 7, pageSize: 2, total: 4, totalPages: 2 },
      });
    });

    it.each([
      ['page=0', 'page'],
      ['page=abc', 'page'],
      ['page=1.5', 'page'],
      ['page=', 'page'],
      ['pageSize=0', 'pageSize'],
      ['pageSize=49', 'pageSize'],
      ['pageSize=ten', 'pageSize'],
      ['sort=cheapest', 'sort'],
      ['sort=', 'sort'],
      [`search=${'x'.repeat(61)}`, 'search'],
      ['search=a&search=b', 'search'],
      ['category=audio', 'category'],
    ])('AC-7: answers 400 VALIDATION_ERROR for ?%s', async (query, field) => {
      const response = await get(`?${query}`).expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.details[0].field).toBe(field);
    });

    it('AC-7: accepts the limits pageSize=48 and a 60-character search', async () => {
      await get(`?pageSize=48&search=${'x'.repeat(60)}`).expect(200);
    });
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

    const list = response.body.paths['/api/v1/products'].get;
    expect(list.parameters.map((parameter: { name: string }) => parameter.name).sort()).toEqual([
      'page',
      'pageSize',
      'search',
      'sort',
    ]);
    expect(list.parameters.every((parameter: { required: boolean }) => !parameter.required)).toBe(
      true,
    );
    expect(list.responses).toHaveProperty('400');
    expect(list.responses['200'].content['application/json'].schema.required).toEqual([
      'data',
      'meta',
    ]);
  });
});
