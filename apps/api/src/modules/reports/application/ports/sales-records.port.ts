import { DomainError } from '../../../../shared/errors/domain-error';
import { Result } from '../../../../shared/result/result';
import { SalesRecord } from '../../domain/sales-summary';

export const SALES_RECORDS_PORT = Symbol('SALES_RECORDS_PORT');

/** Read-only view over the transactions store, owned by the reports module. */
export interface SalesRecordsPort {
  /** Every transaction whose `createdAt` is on or after the given ISO-8601 UTC instant. */
  findCreatedSince(fromInstant: string): Promise<Result<SalesRecord[], DomainError>>;
}
