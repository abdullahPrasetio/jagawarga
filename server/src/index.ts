import { app } from './app';
import { env } from './env';
import { sweepLimits } from './lib/ratelimit';
import { sql } from './db/client';

setInterval(sweepLimits, 60_000);

const shutdown = async () => {
  await sql.end({ timeout: 5 });
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

console.log(`Jaga Warga API listening on :${env.PORT} (${env.APP_ENV})`);

export default {
  port: env.PORT,
  fetch: app.fetch,
  // Default Bun terlalu kecil untuk bukti transfer dari kamera ponsel.
  maxRequestBodySize: 10 * 1024 * 1024,
};
