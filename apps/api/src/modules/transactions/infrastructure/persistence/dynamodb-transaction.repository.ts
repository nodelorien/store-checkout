import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  TransactWriteCommand,
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
import { Delivery } from '../../../deliveries/domain/delivery';
import { toDeliveryItem } from '../../../deliveries/infrastructure/persistence/delivery.mapper';
import {
  ApproveOutcome,
  CreateOutcome,
  FailOutcome,
  TransactionRepository,
} from '../../application/ports/transaction-repository.port';
import { Transaction } from '../../domain/transaction';
import { toTransaction, toTransactionItem } from './transaction.mapper';

export const TRANSACTIONS_BY_REFERENCE_INDEX = 'byReference';
const IDEMPOTENCY_LOCK_PREFIX = 'IDEMPOTENCY#';
const CONDITION_FAILED = 'ConditionalCheckFailed';

/** Key of the lock item that makes an idempotency key usable only once (strongly consistent). */
export function idempotencyLockId(key: string): string {
  return `${IDEMPOTENCY_LOCK_PREFIX}${key}`;
}

/**
 * Reasons of a cancelled `TransactWriteItems`, one per operation in request order
 * (`'None'` for the operations whose condition held). Empty when the error is something else.
 */
export function cancellationCodes(cause: unknown): string[] {
  if (!(cause instanceof Error) || cause.name !== 'TransactionCanceledException') {
    return [];
  }
  const reasons = (cause as { CancellationReasons?: Array<{ Code?: string }> }).CancellationReasons;
  return (reasons ?? []).map((reason) => reason.Code ?? 'None');
}

function isConditionalCheckFailure(cause: unknown): boolean {
  return cause instanceof Error && cause.name === 'ConditionalCheckFailedException';
}

/** Builds `SET #a = :a, …` for the defined values only. */
function setExpression(values: Record<string, unknown>): {
  expression: string;
  names: Record<string, string>;
  values: Record<string, unknown>;
} {
  const entries = Object.entries(values).filter(([, value]) => value !== undefined);
  return {
    expression: `SET ${entries.map(([key]) => `#${key} = :${key}`).join(', ')}`,
    names: Object.fromEntries(entries.map(([key]) => [`#${key}`, key])),
    values: Object.fromEntries(entries.map(([key, value]) => [`:${key}`, value])),
  };
}

@Injectable()
export class DynamoDbTransactionRepository implements TransactionRepository {
  private readonly tables: AppConfig['tables'];

  constructor(
    @Inject(DYNAMODB_DOCUMENT_CLIENT) private readonly client: DynamoDBDocumentClient,
    @Inject(APP_CONFIG) config: AppConfig,
  ) {
    this.tables = config.tables;
  }

  async findById(id: string): Promise<Result<Transaction, DomainError>> {
    const output = await tryAsync(
      () =>
        this.client.send(
          new GetCommand({
            TableName: this.tables.transactions,
            Key: { id },
            ConsistentRead: true,
          }),
        ),
      toPersistenceError,
    );
    return output.andThen((result) =>
      result.Item ? ok(toTransaction(result.Item)) : err(DomainErrors.transactionNotFound()),
    );
  }

  /** Reads the lock item (consistent), then the transaction it points to. */
  async findByIdempotencyKey(key: string): Promise<Result<Transaction | null, DomainError>> {
    const lock = await tryAsync(
      () =>
        this.client.send(
          new GetCommand({
            TableName: this.tables.transactions,
            Key: { id: idempotencyLockId(key) },
            ConsistentRead: true,
          }),
        ),
      toPersistenceError,
    );
    if (lock.isErr()) {
      return err(lock.error);
    }
    const transactionId = lock.value.Item?.transactionId;
    if (typeof transactionId !== 'string') {
      return ok(null);
    }
    const found = await this.findById(transactionId);
    return found.orElse((error) =>
      error.code === 'TRANSACTION_NOT_FOUND'
        ? ok<Transaction | null, DomainError>(null)
        : err(error),
    );
  }

  async findByReference(reference: string): Promise<Result<Transaction | null, DomainError>> {
    const output = await tryAsync(
      () =>
        this.client.send(
          new QueryCommand({
            TableName: this.tables.transactions,
            IndexName: TRANSACTIONS_BY_REFERENCE_INDEX,
            KeyConditionExpression: '#reference = :reference',
            ExpressionAttributeNames: { '#reference': 'reference' },
            ExpressionAttributeValues: { ':reference': reference },
            Limit: 1,
          }),
        ),
      toPersistenceError,
    );
    return output.map((result) => (result.Items?.[0] ? toTransaction(result.Items[0]) : null));
  }

