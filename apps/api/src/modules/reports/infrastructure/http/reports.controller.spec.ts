import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { aSalesRecord } from '../../../../../test/builders/sales-record.builder';
import { FakeClock } from '../../../../../test/fakes/fake-system';
import { InMemorySalesRecords } from '../../../../../test/fakes/in-memory-sales-records';
import { createHttpTestApp } from '../../../../../test/helpers/test-app';
import { DomainErrors } from '../../../../shared/errors/domain-error';
import { CLOCK } from '../../../../shared/ports/clock.port';
import { SALES_RECORDS_PORT } from '../../application/ports/sales-records.port';
import { GetSalesSummaryUseCase } from '../../application/use-cases/get-sales-summary.use-case';
import { ReportsController } from './reports.controller';

describe('ReportsController', () => {
  let app: NestExpressApplication;
  let records: InMemorySalesRecords;

  beforeEach(async () => {
    records = new InMemorySalesRecords([
      aSalesRecord({ createdAt: '2026-10-10T14:00:00.000Z', quantity: 2 }),
      aSalesRecord({ createdAt: '2026-10-09T14:00:00.000Z', status: 'DECLINED' }),
      aSalesRecord({ createdAt: '2026-09-30T14:00:00.000Z', cardBrand: 'MASTERCARD' }),
    ]);
    app = await createHttpTestApp({
      controllers: [ReportsController],
      providers: [
        { provide: SALES_RECORDS_PORT, useValue: records },
        { provide: CLOCK, useValue: new FakeClock('2026-10-10T15:00:00.000Z') },
        GetSalesSummaryUseCase,
      ],
    });
  });

  afterEach(async () => {
    await app.close();
  });

  const get = (query = '') => request(app.getHttpServer()).get(`/api/v1/reports/summary${query}`);

  it('AC-1: GET /reports/summary answers 200 with the 14-day summary, never cached', async () => {
    const response = await get().expect(200);

    expect(response.headers['cache-control']).toBe('no-store');
    expect(Object.keys(response.body)).toEqual(['data']);
    expect(response.body.data).toMatchObject({
      currency: 'COP',
      range: { from: '2026-09-27', to: '2026-10-10', days: 14 },
      totals: {
        revenueInCents: 28_080_000,
        approvedOrders: 2,
        unitsSold: 3,
        averageOrderInCents: 14_040_000,
        totalAttempts: 3,
        approvalRate: 0.6667,
      },
      topProducts: [
        {
          productId: '6f1d2c3b-4a5e-4f60-8a7b-9c0d1e2f3a4b',
          name: 'Aurora Desk Lamp',
          unitsSold: 3,
          revenueInCents: 28_080_000,
        },
      ],
      payments: {
        byStatus: [
          { status: 'APPROVED', count: 2 },
          { status: 'DECLINED', count: 1 },
          { status: 'ERROR', count: 0 },
          { status: 'VOIDED', count: 0 },
          { status: 'PENDING', count: 0 },
        ],
        byCardBrand: [
          { brand: 'VISA', attempts: 2, approved: 1 },
          { brand: 'MASTERCARD', attempts: 1, approved: 1 },
        ],
      },
      generatedAt: '2026-10-10T15:00:00.000Z',
    });
    expect(response.body.data.salesByDay).toHaveLength(14);
    expect(response.body.data.salesByDay[0]).toEqual({
      date: '2026-09-27',
      revenueInCents: 0,
      orders: 0,
    });
    expect(response.body.data.salesByDay[13]).toEqual({
      date: '2026-10-10',
      revenueInCents: 14_040_000,
      orders: 1,
    });
  });

  it('AC-2: honours ?days', async () => {
    const response = await get('?days=2').expect(200);

    expect(response.body.data.range).toEqual({ from: '2026-10-09', to: '2026-10-10', days: 2 });
    expect(response.body.data.totals.totalAttempts).toBe(2);
    expect(records.requestedSince).toEqual(['2026-10-09T05:00:00.000Z']);
    await get('?days=1').expect(200);
    await get('?days=90').expect(200);
  });

  it.each([
    ['days=0', 'days'],
    ['days=91', 'days'],
    ['days=abc', 'days'],
    ['days=1.5', 'days'],
    ['days=', 'days'],
    ['days=7&from=2026-01-01', 'from'],
    ['customerId=1', 'customerId'],
  ])('AC-9: answers 400 VALIDATION_ERROR for ?%s', async (query, field) => {
    const response = await get(`?${query}`).expect(400);

    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.details[0].field).toBe(field);
    expect(response.headers['cache-control']).toBe('no-store');
  });

  it('AC-10: answers 500 PERSISTENCE_ERROR when the store fails, without internals', async () => {
    records.failWith = DomainErrors.persistence('DynamoDB request failed: table missing');

    const response = await get().expect(500);

    expect(response.body.error.code).toBe('PERSISTENCE_ERROR');
    expect(response.body.error.message).not.toContain('table');
  });

  it('AC-8: the payload carries no personal or per-order data', async () => {
    const text = (await get().expect(200)).text;

    expect(text).not.toMatch(/customer|email|phone|fullName|address|reference|lastFour|"id"/i);
  });

  it('documents the endpoint in OpenAPI', async () => {
    const response = await request(app.getHttpServer()).get('/api/docs-json').expect(200);

    const operation = response.body.paths['/api/v1/reports/summary'].get;
    expect(operation.parameters).toEqual([
      expect.objectContaining({ name: 'days', in: 'query', required: false }),
    ]);
    expect(Object.keys(operation.responses)).toEqual(['200', '400', '429', '500']);
    expect(
      Object.keys(response.body.components.schemas.SalesSummaryResponseDto.properties),
    ).toEqual([
      'currency',
      'range',
      'totals',
      'salesByDay',
      'topProducts',
      'payments',
      'generatedAt',
    ]);
  });
});
