import { closeDb, createDb } from './client.js';
import { runMigrations } from './migrate.js';
import { seedDemo } from './seed.js';

const url = process.env.DATABASE_URL ?? 'pglite://.data/dev';
const db = await createDb(url);
try {
  await runMigrations(db);
  await seedDemo(db);
  console.log(JSON.stringify({ event: 'seed.applied', databaseUrl: url.split('://')[0] }));
} finally {
  await closeDb(db);
}