  /**
   * Write A. Without a key: a conditional put. With a key: the put and the lock item in one
   * transaction, so two requests carrying the same key can never both create a transaction.
   */
  async create(
    transaction: Transaction,
    idempotencyKey?: string,
  ): Promise<Result<CreateOutcome, DomainError>> {
    const put = {
      TableName: this.tables.transactions,
      Item: toTransactionItem(transaction, idempotencyKey),
      ConditionExpression: 'attribute_not_exists(id)',
    };

    try {
      if (!idempotencyKey) {
        await this.client.send(new PutCommand(put));
        return ok('CREATED');
      }
      await this.client.send(
        new TransactWriteCommand({
          TransactItems: [
            { Put: put },
            {
              Put: {
                TableName: this.tables.transactions,
                Item: {
                  id: idempotencyLockId(idempotencyKey),
                  transactionId: transaction.id,
                  createdAt: transaction.toProps().createdAt,
                },
                ConditionExpression: 'attribute_not_exists(id)',
              },
            },
          ],
        }),
      );
      return ok('CREATED');
    } catch (cause) {
      return cancellationCodes(cause)[1] === CONDITION_FAILED
        ? ok('DUPLICATE_KEY')
        : err(toPersistenceError(cause));
    }
  }

  async attachGatewayId(
    id: string,
    gatewayTransactionId: string,
    updatedAt: string,
  ): Promise<Result<void, DomainError>> {
    const set = setExpression({ gatewayTransactionId, updatedAt });
    const output = await tryAsync(
      () =>
        this.client.send(
          new UpdateCommand({
            TableName: this.tables.transactions,
            Key: { id },
            UpdateExpression: set.expression,
            ConditionExpression: 'attribute_exists(id)',
            ExpressionAttributeNames: set.names,
            ExpressionAttributeValues: set.values,
          }),
        ),
      toPersistenceError,
    );
    return output.map(() => undefined);
  }

  /**
   * Write B (ADR-0011) — one `TransactWriteItems`:
   *   0. transaction → APPROVED            if status = PENDING
   *   1. product stock = stock - quantity  if stock >= quantity
   *   2. put delivery                      if it does not exist
   */
  async resolveApproved(
    transaction: Transaction,
    delivery: Delivery,
  ): Promise<Result<ApproveOutcome, DomainError>> {
    const props = transaction.toProps();
    const update = this.resolutionUpdate(transaction);

    try {
      await this.client.send(
        new TransactWriteCommand({
          TransactItems: [
            { Update: update },
            {
              Update: {
                TableName: this.tables.products,
                Key: { id: props.productId },
                UpdateExpression: 'SET #stock = #stock - :quantity, #updatedAt = :now',
                ConditionExpression: '#stock >= :quantity',
                ExpressionAttributeNames: { '#stock': 'stock', '#updatedAt': 'updatedAt' },
                ExpressionAttributeValues: { ':quantity': props.quantity, ':now': props.updatedAt },
              },
            },
            {
              Put: {
                TableName: this.tables.deliveries,
                Item: toDeliveryItem(delivery),
                ConditionExpression: 'attribute_not_exists(id)',
              },
            },
          ],
        }),
      );
      return ok('APPLIED');
    } catch (cause) {
      const [transactionCode, stockCode] = cancellationCodes(cause);
      if (transactionCode === CONDITION_FAILED) {
        return ok('ALREADY_RESOLVED');
      }
      if (stockCode === CONDITION_FAILED) {
        return ok('OUT_OF_STOCK');
      }
      return err(toPersistenceError(cause));
    }
  }

  /** Write C — single conditional update; a failed condition means "already resolved". */
  async resolveFailed(transaction: Transaction): Promise<Result<FailOutcome, DomainError>> {
    try {
      await this.client.send(new UpdateCommand(this.resolutionUpdate(transaction)));
      return ok('APPLIED');
    } catch (cause) {
      return isConditionalCheckFailure(cause)
        ? ok('ALREADY_RESOLVED')
        : err(toPersistenceError(cause));
    }
  }

  private resolutionUpdate(transaction: Transaction) {
    const props = transaction.toProps();
    const set = setExpression({
      status: props.status,
      statusMessage: props.statusMessage,
      gatewayTransactionId: props.gatewayTransactionId,
      deliveryId: props.deliveryId,
      resolvedAt: props.resolvedAt,
      updatedAt: props.updatedAt,
    });
    return {
      TableName: this.tables.transactions,
      Key: { id: props.id },
      UpdateExpression: set.expression,
      ConditionExpression: '#status = :pending',
      ExpressionAttributeNames: set.names,
      ExpressionAttributeValues: { ...set.values, ':pending': 'PENDING' },
    };
  }
}
