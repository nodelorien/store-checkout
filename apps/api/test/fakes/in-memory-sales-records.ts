import { SalesRecordsPort } from '../../src/modules/reports/application/ports/sales-records.port';
import { SalesRecord } from '../../src/modules/reports/domain/sales-summary';
import { DomainError } from '../../src/shared/errors/domain-error';
import { err, ok, Result } from '../../src/shared/result/result';

/** Applies the same lower bound as the DynamoDB adapter and records what it was asked for. */
export class InMemorySalesRecords implements SalesRecordsPort {
  readonly requestedSince: string[] = [];
  failWith: DomainError | undefined;

  constructor(readonly records: SalesRecord[] = []) {}

  async findCreatedSince(fromInstant: string): Promise<Result<SalesRecord[], DomainError>> {
    this.requestedSince.push(fromInstant);
    return this.failWith
      ? err(this.failWith)
      : ok(this.records.filter((record) => record.createdAt >= fromInstant));
  }
}
