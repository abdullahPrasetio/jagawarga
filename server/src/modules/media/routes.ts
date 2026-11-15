import { and, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { db } from '../../db/client';
import { media } from '../../db/schema';
import { ensure } from '../../lib/permissions';
import { ApiError } from '../../lib/problem';
import { hit } from '../../lib/ratelimit';
import { mediaPath, saveImage } from '../../lib/storage';

export const mediaRoutes = new Hono();

mediaRoutes.post('/media', async (c) => {
  const auth = c.get('auth');
  ensure(auth, 'media.upload');

  hit(`media:${auth.userId}:day`, 10, 24 * 60 * 60 * 1000);

  const body = await c.req.parseBody();
  const file = body['file'];

  if (!(file instanceof File)) {
    throw new ApiError(400, 'validation_failed', 'Field "file" wajib berisi gambar');
  }

  const saved = await saveImage(auth.communityId!, file);

  const [row] = await db
    .insert(media)
    .values({
      communityId: auth.communityId!,
      ownerId: auth.userId,
      mime: saved.mime,
      bytes: saved.bytes,
      storageKey: saved.storageKey,
    })
    .returning({ id: media.id });

  if (!row) throw new ApiError(500, 'internal_error', 'Gagal menyimpan media');

  return c.json(
    {
      id: row.id,
      url: `/api/v1/media/${row.id}/raw`,
      mime: saved.mime,
      bytes: saved.bytes,
    },
    201,
  );
});

mediaRoutes.get('/media/:id/raw', async (c) => {
  const auth = c.get('auth');
  ensure(auth, 'media.read');

  const [row] = await db
    .select()
    .from(media)
    .where(and(eq(media.id, c.req.param('id')), eq(media.communityId, auth.communityId!)))
    .limit(1);

  if (!row) throw new ApiError(404, 'not_found', 'Media tidak ditemukan');

  const file = Bun.file(mediaPath(row.storageKey));
  if (!(await file.exists())) throw new ApiError(404, 'not_found', 'Berkas media hilang');

  return new Response(file.stream(), {
    headers: {
      'content-type': row.mime,
      'content-length': String(row.bytes),
      'cache-control': 'private, max-age=31536000, immutable',
      'x-content-type-options': 'nosniff',
    },
  });
});
