import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { Inject, Injectable } from '@nestjs/common';
import { APP_CONFIG, AppConfig } from '../../../../shared/config/app-config';
import {
  DYNAMODB_DOCUMENT_CLIENT,
  toPersistenceError,
} from '../../../../shared/dynamodb/dynamodb.client';
import { DomainError } from '../../../../shared/errors/domain-error';
import { Result, tryAsync } from '../../../../shared/result/result';
import { SalesRecordsPort } from '../../application/ports/sales-records.port';
import { SalesRecord } from '../../domain/sales-summary';

/** The only attributes ever requested: nothing that identifies a person or an order. */
export const SALES_RECORD_ATTRIBUTES = [
  'status',
  'productId',
  'productName',
  'quantity',
  'totalInCents',
  'cardBrand',
  'createdAt',
] as const;

export function toSalesRecord(item: Record<string, unknown>): SalesRecord {
  return {
    status: String(item.status),
    productId: String(item.productId),
    productName: String(item.productName ?? ''),
    quantity: Number(item.quantity),
    totalInCents: Number(item.totalInCents),
    cardBrand: String(item.cardBrand),
    createdAt: String(item.createdAt),
  };
}

@Injectable()
export class DynamoDbSalesRecordsAdapter implements SalesRecordsPort {
  private readonly table: string;

  constructor(
    @Inject(DYNAMODB_DOCUMENT_CLIENT) private readonly client: DynamoDBDocumentClient,
    @Inject(APP_CONFIG) config: AppConfig,
  ) {
    this.table = config.tables.transactions;
  }

  /**
   * Paged `Scan` of the transactions table (data-model.md). `createdAt` is always written with
   * `toISOString()`, so string order is time order. `attribute_exists(#status)` leaves out the
   * idempotency lock items that share the table.
   */
  findCreatedSince(fromInstant: string): Promise<Result<SalesRecord[], DomainError>> {
    return tryAsync(async () => {
      const records: SalesRecord[] = [];
      let startKey: Record<string, unknown> | undefined;
      do {
        const page = await this.client.send(
          new ScanCommand({
            TableName: this.table,
            FilterExpression: '#createdAt >= :from AND attribute_exists(#status)',
            ProjectionExpression: SALES_RECORD_ATTRIBUTES.map((name) => `#${name}`).join(', '),
            ExpressionAttributeNames: Object.fromEntries(
              SALES_RECORD_ATTRIBUTES.map((name) => [`#${name}`, name]),
            ),
            ExpressionAttributeValues: { ':from': fromInstant },
            ExclusiveStartKey: startKey,
          }),
        );
        records.push(...(page.Items ?? []).map(toSalesRecord));
        startKey = page.LastEvaluatedKey;
      } while (startKey);
      return records;
    }, toPersistenceError);
  }
}
