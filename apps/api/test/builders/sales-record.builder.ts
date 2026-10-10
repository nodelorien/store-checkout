import { SalesRecord } from '../../src/modules/reports/domain/sales-summary';
import { PRODUCT_ID } from './product.builder';

/** An approved VISA purchase of one lamp at noon (Bogota) on 2026-10-09 unless overridden. */
export function aSalesRecord(overrides: Partial<SalesRecord> = {}): SalesRecord {
  return {
    status: 'APPROVED',
    productId: PRODUCT_ID,
    productName: 'Aurora Desk Lamp',
    quantity: 1,
    totalInCents: 14_040_000,
    cardBrand: 'VISA',
    createdAt: '2026-10-09T17:00:00.000Z',
    ...overrides,
  };
}
