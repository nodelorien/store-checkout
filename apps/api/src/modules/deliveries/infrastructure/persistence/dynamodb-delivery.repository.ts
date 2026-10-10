import {
  DynamoDBDocumentClient,
  GetCommand,
  QueryCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { Inject, Injectable } from '@nestjs/common';
import { APP_CONFIG, AppConfig } from '../../../../shared/config/app-config';
import {
  DYNAMODB_DOCUMENT_CLIENT,
  toPersistenceError,
} from '../../../../shared/dynamodb/dynamodb.client';
import { DomainError, DomainErrors } from '../../../../shared/errors/domain-error';
import { err, ok, Result, tryAsync } from '../../../../shared/result/result';
import { DeliveryRepository } from '../../application/ports/delivery-repository.port';
import { Delivery } from '../../domain/delivery';
import { toAddressAttribute, toDelivery } from './delivery.mapper';

export const DELIVERIES_BY_TRANSACTION_INDEX = 'byTransaction';

@Injectable()
export class DynamoDbDeliveryRepository implements DeliveryRepository {
  private readonly table: string;

  constructor(
    @Inject(DYNAMODB_DOCUMENT_CLIENT) private readonly client: DynamoDBDocumentClient,
    @Inject(APP_CONFIG) config: AppConfig,
  ) {
    this.table = config.tables.deliveries;
  }

  async findById(id: string): Promise<Result<Delivery, DomainError>> {
    const output = await tryAsync(
      () => this.client.send(new GetCommand({ TableName: this.table, Key: { id } })),
      toPersistenceError,
    );
    return output.andThen((result) =>
      result.Item ? ok(toDelivery(result.Item)) : err(DomainErrors.deliveryNotFound()),
    );
  }

  async findByTransactionId(transactionId: string): Promise<Result<Delivery | null, DomainError>> {
    const output = await tryAsync(
      () =>
        this.client.send(
          new QueryCommand({
            TableName: this.table,
            IndexName: DELIVERIES_BY_TRANSACTION_INDEX,
            KeyConditionExpression: '#transactionId = :transactionId',
            ExpressionAttributeNames: { '#transactionId': 'transactionId' },
            ExpressionAttributeValues: { ':transactionId': transactionId },
            Limit: 1,
          }),
        ),
      toPersistenceError,
    );
    return output.map((result) => (result.Items?.[0] ? toDelivery(result.Items[0]) : null));
  }

  /** Conditional update: the address changes only while the stored status is `PENDING`. */
  async updateAddress(delivery: Delivery): Promise<Result<Delivery, DomainError>> {
    const props = delivery.toProps();
    try {
      await this.client.send(
        new UpdateCommand({
          TableName: this.table,
          Key: { id: props.id },
          UpdateExpression: 'SET #address = :address, #updatedAt = :updatedAt',
          ConditionExpression: '#status = :pending',
          ExpressionAttributeNames: {
            '#address': 'address',
            '#updatedAt': 'updatedAt',
            '#status': 'status',
          },
          ExpressionAttributeValues: {
            ':address': toAddressAttribute(props.address),
            ':updatedAt': props.updatedAt,
            ':pending': 'PENDING',
          },
        }),
      );
      return ok(delivery);
    } catch (cause) {
      return cause instanceof Error && cause.name === 'ConditionalCheckFailedException'
        ? err(DomainErrors.deliveryNotEditable('not PENDING'))
        : err(toPersistenceError(cause));
    }
  }
}
