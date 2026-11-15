import type { Context } from 'hono';
import { z } from 'zod';
import { ApiError } from './problem';

export async function parseJson<T extends z.ZodTypeAny>(c: Context, schema: T): Promise<z.infer<T>> {
  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    throw new ApiError(400, 'validation_failed', 'Body harus JSON yang valid');
  }
  return schema.parse(raw) as z.infer<T>;
}

/** Menerima JSON atau multipart; body hanya dibaca sekali. */
export async function parseFormOrJson<T extends z.ZodTypeAny>(
  c: Context,
  schema: T,
): Promise<{ data: z.infer<T>; file: File | null }> {
  const contentType = c.req.header('content-type') ?? '';

  if (contentType.includes('application/json')) {
    return { data: await parseJson(c, schema), file: null };
  }

  const form = await c.req.parseBody();
  const candidate = form['file'];

  return {
    data: schema.parse(form) as z.infer<T>,
    file: candidate instanceof File && candidate.size > 0 ? candidate : null,
  };
}

export function decodeCursor(raw: string | undefined): { createdAt: Date; id: string } | null {
  if (!raw) return null;
  try {
    const [iso, id] = Buffer.from(raw, 'base64url').toString('utf8').split('|');
    if (!iso || !id) return null;
    const createdAt = new Date(iso);
    if (Number.isNaN(createdAt.getTime())) return null;
    return { createdAt, id };
  } catch {
    return null;
  }
}

export function encodeCursor(createdAt: Date, id: string): string {
  return Buffer.from(`${createdAt.toISOString()}|${id}`, 'utf8').toString('base64url');
}

export function pageSize(c: Context, fallback = 20, max = 50): number {
  const raw = Number(new URL(c.req.url).searchParams.get('limit') ?? fallback);
  if (!Number.isFinite(raw)) return fallback;
  return Math.min(Math.max(Math.trunc(raw), 1), max);
}
