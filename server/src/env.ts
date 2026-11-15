import { z } from 'zod';
import { loadDotEnv } from './lib/dotenv';

loadDotEnv();

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  PORT: z.coerce.number().int().positive().default(8787),
  MEDIA_DIR: z.string().default('./data/media'),
  PUBLIC_BASE_URL: z.string().default('http://localhost:8787'),
  APP_ENV: z.enum(['development', 'test', 'production']).default('development'),
  CORS_ORIGINS: z.string().default(''),
  FCM_SERVICE_ACCOUNT_JSON: z.string().default(''),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const missing = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
  console.error('Konfigurasi environment tidak valid:\n- ' + missing.join('\n- '));
  process.exit(1);
}

export const env = parsed.data;

export const isProduction = env.APP_ENV === 'production';

export const cookieSecure = env.PUBLIC_BASE_URL.startsWith('https://');

export const corsOrigins = env.CORS_ORIGINS.split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
