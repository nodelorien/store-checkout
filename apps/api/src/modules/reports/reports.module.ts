import { Module } from '@nestjs/common';
import { APP_CONFIG, AppConfig } from '../../shared/config/app-config';
import { CACHE, Cache } from '../../shared/ports/cache.port';
import { SALES_RECORDS_PORT } from './application/ports/sales-records.port';
import { GetSalesSummaryUseCase } from './application/use-cases/get-sales-summary.use-case';
import { ReportsController } from './infrastructure/http/reports.controller';
import { CachedSalesRecordsAdapter } from './infrastructure/persistence/cached-sales-records.adapter';
import { DynamoDbSalesRecordsAdapter } from './infrastructure/persistence/dynamodb-sales-records.adapter';

/** Read-only aggregates. Reads the transactions table through its own narrow port. */
@Module({
  controllers: [ReportsController],
  providers: [
    DynamoDbSalesRecordsAdapter,
    {
      provide: SALES_RECORDS_PORT,
      inject: [DynamoDbSalesRecordsAdapter, CACHE, APP_CONFIG],
      useFactory: (records: DynamoDbSalesRecordsAdapter, cache: Cache, config: AppConfig) =>
        new CachedSalesRecordsAdapter(records, cache, {
          namespace: config.tables.transactions,
          ttlSeconds: config.cache.reportsTtlSeconds,
        }),
    },
    GetSalesSummaryUseCase,
  ],
})
export class ReportsModule {}
