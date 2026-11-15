import { defineConfig } from 'drizzle-kit';
import { loadDotEnv } from './src/lib/dotenv';

loadDotEnv();

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgres://jagawarga:jagawarga@localhost:5433/jagawarga',
  },
  verbose: true,
  strict: false,
});
