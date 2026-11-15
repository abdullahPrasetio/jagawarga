import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env } from '../env';
import * as schema from './schema';

export const sql = postgres(env.DATABASE_URL, {
  max: 10,
  idle_timeout: 20,
  onnotice: () => {},
});

export const db = drizzle(sql, { schema });

export type Db = typeof db;
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
