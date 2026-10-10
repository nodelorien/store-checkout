import { loadSeedSettings, seedProducts } from './seed-runner';

/** `npm run seed -w apps/api` — inserts the dummy products (local DynamoDB or AWS, per env). */
async function main(): Promise<void> {
  const { client, tables } = loadSeedSettings();
  const count = await seedProducts(client, tables.products);
  console.warn(`Seeded ${count} products into ${tables.products}`);
}

main().catch((error: unknown) => {
  console.error('Seed failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
