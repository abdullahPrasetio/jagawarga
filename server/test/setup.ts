import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { loadDotEnv } from '../src/lib/dotenv';

loadDotEnv();

const testUrl = process.env.TEST_DATABASE_URL;

if (!testUrl) {
  throw new Error('TEST_DATABASE_URL belum diisi. Jalankan `make db` lalu isi .env.');
}

process.env.DATABASE_URL = testUrl;
process.env.APP_ENV = 'test';
process.env.FCM_SERVICE_ACCOUNT_JSON = '';
process.env.CORS_ORIGINS = 'http://localhost:5173';

const client = postgres(testUrl, { max: 1, onnotice: () => {} });

await client`drop schema if exists public cascade`;
await client`create schema public`;
await client`drop schema if exists drizzle cascade`;
await migrate(drizzle(client), { migrationsFolder: './drizzle' });
await client.end();
