import type { CreateTableCommandInput } from '@aws-sdk/client-dynamodb';

export interface TableNames {
  readonly products: string;
  readonly customers: string;
  readonly transactions: string;
  readonly deliveries: string;
}

function index(name: string, attribute: string) {
  return {
    IndexName: name,
    KeySchema: [{ AttributeName: attribute, KeyType: 'HASH' as const }],
    Projection: { ProjectionType: 'ALL' as const },
  };
}

function table(
  name: string,
  indexes: Array<{ name: string; attribute: string }> = [],
): CreateTableCommandInput {
  return {
    TableName: name,
    BillingMode: 'PAY_PER_REQUEST',
    KeySchema: [{ AttributeName: 'id', KeyType: 'HASH' }],
    AttributeDefinitions: [
      { AttributeName: 'id', AttributeType: 'S' },
      ...indexes.map((entry) => ({ AttributeName: entry.attribute, AttributeType: 'S' as const })),
    ],
    ...(indexes.length > 0
      ? { GlobalSecondaryIndexes: indexes.map((entry) => index(entry.name, entry.attribute)) }
      : {}),
  };
}

/** Same keys and GSIs as `data-model.md` (and the CDK stack). */
export function tableDefinitions(names: TableNames): CreateTableCommandInput[] {
  return [
    table(names.products),
    table(names.customers, [{ name: 'byEmail', attribute: 'email' }]),
    table(names.transactions, [
      { name: 'byReference', attribute: 'reference' },
      { name: 'byIdempotencyKey', attribute: 'idempotencyKey' },
    ]),
    table(names.deliveries, [{ name: 'byTransaction', attribute: 'transactionId' }]),
  ];
}
