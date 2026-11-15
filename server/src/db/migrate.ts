import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { env } from '../env';

const connection = postgres(env.DATABASE_URL, { max: 1, onnotice: () => {} });

try {
  await migrate(drizzle(connection), { migrationsFolder: './drizzle' });
  console.log('migrasi selesai');
} finally {
  await connection.end();
}
