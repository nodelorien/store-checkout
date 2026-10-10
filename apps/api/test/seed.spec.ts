import { CreateTableCommand } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';
import { Money } from '../src/modules/products/domain/money';
import { SEED_PRODUCTS } from '../src/seed/products';
import { createTables, seedProducts } from '../src/seed/seed-runner';
import { tableDefinitions } from '../src/seed/table-definitions';
import { createDocumentClient } from '../src/shared/dynamodb/dynamodb.client';
import { testConfig } from './helpers/test-config';

const dynamo = mockClient(DynamoDBDocumentClient);
const config = testConfig();
const client = createDocumentClient(config.aws);

beforeEach(() => dynamo.reset());

describe('seed data', () => {
  const slugOf = (imageUrl: string): string =>
    imageUrl.replace('/images/catalog/', '').replace('.svg', '');

  it('AC-9: contains exactly the six agreed products with SVG images', () => {
    expect(SEED_PRODUCTS.map((product) => slugOf(product.imageUrl))).toEqual([
      'aurora-desk-lamp',
      'nimbus-headphones',
      'terra-backpack',
      'pulse-smartwatch',
      'ember-coffee-grinder',
      'drift-mechanical-keyboard',
    ]);
    for (const product of SEED_PRODUCTS) {
      expect(product.imageUrl).toMatch(/^\/images\/catalog\/[a-z-]+\.svg$/);
    }
  });

  it('AC-9: uses fixed unique UUIDs and valid integer-cent COP prices', () => {
    const ids = SEED_PRODUCTS.map((product) => product.id);

    expect(new Set(ids).size).toBe(6);
    for (const product of SEED_PRODUCTS) {
      expect(product.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      );
      expect(Money.of(product.priceInCents).isOk()).toBe(true);
      expect(product.priceInCents % 100).toBe(0);
      expect(product.currency).toBe('COP');
      expect(product.description.length).toBeGreaterThan(40);
    }
  });

  it('AC-9: has the edge-case stocks (grinder 1, keyboard 0)', () => {
    const stockBySlug = Object.fromEntries(
      SEED_PRODUCTS.map((product) => [slugOf(product.imageUrl), product.stock]),
    );

    expect(stockBySlug['ember-coffee-grinder']).toBe(1);
    expect(stockBySlug['drift-mechanical-keyboard']).toBe(0);
  });
});

describe('seedProducts', () => {
  it('AC-9: puts every product with its fixed id (idempotent)', async () => {
    dynamo.on(PutCommand).resolves({});

    expect(await seedProducts(client, 'test-products')).toBe(6);
    await seedProducts(client, 'test-products');

    const calls = dynamo.commandCalls(PutCommand);
    expect(calls).toHaveLength(12);
    expect(calls[0].args[0].input).toEqual({ TableName: 'test-products', Item: SEED_PRODUCTS[0] });
    expect(calls[6].args[0].input).toEqual(calls[0].args[0].input);
  });
});

describe('createTables', () => {
  it('defines the four tables with the documented keys and indexes', () => {
    const definitions = tableDefinitions(config.tables);

    expect(definitions.map((definition) => definition.TableName)).toEqual([
      'test-products',
      'test-customers',
      'test-transactions',
      'test-deliveries',
    ]);
    expect(definitions[0].GlobalSecondaryIndexes).toBeUndefined();
    expect(definitions[1].GlobalSecondaryIndexes?.map((gsi) => gsi.IndexName)).toEqual(['byEmail']);
    expect(definitions[2].GlobalSecondaryIndexes?.map((gsi) => gsi.IndexName)).toEqual([
      'byReference',
      'byIdempotencyKey',
    ]);
    expect(definitions[3].GlobalSecondaryIndexes?.[0].KeySchema).toEqual([
      { AttributeName: 'transactionId', KeyType: 'HASH' },
    ]);
    for (const definition of definitions) {
      expect(definition.BillingMode).toBe('PAY_PER_REQUEST');
      expect(definition.KeySchema).toEqual([{ AttributeName: 'id', KeyType: 'HASH' }]);
    }
  });

  it('creates missing tables and skips the ones that already exist', async () => {
    const inUse = Object.assign(new Error('exists'), { name: 'ResourceInUseException' });
    dynamo
      .on(CreateTableCommand)
      .resolves({})
      .on(CreateTableCommand, { TableName: 'test-customers' })
      .rejects(inUse);

    expect(await createTables(client, config.tables)).toEqual([
      'test-products',
      'test-transactions',
      'test-deliveries',
    ]);
  });

  it('fails on any other error', async () => {
    dynamo.on(CreateTableCommand).rejects(new Error('network'));

    await expect(createTables(client, config.tables)).rejects.toThrow('network');
  });
});
