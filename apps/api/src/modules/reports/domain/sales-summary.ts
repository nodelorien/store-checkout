import { Currency } from '../../products/domain/money';
import { CARD_BRANDS, CardBrand } from '../../transactions/domain/card-info';
import { TransactionStatus } from '../../transactions/domain/transaction';
import { ReportRange, reportDayOf } from './report-range';

/**
 * The only transaction facts a report may read. Deliberately no ids of people or orders,
 * no reference, no address and no card digits — a summary can never leak what it never held.
 */
export interface SalesRecord {
  readonly status: string;
  readonly productId: string;
  /** Name snapshot stored on the transaction at purchase time. */
  readonly productName: string;
  readonly quantity: number;
  readonly totalInCents: number;
  readonly cardBrand: string;
  readonly createdAt: string;
}

/** Fixed presentation order of `payments.byStatus`. */
export const REPORT_STATUSES = [
  'APPROVED',
  'DECLINED',
  'ERROR',
  'VOIDED',
  'PENDING',
] as const satisfies readonly TransactionStatus[];

export const TOP_PRODUCTS_LIMIT = 5;

export interface SalesSummary {
  readonly currency: Currency;
  readonly range: { readonly from: string; readonly to: string; readonly days: number };
  readonly totals: {
    readonly revenueInCents: number;
    readonly approvedOrders: number;
    readonly unitsSold: number;
    readonly averageOrderInCents: number;
    readonly totalAttempts: number;
    /** approved / (approved + declined + error + voided), 0–1, 4 decimals. */
    readonly approvalRate: number;
  };
  readonly salesByDay: {
    readonly date: string;
    readonly revenueInCents: number;
    readonly orders: number;
  }[];
  readonly topProducts: {
    readonly productId: string;
    readonly name: string;
    readonly unitsSold: number;
    readonly revenueInCents: number;
  }[];
  readonly payments: {
    readonly byStatus: { readonly status: TransactionStatus; readonly count: number }[];
    readonly byCardBrand: {
      readonly brand: CardBrand;
      readonly attempts: number;
      readonly approved: number;
    }[];
  };
  readonly generatedAt: string;
}

interface ProductSales {
  productId: string;
  name: string;
  nameAsOf: string;
  unitsSold: number;
  revenueInCents: number;
}

const sum = (values: readonly number[]): number =>
  values.reduce((total, value) => total + value, 0);

function topProducts(approved: readonly SalesRecord[]): SalesSummary['topProducts'] {
  const byProduct = new Map<string, ProductSales>();
  for (const record of approved) {
    const sales = byProduct.get(record.productId) ?? {
      productId: record.productId,
      name: record.productName,
      nameAsOf: record.createdAt,
      unitsSold: 0,
      revenueInCents: 0,
    };
    sales.unitsSold += record.quantity;
    sales.revenueInCents += record.totalInCents;
    // A product may have been renamed between purchases: show the most recent snapshot.
    if (record.createdAt > sales.nameAsOf) {
      sales.name = record.productName;
      sales.nameAsOf = record.createdAt;
    }
    byProduct.set(record.productId, sales);
  }
  return [...byProduct.values()]
    .sort(
      (a, b) =>
        b.revenueInCents - a.revenueInCents ||
        b.unitsSold - a.unitsSold ||
        a.name.localeCompare(b.name, 'en') ||
        a.productId.localeCompare(b.productId, 'en'),
    )
    .slice(0, TOP_PRODUCTS_LIMIT)
    .map(({ productId, name, unitsSold, revenueInCents }) => ({
      productId,
      name,
      unitsSold,
      revenueInCents,
    }));
}

/**
 * Pure aggregation. Records outside the range (or with an unreadable date) are ignored, so the
 * caller may pass a superset. Money figures count `APPROVED` transactions only.
 */
export function summarizeSales(
  records: readonly SalesRecord[],
  range: ReportRange,
  now: Date,
): SalesSummary {
  const inRange = records
    .map((record) => ({ record, day: reportDayOf(record.createdAt) }))
    .filter(({ day }) => range.includes(day));
  const approved = inRange.filter(({ record }) => record.status === 'APPROVED');
  const countOf = (status: TransactionStatus): number =>
    inRange.filter(({ record }) => record.status === status).length;

  const revenueInCents = sum(approved.map(({ record }) => record.totalInCents));
  const approvedOrders = approved.length;
  const resolved = sum(
    REPORT_STATUSES.filter((status) => status !== 'PENDING').map((status) => countOf(status)),
  );

  return {
    currency: 'COP',
    range: { from: range.from, to: range.to, days: range.days },
    totals: {
      revenueInCents,
      approvedOrders,
      unitsSold: sum(approved.map(({ record }) => record.quantity)),
      averageOrderInCents: approvedOrders === 0 ? 0 : Math.round(revenueInCents / approvedOrders),
      totalAttempts: inRange.length,
      approvalRate: resolved === 0 ? 0 : Math.round((approvedOrders / resolved) * 10_000) / 10_000,
    },
    salesByDay: range.dates().map((date) => {
      const ofDay = approved.filter(({ day }) => day === date);
      return {
        date,
        revenueInCents: sum(ofDay.map(({ record }) => record.totalInCents)),
        orders: ofDay.length,
      };
    }),
    topProducts: topProducts(approved.map(({ record }) => record)),
    payments: {
      byStatus: REPORT_STATUSES.map((status) => ({ status, count: countOf(status) })),
      byCardBrand: CARD_BRANDS.map((brand) => ({
        brand,
        attempts: inRange.filter(({ record }) => record.cardBrand === brand).length,
        approved: approved.filter(({ record }) => record.cardBrand === brand).length,
      })),
    },
    generatedAt: now.toISOString(),
  };
}
