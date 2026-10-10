import { loadSeedClient, productsTableFromEnv, seedProducts } from './seed-runner';

/** `npm run seed -w apps/api` — inserts the dummy products (local DynamoDB or AWS, per env). */
async function main(): Promise<void> {
  const client = loadSeedClient();
  const table = productsTableFromEnv();
  const count = await seedProducts(client, table);
  console.warn(`Seeded ${count} products into ${table}`);
}

main().catch((error: unknown) => {
  console.error('Seed failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
