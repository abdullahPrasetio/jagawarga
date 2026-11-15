import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { notifications } from '../../db/schema';
import { decodeCursor, encodeCursor, pageSize } from '../../lib/http';
import { ApiError } from '../../lib/problem';
import { db } from '../../db/client';

export const notificationRoutes = new Hono();

notificationRoutes.get('/notifications', async (c) => {
  const auth = c.get('auth');
  const limit = pageSize(c);
  const cursor = decodeCursor(c.req.query('cursor'));

  const conditions = [
    eq(notifications.communityId, auth.communityId!),
    eq(notifications.userId, auth.userId),
  ];
  if (cursor) {
    conditions.push(
      sql`(${notifications.createdAt}, ${notifications.id}) < (${cursor.createdAt.toISOString()}::timestamptz, ${cursor.id}::uuid)`,
    );
  }

  const rows = await db
    .select()
    .from(notifications)
    .where(and(...conditions))
    .orderBy(desc(notifications.createdAt), desc(notifications.id))
    .limit(limit + 1);

  const pageRows = rows.slice(0, limit);
  const last = pageRows.at(-1);

  return c.json({
    items: pageRows.map((row) => ({
      id: row.id,
      type: row.type,
      title: row.title,
      body: row.body,
      data: row.data as Record<string, unknown>,
      readAt: row.readAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    })),
    nextCursor: rows.length > limit && last ? encodeCursor(last.createdAt, last.id) : null,
  });
});

notificationRoutes.get('/notifications/unread-count', async (c) => {
  const auth = c.get('auth');

  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(notifications)
    .where(
      and(
        eq(notifications.communityId, auth.communityId!),
        eq(notifications.userId, auth.userId),
        isNull(notifications.readAt),
      ),
    );

  return c.json({ count: row?.count ?? 0 });
});

notificationRoutes.post('/notifications/:id/read', async (c) => {
  const auth = c.get('auth');

  const [updated] = await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(notifications.id, c.req.param('id')),
        eq(notifications.userId, auth.userId),
        eq(notifications.communityId, auth.communityId!),
      ),
    )
    .returning({ id: notifications.id });

  if (!updated) throw new ApiError(404, 'not_found', 'Notifikasi tidak ditemukan');

  return c.json({ ok: true });
});
