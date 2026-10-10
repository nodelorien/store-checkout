import { createDocumentClient } from '../shared/dynamodb/dynamodb.client';
import { seedProducts } from './seed-runner';

/**
 * Optional Lambda entry point for seeding in AWS (for example from a CDK trigger after deploy).
 * Needs only `TABLE_PRODUCTS` and write access to that table.
 */
export async function handler(): Promise<{ seeded: number }> {
  const table = process.env.TABLE_PRODUCTS;
  if (!table) {
    throw new Error('TABLE_PRODUCTS is required');
  }
  const client = createDocumentClient({ region: process.env.AWS_REGION ?? 'us-east-1' });
  return { seeded: await seedProducts(client, table) };
}
