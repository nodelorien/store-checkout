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

  it('AC-9: contains exactly the eighteen agreed products, in order, with SVG images', () => {
    expect(SEED_PRODUCTS.map((product) => slugOf(product.imageUrl))).toEqual([
      'aurora-desk-lamp',
      'nimbus-headphones',
      'terra-backpack',
      'pulse-smartwatch',
      'ember-coffee-grinder',
      'drift-mechanical-keyboard',
      'halo-smart-speaker',
      'vertex-wireless-mouse',
      'orbit-wireless-charger',
      'prism-4k-monitor',
      'echo-wireless-earbuds',
      'flux-power-bank',
      'nova-2k-webcam',
      'atlas-laptop-stand',
      'zen-air-purifier',
      'pixel-instant-camera',
      'volt-usb-c-hub',
      'lumen-smart-bulb',
    ]);
    for (const product of SEED_PRODUCTS) {
      expect(product.imageUrl).toMatch(/^\/images\/catalog\/[a-z0-9-]+\.svg$/);
    }
  });

  it('AC-9: keeps the original six untouched and appends the twelve new ones', () => {
    const summary = SEED_PRODUCTS.map(
      (product) =>
        [product.id.slice(-2), product.name, product.priceInCents, product.stock] as const,
    );

    expect(summary).toEqual([
      ['01', 'Aurora Desk Lamp', 18_990_000, 12],
      ['02', 'Nimbus Headphones', 45_990_000, 8],
      ['03', 'Terra Backpack', 24_990_000, 25],
      ['04', 'Pulse Smartwatch', 69_990_000, 5],
      ['05', 'Ember Coffee Grinder', 32_990_000, 1],
      ['06', 'Drift Mechanical Keyboard', 38_990_000, 0],
      ['07', 'Halo Smart Speaker', 27_990_000, 14],
      ['08', 'Vertex Wireless Mouse', 14_990_000, 30],
      ['09', 'Orbit Wireless Charger', 11_990_000, 22],
      ['0a', 'Prism 4K Monitor', 149_990_000, 4],
      ['0b', 'Echo Wireless Earbuds', 32_990_000, 18],
      ['0c', 'Flux Power Bank', 15_990_000, 40],
      ['0d', 'Nova 2K Webcam', 21_990_000, 9],
      ['0e', 'Atlas Laptop Stand', 13_990_000, 16],
      ['0f', 'Zen Air Purifier', 54_990_000, 6],
      ['10', 'Pixel Instant Camera', 42_990_000, 3],
      ['11', 'Volt USB-C Hub', 18_990_000, 27],
      ['12', 'Lumen Smart Bulb', 5_990_000, 60],
    ]);
    expect(new Set(SEED_PRODUCTS.map((product) => product.id.slice(0, -2)))).toEqual(
      new Set(['3f2a9c1e-5b7d-4e8a-9c21-0a1b2c3d4e']),
    );
  });

  it('AC-9: uses fixed unique UUIDs and valid integer-cent COP prices', () => {
    const ids = SEED_PRODUCTS.map((product) => product.id);

    expect(new Set(ids).size).toBe(18);
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

    expect(await seedProducts(client, 'test-products')).toBe(18);
    await seedProducts(client, 'test-products');

    const calls = dynamo.commandCalls(PutCommand);
    expect(calls).toHaveLength(36);
    expect(calls[0].args[0].input).toEqual({ TableName: 'test-products', Item: SEED_PRODUCTS[0] });
    expect(calls[18].args[0].input).toEqual(calls[0].args[0].input);
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
