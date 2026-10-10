import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  TransactWriteCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';
import { PRODUCT_ID } from '../../../../../test/builders/product.builder';
import {
  aDelivery,
  AN_ADDRESS,
  aTransaction,
  DELIVERY_ID,
  TRANSACTION_ID,
} from '../../../../../test/builders/transaction.builder';
import { expectErr, expectOk } from '../../../../../test/helpers/result-assertions';
import { testConfig } from '../../../../../test/helpers/test-config';
import { createDocumentClient } from '../../../../shared/dynamodb/dynamodb.client';
import { toDeliveryItem } from '../../../deliveries/infrastructure/persistence/delivery.mapper';
import {
  cancellationCodes,
  DynamoDbTransactionRepository,
  idempotencyLockId,
} from './dynamodb-transaction.repository';
import { toTransaction, toTransactionItem } from './transaction.mapper';

const dynamo = mockClient(DynamoDBDocumentClient);
const config = testConfig();
const repository = new DynamoDbTransactionRepository(createDocumentClient(config.aws), config);
const KEY = '5f0c7a52-98a0-4f6f-8a43-1d2c3b4a5e6f';

function cancelled(...codes: string[]): Error {
  return Object.assign(new Error('Transaction cancelled'), {
    name: 'TransactionCanceledException',
    CancellationReasons: codes.map((Code) => ({ Code })),
  });
}

const conditionFailed = (): Error =>
  Object.assign(new Error('condition'), { name: 'ConditionalCheckFailedException' });

beforeEach(() => dynamo.reset());

describe('transaction mapper', () => {
  it('flattens amounts, keeps the address as a map and omits absent optionals', () => {
    const item = toTransactionItem(aTransaction().build());

    expect(item).toEqual({
      id: TRANSACTION_ID,
      reference: 'TX-20261009-ABCDEFGH',
      status: 'PENDING',
      productId: PRODUCT_ID,
      productName: 'Aurora Desk Lamp',
      productImageUrl: '/images/products/aurora-desk-lamp.svg',
      quantity: 2,
      customerId: 'c0ffee00-0000-4000-8000-00000000c001',
      subtotalInCents: 25_980_000,
      baseFeeInCents: 250_000,
      deliveryFeeInCents: 800_000,
      totalInCents: 27_030_000,
      currency: 'COP',
      shippingAddress: AN_ADDRESS,
      cardBrand: 'VISA',
      cardLastFour: '4242',
      installments: 1,
      createdAt: '2026-10-09T15:00:00.000Z',
      updatedAt: '2026-10-09T15:00:00.000Z',
    });
    expect(toTransactionItem(aTransaction().build(), KEY).idempotencyKey).toBe(KEY);
  });

  it('round-trips pending and resolved transactions', () => {
    for (const transaction of [
      aTransaction().build(),
      aTransaction().approved().build(),
      aTransaction().declined().build(),
      aTransaction()
        .with({
          shippingAddress: { ...AN_ADDRESS, addressLine2: undefined, postalCode: undefined },
        })
        .build(),
    ]) {
      expect(toTransaction(toTransactionItem(transaction)).toProps()).toEqual(
        transaction.toProps(),
      );
    }
  });

  it('tolerates items written before optional attributes existed', () => {
    const item = toTransactionItem(aTransaction().build());
    delete item.productName;
    delete item.productImageUrl;
    delete item.installments;
    delete item.shippingAddress;

    expect(toTransaction(item).toProps()).toMatchObject({
      productName: '',
      productImageUrl: '',
      installments: 1,
      shippingAddress: { addressLine1: '', city: '', region: '', country: '' },
    });
  });
});

describe('cancellationCodes', () => {
  it('lists the reason codes of a cancelled transaction', () => {
    expect(cancellationCodes(cancelled('None', 'ConditionalCheckFailed'))).toEqual([
      'None',
      'ConditionalCheckFailed',
    ]);
    const withoutCode = Object.assign(new Error('x'), {
      name: 'TransactionCanceledException',
      CancellationReasons: [{}],
    });
    expect(cancellationCodes(withoutCode)).toEqual(['None']);
    const withoutReasons = Object.assign(new Error('x'), { name: 'TransactionCanceledException' });
    expect(cancellationCodes(withoutReasons)).toEqual([]);
  });

  it('returns nothing for other errors', () => {
    expect(cancellationCodes(new Error('boom'))).toEqual([]);
    expect(cancellationCodes('boom')).toEqual([]);
  });
});

