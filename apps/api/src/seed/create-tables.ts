import { createTables, loadSeedSettings } from './seed-runner';

/** `npm run tables:create -w apps/api` — creates the four tables in DynamoDB Local. */
async function main(): Promise<void> {
  const { client, tables } = loadSeedSettings();
  const created = await createTables(client, tables);
  console.warn(created.length > 0 ? `Created: ${created.join(', ')}` : 'All tables already exist');
}

main().catch((error: unknown) => {
  console.error('Table creation failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
