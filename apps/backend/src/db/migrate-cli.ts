import { closeDb, createDb } from './client.js';
import { runMigrations } from './migrate.js';

const url = process.env.DATABASE_URL ?? 'pglite://.data/dev';
const db = await createDb(url);
try {
  await runMigrations(db);
  console.log(JSON.stringify({ event: 'migrations.applied', databaseUrl: url.split('://')[0] }));
} finally {
  await closeDb(db);
}