describe('DynamoDbTransactionRepository reads', () => {
  it('AC-11: gets a transaction by id with a consistent read', async () => {
    dynamo.on(GetCommand).resolves({ Item: toTransactionItem(aTransaction().approved().build()) });

    expect(expectOk(await repository.findById(TRANSACTION_ID)).status).toBe('APPROVED');
    expect(dynamo.commandCalls(GetCommand)[0].args[0].input).toEqual({
      TableName: 'test-transactions',
      Key: { id: TRANSACTION_ID },
      ConsistentRead: true,
    });
  });

  it('AC-11: returns TRANSACTION_NOT_FOUND when the item does not exist', async () => {
    dynamo.on(GetCommand).resolves({});

    expectErr(await repository.findById(TRANSACTION_ID), 'TRANSACTION_NOT_FOUND');
  });

  it('AC-8: resolves an idempotency key through its lock item', async () => {
    dynamo
      .on(GetCommand, { Key: { id: idempotencyLockId(KEY) } })
      .resolves({ Item: { id: idempotencyLockId(KEY), transactionId: TRANSACTION_ID } })
      .on(GetCommand, { Key: { id: TRANSACTION_ID } })
      .resolves({ Item: toTransactionItem(aTransaction().build(), KEY) });

    expect(expectOk(await repository.findByIdempotencyKey(KEY))?.id).toBe(TRANSACTION_ID);
    expect(dynamo.commandCalls(GetCommand)[0].args[0].input).toEqual({
      TableName: 'test-transactions',
      Key: { id: `IDEMPOTENCY#${KEY}` },
      ConsistentRead: true,
    });
  });

  it('AC-8: returns null for an unused key or a dangling lock', async () => {
    dynamo.on(GetCommand).resolves({});
    expect(expectOk(await repository.findByIdempotencyKey(KEY))).toBeNull();

    dynamo.reset();
    dynamo
      .on(GetCommand, { Key: { id: idempotencyLockId(KEY) } })
      .resolves({ Item: { transactionId: TRANSACTION_ID } })
      .on(GetCommand, { Key: { id: TRANSACTION_ID } })
      .resolves({});
    expect(expectOk(await repository.findByIdempotencyKey(KEY))).toBeNull();
  });

  it('AC-17: converts failures of the key lookup into PERSISTENCE_ERROR', async () => {
    dynamo.on(GetCommand).rejects(new Error('boom'));
    expectErr(await repository.findByIdempotencyKey(KEY), 'PERSISTENCE_ERROR');

    dynamo.reset();
    dynamo
      .on(GetCommand, { Key: { id: idempotencyLockId(KEY) } })
      .resolves({ Item: { transactionId: TRANSACTION_ID } })
      .on(GetCommand, { Key: { id: TRANSACTION_ID } })
      .rejects(new Error('boom'));
    expectErr(await repository.findByIdempotencyKey(KEY), 'PERSISTENCE_ERROR');
  });

  it('queries the byReference index', async () => {
    dynamo.on(QueryCommand).resolvesOnce({ Items: [toTransactionItem(aTransaction().build())] });

    expect(expectOk(await repository.findByReference('TX-20261009-ABCDEFGH'))?.id).toBe(
      TRANSACTION_ID,
    );
    expect(dynamo.commandCalls(QueryCommand)[0].args[0].input).toEqual({
      TableName: 'test-transactions',
      IndexName: 'byReference',
      KeyConditionExpression: '#reference = :reference',
      ExpressionAttributeNames: { '#reference': 'reference' },
      ExpressionAttributeValues: { ':reference': 'TX-20261009-ABCDEFGH' },
      Limit: 1,
    });

    dynamo.on(QueryCommand).resolves({});
    expect(expectOk(await repository.findByReference('TX-unknown'))).toBeNull();
    dynamo.on(QueryCommand).rejects(new Error('boom'));
    expectErr(await repository.findByReference('TX-unknown'), 'PERSISTENCE_ERROR');
  });
});

