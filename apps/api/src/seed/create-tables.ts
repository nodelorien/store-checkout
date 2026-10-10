import { createTables, loadSeedClient, tableNamesFromEnv } from './seed-runner';

/** `npm run tables:create -w apps/api` — creates the four tables in DynamoDB Local. */
async function main(): Promise<void> {
  const created = await createTables(loadSeedClient(), tableNamesFromEnv());
  console.warn(created.length > 0 ? `Created: ${created.join(', ')}` : 'All tables already exist');
}

main().catch((error: unknown) => {
  console.error('Table creation failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
