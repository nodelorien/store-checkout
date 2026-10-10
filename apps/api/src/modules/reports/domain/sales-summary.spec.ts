import { aSalesRecord } from '../../../../test/builders/sales-record.builder';
import { expectOk } from '../../../../test/helpers/result-assertions';
import { ReportRange } from './report-range';
import { SalesRecord, summarizeSales } from './sales-summary';

const NOW = new Date('2026-10-10T15:00:00.000Z');
const P = (n: number): string => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const summarize = (records: SalesRecord[], days = 3, now = NOW) =>
  summarizeSales(records, expectOk(ReportRange.create(days, now)), now);

/** Noon in Bogota on the given October 2026 day. */
const on = (day: number): string => `2026-10-${String(day).padStart(2, '0')}T17:00:00.000Z`;

describe('summarizeSales', () => {
  it('AC-1: an empty range is a complete, zero-filled summary', () => {
    expect(summarize([])).toEqual({
      currency: 'COP',
      range: { from: '2026-10-08', to: '2026-10-10', days: 3 },
      totals: {
        revenueInCents: 0,
        approvedOrders: 0,
        unitsSold: 0,
        averageOrderInCents: 0,
        totalAttempts: 0,
        approvalRate: 0,
      },
      salesByDay: [
        { date: '2026-10-08', revenueInCents: 0, orders: 0 },
        { date: '2026-10-09', revenueInCents: 0, orders: 0 },
        { date: '2026-10-10', revenueInCents: 0, orders: 0 },
      ],
      topProducts: [],
      payments: {
        byStatus: [
          { status: 'APPROVED', count: 0 },
          { status: 'DECLINED', count: 0 },
          { status: 'ERROR', count: 0 },
          { status: 'VOIDED', count: 0 },
          { status: 'PENDING', count: 0 },
        ],
        byCardBrand: [
          { brand: 'VISA', attempts: 0, approved: 0 },
          { brand: 'MASTERCARD', attempts: 0, approved: 0 },
        ],
      },
      generatedAt: '2026-10-10T15:00:00.000Z',
    });
  });

  it('AC-3: revenue, orders and units count APPROVED transactions only', () => {
    const summary = summarize([
      aSalesRecord({ totalInCents: 10_000_000, quantity: 2, createdAt: on(9) }),
      aSalesRecord({ totalInCents: 5_000_001, quantity: 1, createdAt: on(10) }),
      aSalesRecord({ status: 'DECLINED', totalInCents: 99_000_000, quantity: 9 }),
      aSalesRecord({ status: 'ERROR', totalInCents: 99_000_000, quantity: 9 }),
      aSalesRecord({ status: 'VOIDED', totalInCents: 99_000_000, quantity: 9 }),
      aSalesRecord({ status: 'PENDING', totalInCents: 99_000_000, quantity: 9 }),
    ]);

    expect(summary.totals).toEqual({
      revenueInCents: 15_000_001,
      approvedOrders: 2,
      unitsSold: 3,
      averageOrderInCents: 7_500_001, // round(7 500 000.5)
      totalAttempts: 6,
      approvalRate: 0.4, // 2 / (2 + 1 + 1 + 1); PENDING left out
    });
  });

  it('AC-3: averageOrderInCents rounds to the nearest cent', () => {
    const summary = summarize([
      aSalesRecord({ totalInCents: 100 }),
      aSalesRecord({ totalInCents: 100 }),
      aSalesRecord({ totalInCents: 101 }),
    ]);

    expect(summary.totals.averageOrderInCents).toBe(100); // 100.33…
  });

  it('AC-3: approvalRate is rounded to 4 decimals', () => {
    const records = [
      aSalesRecord(),
      aSalesRecord({ status: 'DECLINED' }),
      aSalesRecord({ status: 'DECLINED' }),
    ];

    expect(summarize(records).totals.approvalRate).toBe(0.3333);
    expect(summarize([...records, aSalesRecord()]).totals.approvalRate).toBe(0.5);
    expect(summarize([aSalesRecord(), aSalesRecord()]).totals.approvalRate).toBe(1);
    expect(
      summarize([aSalesRecord(), aSalesRecord(), aSalesRecord({ status: 'ERROR' })]).totals
        .approvalRate,
    ).toBe(0.6667);
  });

  it('AC-3: approvalRate is 0 when nothing has been resolved yet', () => {
    const summary = summarize([
      aSalesRecord({ status: 'PENDING' }),
      aSalesRecord({ status: 'PENDING' }),
    ]);

    expect(summary.totals).toMatchObject({ totalAttempts: 2, approvalRate: 0, approvedOrders: 0 });
  });

  it('AC-4: salesByDay has every day, oldest first, with approved sales on their Bogota day', () => {
    const summary = summarize([
      // 23:59 Bogota on the 8th and 00:00 Bogota on the 9th.
      aSalesRecord({ totalInCents: 1_000, createdAt: '2026-10-09T04:59:59.999Z' }),
      aSalesRecord({ totalInCents: 2_000, createdAt: '2026-10-09T05:00:00.000Z' }),
      aSalesRecord({ totalInCents: 4_000, createdAt: on(9) }),
      aSalesRecord({ status: 'DECLINED', totalInCents: 8_000, createdAt: on(9) }),
    ]);

    expect(summary.salesByDay).toEqual([
      { date: '2026-10-08', revenueInCents: 1_000, orders: 1 },
      { date: '2026-10-09', revenueInCents: 6_000, orders: 2 },
      { date: '2026-10-10', revenueInCents: 0, orders: 0 },
    ]);
  });

  it('AC-4: salesByDay has exactly `days` entries', () => {
    expect(summarize([], 1).salesByDay).toEqual([
      { date: '2026-10-10', revenueInCents: 0, orders: 0 },
    ]);
    const ninety = summarize([], 90).salesByDay;
    expect(ninety).toHaveLength(90);
    expect(ninety[0].date).toBe('2026-07-13');
    expect(ninety[89].date).toBe('2026-10-10');
  });

  it('AC-2: ignores transactions outside the range or without a readable date', () => {
    const summary = summarize([
      aSalesRecord({ createdAt: '2026-10-08T04:59:59.999Z' }), // the 7th in Bogota
      aSalesRecord({ createdAt: '2026-10-11T05:00:00.000Z' }), // tomorrow in Bogota
      aSalesRecord({ createdAt: 'garbage' }),
      aSalesRecord({ status: 'DECLINED', createdAt: '2026-10-01T17:00:00.000Z' }),
      aSalesRecord({ createdAt: '2026-10-08T05:00:00.000Z', totalInCents: 700 }),
    ]);

    expect(summary.totals).toMatchObject({
      totalAttempts: 1,
      approvedOrders: 1,
      revenueInCents: 700,
    });
    expect(summary.payments.byCardBrand[0]).toEqual({ brand: 'VISA', attempts: 1, approved: 1 });
  });

  it('AC-5: topProducts groups approved sales by product, best revenue first', () => {
    const summary = summarize([
      aSalesRecord({ productId: P(1), productName: 'Lamp', quantity: 1, totalInCents: 300 }),
      aSalesRecord({ productId: P(2), productName: 'Watch', quantity: 1, totalInCents: 900 }),
      aSalesRecord({ productId: P(1), productName: 'Lamp', quantity: 2, totalInCents: 500 }),
      aSalesRecord({
        productId: P(3),
        productName: 'Never sold',
        status: 'DECLINED',
        totalInCents: 9_999,
      }),
    ]);

    expect(summary.topProducts).toEqual([
      { productId: P(2), name: 'Watch', unitsSold: 1, revenueInCents: 900 },
      { productId: P(1), name: 'Lamp', unitsSold: 3, revenueInCents: 800 },
    ]);
  });

  it('AC-5: topProducts keeps the five best and breaks ties by units, then name', () => {
    const sale = (n: number, productName: string, totalInCents: number, quantity: number) =>
      aSalesRecord({ productId: P(n), productName, totalInCents, quantity });

    const summary = summarize([
      sale(1, 'Zeta', 500, 1),
      sale(2, 'Alpha', 500, 1),
      sale(3, 'Bulk', 500, 4),
      sale(4, 'Top', 900, 1),
      sale(5, 'Low', 100, 1),
      sale(6, 'Lowest', 50, 9),
    ]);

    expect(summary.topProducts.map((product) => product.name)).toEqual([
      'Top',
      'Bulk',
      'Alpha',
      'Zeta',
      'Low',
    ]);
  });

  it('AC-5: two products with the same figures and name are ordered by id', () => {
    const records = [
      aSalesRecord({ productId: P(2), productName: 'Twin' }),
      aSalesRecord({ productId: P(1), productName: 'Twin' }),
    ];

    expect(summarize(records).topProducts.map((product) => product.productId)).toEqual([
      P(1),
      P(2),
    ]);
    expect(
      summarize([...records].reverse()).topProducts.map((product) => product.productId),
    ).toEqual([P(1), P(2)]);
  });

  it('AC-5: uses the most recent name stored on the transactions of a product', () => {
    const renamed = [
      aSalesRecord({ productName: 'Old name', createdAt: on(8) }),
      aSalesRecord({ productName: 'New name', createdAt: on(10) }),
      aSalesRecord({ productName: 'Middle name', createdAt: on(9) }),
    ];

    expect(summarize(renamed).topProducts[0].name).toBe('New name');
    expect(summarize([...renamed].reverse()).topProducts[0].name).toBe('New name');
  });

  it('AC-6: byStatus always lists the five statuses in the agreed order', () => {
    const summary = summarize([
      aSalesRecord({ status: 'VOIDED' }),
      aSalesRecord({ status: 'PENDING' }),
      aSalesRecord({ status: 'PENDING' }),
      aSalesRecord({ status: 'ERROR' }),
      aSalesRecord({ status: 'SOMETHING_ELSE' }),
    ]);

    expect(summary.payments.byStatus).toEqual([
      { status: 'APPROVED', count: 0 },
      { status: 'DECLINED', count: 0 },
      { status: 'ERROR', count: 1 },
      { status: 'VOIDED', count: 1 },
      { status: 'PENDING', count: 2 },
    ]);
    expect(summary.totals.totalAttempts).toBe(5);
  });

  it('AC-7: byCardBrand always lists VISA then MASTERCARD with attempts and approvals', () => {
    const summary = summarize([
      aSalesRecord({ cardBrand: 'MASTERCARD' }),
      aSalesRecord({ cardBrand: 'MASTERCARD', status: 'DECLINED' }),
      aSalesRecord({ cardBrand: 'MASTERCARD', status: 'PENDING' }),
      aSalesRecord({ cardBrand: 'VISA', status: 'ERROR' }),
      aSalesRecord({ cardBrand: 'OTHER' }),
    ]);

    expect(summary.payments.byCardBrand).toEqual([
      { brand: 'VISA', attempts: 1, approved: 0 },
      { brand: 'MASTERCARD', attempts: 3, approved: 1 },
    ]);
  });

  it('AC-8: carries no personal or per-order data', () => {
    const json = JSON.stringify(
      summarize([aSalesRecord(), aSalesRecord({ status: 'DECLINED', cardBrand: 'MASTERCARD' })]),
    );

    expect(json).not.toMatch(
      /customer|email|phone|fullName|address|reference|lastFour|transactionId|"id"/i,
    );
    expect(Object.keys(JSON.parse(json)).sort()).toEqual([
      'currency',
      'generatedAt',
      'payments',
      'range',
      'salesByDay',
      'topProducts',
      'totals',
    ]);
  });
});