describe('DynamoDbTransactionRepository.create (write A)', () => {
  it('AC-1: puts the PENDING transaction with a not-exists condition and never touches stock', async () => {
    dynamo.on(PutCommand).resolves({});
    const transaction = aTransaction().build();

    expect(expectOk(await repository.create(transaction))).toBe('CREATED');
    expect(dynamo.commandCalls(PutCommand)[0].args[0].input).toEqual({
      TableName: 'test-transactions',
      Item: toTransactionItem(transaction),
      ConditionExpression: 'attribute_not_exists(id)',
    });
    expect(dynamo.commandCalls(TransactWriteCommand)).toHaveLength(0);
    expect(dynamo.commandCalls(UpdateCommand)).toHaveLength(0);
  });

  it('AC-8: writes the transaction and its idempotency lock atomically', async () => {
    dynamo.on(TransactWriteCommand).resolves({});
    const transaction = aTransaction().build();

    expect(expectOk(await repository.create(transaction, KEY))).toBe('CREATED');
    expect(dynamo.commandCalls(TransactWriteCommand)[0].args[0].input.TransactItems).toEqual([
      {
        Put: {
          TableName: 'test-transactions',
          Item: toTransactionItem(transaction, KEY),
          ConditionExpression: 'attribute_not_exists(id)',
        },
      },
      {
        Put: {
          TableName: 'test-transactions',
          Item: {
            id: `IDEMPOTENCY#${KEY}`,
            transactionId: TRANSACTION_ID,
            createdAt: '2026-10-09T15:00:00.000Z',
          },
          ConditionExpression: 'attribute_not_exists(id)',
        },
      },
    ]);
  });

  it('AC-8: reports DUPLICATE_KEY when the lock already exists', async () => {
    dynamo.on(TransactWriteCommand).rejects(cancelled('None', 'ConditionalCheckFailed'));

    expect(expectOk(await repository.create(aTransaction().build(), KEY))).toBe('DUPLICATE_KEY');
  });

  it('AC-17: converts any other failure into PERSISTENCE_ERROR', async () => {
    dynamo.on(TransactWriteCommand).rejects(cancelled('ConditionalCheckFailed', 'None'));
    expectErr(await repository.create(aTransaction().build(), KEY), 'PERSISTENCE_ERROR');

    dynamo.on(PutCommand).rejects(conditionFailed());
    expectErr(await repository.create(aTransaction().build()), 'PERSISTENCE_ERROR');
  });
});

describe('DynamoDbTransactionRepository.attachGatewayId', () => {
  it('AC-7: sets the gateway id on the existing transaction', async () => {
    dynamo.on(UpdateCommand).resolves({});

    expectOk(await repository.attachGatewayId(TRANSACTION_ID, 'gw-1', '2026-10-09T15:00:01.000Z'));
    expect(dynamo.commandCalls(UpdateCommand)[0].args[0].input).toEqual({
      TableName: 'test-transactions',
      Key: { id: TRANSACTION_ID },
      UpdateExpression:
        'SET #gatewayTransactionId = :gatewayTransactionId, #updatedAt = :updatedAt',
      ConditionExpression: 'attribute_exists(id)',
      ExpressionAttributeNames: {
        '#gatewayTransactionId': 'gatewayTransactionId',
        '#updatedAt': 'updatedAt',
      },
      ExpressionAttributeValues: {
        ':gatewayTransactionId': 'gw-1',
        ':updatedAt': '2026-10-09T15:00:01.000Z',
      },
    });
  });

  it('AC-17: converts a failure into PERSISTENCE_ERROR', async () => {
    dynamo.on(UpdateCommand).rejects(new Error('boom'));

    expectErr(await repository.attachGatewayId(TRANSACTION_ID, 'gw-1', 'now'), 'PERSISTENCE_ERROR');
  });
});

