import { readThrough } from '../../../../shared/cache/read-through';
import { DomainError } from '../../../../shared/errors/domain-error';
import { Cache } from '../../../../shared/ports/cache.port';
import { Result } from '../../../../shared/result/result';
import { SalesRecordsPort } from '../../application/ports/sales-records.port';
import { SalesRecord } from '../../domain/sales-summary';

export interface SalesCacheSettings {
  /** Distinguishes stages that share one Redis; the transactions table name is unique per stage. */
  readonly namespace: string;
  readonly ttlSeconds: number;
}

/**
 * Caches the sales read per range start for a short time. Entries are not invalidated, so a
 * report can lag an approval by up to `ttlSeconds`. Records hold no personal data (see
 * `SalesRecord`), so neither does the cache.
 */
export class CachedSalesRecordsAdapter implements SalesRecordsPort {
  constructor(
    private readonly inner: SalesRecordsPort,
    private readonly cache: Cache,
    private readonly settings: SalesCacheSettings,
  ) {}

  findCreatedSince(fromInstant: string): Promise<Result<SalesRecord[], DomainError>> {
    return readThrough<SalesRecord[]>({
      cache: this.cache,
      key: `sales:${this.settings.namespace}:${fromInstant}`,
      ttlSeconds: this.settings.ttlSeconds,
      load: () => this.inner.findCreatedSince(fromInstant),
      encode: (records) => records,
      decode: (stored) => (Array.isArray(stored) ? (stored as SalesRecord[]) : undefined),
    });
  }
}
