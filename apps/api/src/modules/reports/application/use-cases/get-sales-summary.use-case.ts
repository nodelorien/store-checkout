import { Inject, Injectable } from '@nestjs/common';
import { DomainError } from '../../../../shared/errors/domain-error';
import { CLOCK, Clock } from '../../../../shared/ports/clock.port';
import { fromResult, Result } from '../../../../shared/result/result';
import { ReportRange } from '../../domain/report-range';
import { SalesSummary, summarizeSales } from '../../domain/sales-summary';
import { SALES_RECORDS_PORT, SalesRecordsPort } from '../ports/sales-records.port';

export interface GetSalesSummaryInput {
  /** Calendar days to cover, ending today. Defaults to 14. */
  readonly days?: number;
}

@Injectable()
export class GetSalesSummaryUseCase {
  constructor(
    @Inject(SALES_RECORDS_PORT) private readonly records: SalesRecordsPort,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /**
   * Railway: build the day range from the clock → read transactions since its first instant
   * → aggregate. Errors: VALIDATION_ERROR, PERSISTENCE_ERROR.
   */
  execute(input: GetSalesSummaryInput = {}): Promise<Result<SalesSummary, DomainError>> {
    const now = this.clock.now();
    return fromResult(ReportRange.create(input.days, now))
      .andThen((range) =>
        fromResult(this.records.findCreatedSince(range.fromInstant)).map((records) =>
          summarizeSales(records, range, now),
        ),
      )
      .toPromise();
  }
}
