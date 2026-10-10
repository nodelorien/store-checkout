import { existsSync } from 'node:fs';
import { CreateTableCommand } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { createDocumentClient } from '../shared/dynamodb/dynamodb.client';
import { SEED_PRODUCTS } from './products';
import { tableDefinitions, TableNames } from './table-definitions';

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

/** Client for the scripts, configured from `.env` when present (no gateway variables needed). */
export function loadSeedClient(): DynamoDBDocumentClient {
  if (existsSync('.env')) {
    process.loadEnvFile('.env');
  }
  return createDocumentClient({
    region: process.env.AWS_REGION ?? 'us-east-1',
    dynamoEndpoint: process.env.DYNAMODB_ENDPOINT?.trim() || undefined,
  });
}

/** The seed only needs the products table (this is what a deploy pipeline provides). */
export function productsTableFromEnv(): string {
  return required('TABLE_PRODUCTS');
}

export function tableNamesFromEnv(): TableNames {
  return {
    products: required('TABLE_PRODUCTS'),
    customers: required('TABLE_CUSTOMERS'),
    transactions: required('TABLE_TRANSACTIONS'),
    deliveries: required('TABLE_DELIVERIES'),
  };
}

/** Idempotent: `PutItem` with fixed ids. Re-running resets the stock of every seeded product. */
export async function seedProducts(
  client: DynamoDBDocumentClient,
  productsTable: string,
): Promise<number> {
  for (const item of SEED_PRODUCTS) {
    await client.send(new PutCommand({ TableName: productsTable, Item: { ...item } }));
  }
  return SEED_PRODUCTS.length;
}

/** Creates the four tables; tables that already exist are left untouched. */
export async function createTables(
  client: DynamoDBDocumentClient,
  tables: TableNames,
): Promise<string[]> {
  const created: string[] = [];
  for (const definition of tableDefinitions(tables)) {
    try {
      await client.send(new CreateTableCommand(definition));
      created.push(String(definition.TableName));
    } catch (error) {
      if (!(error instanceof Error) || error.name !== 'ResourceInUseException') {
        throw error;
      }
    }
  }
  return created;
}
