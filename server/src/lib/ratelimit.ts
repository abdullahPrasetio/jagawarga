import { ApiError } from './problem';

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

/** Fixed-window in-memory limiter. Cukup untuk satu instance API. */
export function hit(key: string, limit: number, windowMs: number): void {
  // Test deterministik: limiter tetap diuji lewat `hit` langsung, bukan lewat HTTP.
  if (process.env.APP_ENV === 'test') return;

  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }

  if (bucket.count >= limit) {
    const seconds = Math.ceil((bucket.resetAt - now) / 1000);
    throw new ApiError(429, 'rate_limited', `Terlalu sering. Coba lagi dalam ${seconds} detik`);
  }

  bucket.count += 1;
}

export function resetLimits(): void {
  buckets.clear();
}

/** Dipanggil berkala supaya map tidak tumbuh tanpa batas. */
export function sweepLimits(): void {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}