describe('DynamoDbTransactionRepository.resolveApproved (write B)', () => {
  const approved = aTransaction().approved().build();
  const delivery = aDelivery().build();

  it('AC-1: approves, decrements stock and creates the delivery in one conditional transaction', async () => {
    dynamo.on(TransactWriteCommand).resolves({});

    expect(expectOk(await repository.resolveApproved(approved, delivery))).toBe('APPLIED');

    const items = dynamo.commandCalls(TransactWriteCommand)[0].args[0].input.TransactItems;
    expect(items).toHaveLength(3);
    expect(items?.[0]).toEqual({
      Update: {
        TableName: 'test-transactions',
        Key: { id: TRANSACTION_ID },
        UpdateExpression:
          'SET #status = :status, #gatewayTransactionId = :gatewayTransactionId, #deliveryId = :deliveryId, #resolvedAt = :resolvedAt, #updatedAt = :updatedAt',
        ConditionExpression: '#status = :pending',
        ExpressionAttributeNames: {
          '#status': 'status',
          '#gatewayTransactionId': 'gatewayTransactionId',
          '#deliveryId': 'deliveryId',
          '#resolvedAt': 'resolvedAt',
          '#updatedAt': 'updatedAt',
        },
        ExpressionAttributeValues: {
          ':status': 'APPROVED',
          ':gatewayTransactionId': 'gw-tx-1',
          ':deliveryId': DELIVERY_ID,
          ':resolvedAt': '2026-10-09T15:00:05.000Z',
          ':updatedAt': '2026-10-09T15:00:00.000Z',
          ':pending': 'PENDING',
        },
      },
    });
    expect(items?.[1]).toEqual({
      Update: {
        TableName: 'test-products',
        Key: { id: PRODUCT_ID },
        UpdateExpression: 'SET #stock = #stock - :quantity, #updatedAt = :now',
        ConditionExpression: '#stock >= :quantity',
        ExpressionAttributeNames: { '#stock': 'stock', '#updatedAt': 'updatedAt' },
        ExpressionAttributeValues: { ':quantity': 2, ':now': '2026-10-09T15:00:00.000Z' },
      },
    });
    expect(items?.[2]).toEqual({
      Put: {
        TableName: 'test-deliveries',
        Item: toDeliveryItem(delivery),
        ConditionExpression: 'attribute_not_exists(id)',
      },
    });
  });

  it('AC-12: reports ALREADY_RESOLVED when the status condition fails', async () => {
    dynamo
      .on(TransactWriteCommand)
      .rejects(cancelled('ConditionalCheckFailed', 'ConditionalCheckFailed', 'None'));

    expect(expectOk(await repository.resolveApproved(approved, delivery))).toBe('ALREADY_RESOLVED');
  });

  it('AC-10: reports OUT_OF_STOCK when only the stock condition fails', async () => {
    dynamo.on(TransactWriteCommand).rejects(cancelled('None', 'ConditionalCheckFailed', 'None'));

    expect(expectOk(await repository.resolveApproved(approved, delivery))).toBe('OUT_OF_STOCK');
  });

  it.each([
    ['a delivery id collision', cancelled('None', 'None', 'ConditionalCheckFailed')],
    ['a transaction conflict', cancelled('TransactionConflict', 'None', 'None')],
    ['a throttled request', Object.assign(new Error('slow down'), { name: 'ThrottlingException' })],
  ])('AC-17: converts %s into PERSISTENCE_ERROR', async (_name, cause) => {
    dynamo.on(TransactWriteCommand).rejects(cause);

    expectErr(await repository.resolveApproved(approved, delivery), 'PERSISTENCE_ERROR');
  });
});

describe('DynamoDbTransactionRepository.resolveFailed (write C)', () => {
  const declined = aTransaction().declined().build();

  it('AC-2: sets the final status with a PENDING condition and leaves stock alone', async () => {
    dynamo.on(UpdateCommand).resolves({});

    expect(expectOk(await repository.resolveFailed(declined))).toBe('APPLIED');

    const input = dynamo.commandCalls(UpdateCommand)[0].args[0].input;
    expect(input).toMatchObject({
      TableName: 'test-transactions',
      Key: { id: TRANSACTION_ID },
      ConditionExpression: '#status = :pending',
    });
    expect(input.UpdateExpression).toBe(
      'SET #status = :status, #statusMessage = :statusMessage, #gatewayTransactionId = :gatewayTransactionId, #resolvedAt = :resolvedAt, #updatedAt = :updatedAt',
    );
    expect(input.ExpressionAttributeValues).toMatchObject({
      ':status': 'DECLINED',
      ':statusMessage': 'Insufficient funds',
      ':pending': 'PENDING',
    });
    expect(dynamo.commandCalls(TransactWriteCommand)).toHaveLength(0);
  });

  it('AC-12: reports ALREADY_RESOLVED when the condition fails', async () => {
    dynamo.on(UpdateCommand).rejects(conditionFailed());

    expect(expectOk(await repository.resolveFailed(declined))).toBe('ALREADY_RESOLVED');
  });

  it('AC-17: converts any other failure into PERSISTENCE_ERROR', async () => {
    dynamo.on(UpdateCommand).rejects(new Error('boom'));
    expectErr(await repository.resolveFailed(declined), 'PERSISTENCE_ERROR');

    dynamo.on(UpdateCommand).rejects('not an error object');
    expectErr(await repository.resolveFailed(declined), 'PERSISTENCE_ERROR');
  });
});
