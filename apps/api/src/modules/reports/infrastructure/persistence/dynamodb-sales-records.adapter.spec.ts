import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';
import { aTransaction } from '../../../../../test/builders/transaction.builder';
import { expectErr, expectOk } from '../../../../../test/helpers/result-assertions';
import { testConfig } from '../../../../../test/helpers/test-config';
import { createDocumentClient } from '../../../../shared/dynamodb/dynamodb.client';
import { toTransactionItem } from '../../../transactions/infrastructure/persistence/transaction.mapper';
import { DynamoDbSalesRecordsAdapter, toSalesRecord } from './dynamodb-sales-records.adapter';

const dynamo = mockClient(DynamoDBDocumentClient);
const config = testConfig();
const adapter = new DynamoDbSalesRecordsAdapter(createDocumentClient(config.aws), config);
const SINCE = '2026-09-27T05:00:00.000Z';

beforeEach(() => dynamo.reset());

describe('toSalesRecord', () => {
  it('AC-8: keeps only the aggregate facts of a stored transaction', () => {
    const record = toSalesRecord(toTransactionItem(aTransaction().approved().build()));

    expect(record).toEqual({
      status: 'APPROVED',
      productId: '6f1d2c3b-4a5e-4f60-8a7b-9c0d1e2f3a4b',
      productName: 'Aurora Desk Lamp',
      quantity: 2,
      totalInCents: 27_030_000,
      cardBrand: 'VISA',
      createdAt: '2026-10-09T15:00:00.000Z',
    });
  });

  it('tolerates an item without the product name snapshot', () => {
    expect(toSalesRecord({ status: 'PENDING' }).productName).toBe('');
  });
});

describe('DynamoDbSalesRecordsAdapter', () => {
  it('AC-10: scans the transactions table from the given instant and follows pagination', async () => {
    const first = toTransactionItem(aTransaction().approved().build());
    const second = toTransactionItem(aTransaction().declined().build());
    dynamo
      .on(ScanCommand)
      .resolvesOnce({ Items: [first], LastEvaluatedKey: { id: 'tx-1' } })
      .resolvesOnce({ Items: [], LastEvaluatedKey: { id: 'tx-2' } })
      .resolvesOnce({ Items: [second] });

    const records = expectOk(await adapter.findCreatedSince(SINCE));

    expect(records.map((record) => record.status)).toEqual(['APPROVED', 'DECLINED']);
    const calls = dynamo.commandCalls(ScanCommand);
    expect(calls).toHaveLength(3);
    expect(calls[0].args[0].input).toEqual({
      TableName: 'test-transactions',
      FilterExpression: '#createdAt >= :from AND attribute_exists(#status)',
      ProjectionExpression:
        '#status, #productId, #productName, #quantity, #totalInCents, #cardBrand, #createdAt',
      ExpressionAttributeNames: {
        '#status': 'status',
        '#productId': 'productId',
        '#productName': 'productName',
        '#quantity': 'quantity',
        '#totalInCents': 'totalInCents',
        '#cardBrand': 'cardBrand',
        '#createdAt': 'createdAt',
      },
      ExpressionAttributeValues: { ':from': SINCE },
      ExclusiveStartKey: undefined,
    });
    expect(calls[1].args[0].input.ExclusiveStartKey).toEqual({ id: 'tx-1' });
    expect(calls[2].args[0].input.ExclusiveStartKey).toEqual({ id: 'tx-2' });
  });

  it('AC-8: never asks the store for personal or per-order attributes', async () => {
    dynamo.on(ScanCommand).resolves({});

    await adapter.findCreatedSince(SINCE);

    const { ProjectionExpression } = dynamo.commandCalls(ScanCommand)[0].args[0].input;
    expect(ProjectionExpression).not.toMatch(
      /customer|address|reference|lastFour|idempotency|gateway|#id\b/i,
    );
  });

  it('AC-10: returns an empty list when nothing matches', async () => {
    dynamo.on(ScanCommand).resolves({});

    expect(expectOk(await adapter.findCreatedSince(SINCE))).toEqual([]);
  });

  it('AC-10: converts a scan failure into PERSISTENCE_ERROR', async () => {
    dynamo.on(ScanCommand).rejects(new Error('boom'));

    expectErr(await adapter.findCreatedSince(SINCE), 'PERSISTENCE_ERROR');
  });
});
