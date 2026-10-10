import { Module } from '@nestjs/common';
import { SALES_RECORDS_PORT } from './application/ports/sales-records.port';
import { GetSalesSummaryUseCase } from './application/use-cases/get-sales-summary.use-case';
import { ReportsController } from './infrastructure/http/reports.controller';
import { DynamoDbSalesRecordsAdapter } from './infrastructure/persistence/dynamodb-sales-records.adapter';

/** Read-only aggregates. Reads the transactions table through its own narrow port. */
@Module({
  controllers: [ReportsController],
  providers: [
    { provide: SALES_RECORDS_PORT, useClass: DynamoDbSalesRecordsAdapter },
    GetSalesSummaryUseCase,
  ],
})
export class ReportsModule {}
