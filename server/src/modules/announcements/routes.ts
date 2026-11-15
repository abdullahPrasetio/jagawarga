import { and, desc, eq, isNotNull, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import {
  announcementCreateSchema,
  announcementPatchSchema,
  type AnnouncementDto,
} from '../../contracts';
import { db } from '../../db/client';
import { announcements, users } from '../../db/schema';
import { decodeCursor, encodeCursor, pageSize, parseJson } from '../../lib/http';
import { notifyCommunity } from '../../lib/notify';
import { ensure } from '../../lib/permissions';
import { ApiError } from '../../lib/problem';
import { publish } from '../../lib/sse';

export const announcementRoutes = new Hono();

type Row = {
  id: string;
  title: string;
  body: string;
  category: string;
  isPinned: boolean;
  attachmentMediaId: string | null;
  authorName: string;
  publishedAt: Date | null;
  createdAt: Date;
};

function toDto(row: Row): AnnouncementDto {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    category: row.category as AnnouncementDto['category'],
    isPinned: row.isPinned,
    attachmentMediaId: row.attachmentMediaId,
    authorName: row.authorName,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

const columns = {
  id: announcements.id,
  title: announcements.title,
  body: announcements.body,
  category: announcements.category,
  isPinned: announcements.isPinned,
  attachmentMediaId: announcements.attachmentMediaId,
  authorName: users.name,
  publishedAt: announcements.publishedAt,
  createdAt: announcements.createdAt,
};

async function fetchAnnouncement(communityId: string, id: string): Promise<AnnouncementDto> {
  const [row] = await db
    .select(columns)
    .from(announcements)
    .innerJoin(users, eq(users.id, announcements.authorId))
    .where(and(eq(announcements.id, id), eq(announcements.communityId, communityId)))
    .limit(1);

  if (!row) throw new ApiError(404, 'not_found', 'Pengumuman tidak ditemukan');
  return toDto(row);
}

announcementRoutes.get('/announcements', async (c) => {
  const auth = c.get('auth');
  ensure(auth, 'announcements.read');

  const isStaff = auth.role === 'admin' || auth.role === 'pengurus';
  const includeDrafts = isStaff && c.req.query('includeDrafts') === 'true';
  const category = c.req.query('category');
  const limit = pageSize(c);
  const cursor = decodeCursor(c.req.query('cursor'));

  const conditions = [eq(announcements.communityId, auth.communityId!)];
  if (!includeDrafts) conditions.push(isNotNull(announcements.publishedAt));
  if (category) conditions.push(eq(announcements.category, category));
  if (cursor) {
    conditions.push(
      sql`(${announcements.publishedAt}, ${announcements.id}) < (${cursor.createdAt.toISOString()}::timestamptz, ${cursor.id}::uuid)`,
    );
  }

  const rows = await db
    .select(columns)
    .from(announcements)
    .innerJoin(users, eq(users.id, announcements.authorId))
    .where(and(...conditions))
    .orderBy(desc(announcements.isPinned), desc(announcements.publishedAt), desc(announcements.createdAt))
    .limit(limit + 1);

  const page = rows.slice(0, limit);
  const last = page.at(-1);

  return c.json({
    items: page.map(toDto),
    nextCursor:
      rows.length > limit && last
        ? encodeCursor(last.publishedAt ?? last.createdAt, last.id)
        : null,
  });
});

announcementRoutes.get('/announcements/:id', async (c) => {
  const auth = c.get('auth');
  ensure(auth, 'announcements.read');

  const [row] = await db
    .select(columns)
    .from(announcements)
    .innerJoin(users, eq(users.id, announcements.authorId))
    .where(
      and(eq(announcements.id, c.req.param('id')), eq(announcements.communityId, auth.communityId!)),
    )
    .limit(1);

  if (!row) throw new ApiError(404, 'not_found', 'Pengumuman tidak ditemukan');
  return c.json(toDto(row));
});

announcementRoutes.post('/announcements', async (c) => {
  const auth = c.get('auth');
  ensure(auth, 'announcements.write');
  const body = await parseJson(c, announcementCreateSchema);

  const [created] = await db
    .insert(announcements)
    .values({
      communityId: auth.communityId!,
      authorId: auth.userId,
      title: body.title,
      body: body.body,
      category: body.category,
      isPinned: body.isPinned ?? false,
      attachmentMediaId: body.attachmentMediaId ?? null,
    })
    .returning();

  if (!created) throw new ApiError(500, 'internal_error', 'Gagal membuat pengumuman');

  const dto = await fetchAnnouncement(auth.communityId!, created.id);
  return c.json(dto, 201);
});

announcementRoutes.patch('/announcements/:id', async (c) => {
  const auth = c.get('auth');
  ensure(auth, 'announcements.write');
  const body = await parseJson(c, announcementPatchSchema);

  const [updated] = await db
    .update(announcements)
    .set(body)
    .where(
      and(eq(announcements.id, c.req.param('id')), eq(announcements.communityId, auth.communityId!)),
    )
    .returning();

  if (!updated) throw new ApiError(404, 'not_found', 'Pengumuman tidak ditemukan');

  return c.json(await fetchAnnouncement(auth.communityId!, updated.id));
});

announcementRoutes.post('/announcements/:id/publish', async (c) => {
  const auth = c.get('auth');
  ensure(auth, 'announcements.write');

  const [published] = await db
    .update(announcements)
    .set({ publishedAt: new Date() })
    .where(
      and(eq(announcements.id, c.req.param('id')), eq(announcements.communityId, auth.communityId!)),
    )
    .returning();

  if (!published) throw new ApiError(404, 'not_found', 'Pengumuman tidak ditemukan');

  const dto = await fetchAnnouncement(auth.communityId!, published.id);
  publish(auth.communityId!, 'announcement.published', dto);

  await notifyCommunity({
    communityId: auth.communityId!,
    type: 'announcement',
    title: published.title,
    body: published.body.slice(0, 140),
    data: { type: 'announcement', announcementId: published.id },
  });

  return c.json(dto);
});

announcementRoutes.delete('/announcements/:id', async (c) => {
  const auth = c.get('auth');
  ensure(auth, 'announcements.write');

  const deleted = await db
    .delete(announcements)
    .where(
      and(eq(announcements.id, c.req.param('id')), eq(announcements.communityId, auth.communityId!)),
    )
    .returning({ id: announcements.id });

  if (deleted.length === 0) throw new ApiError(404, 'not_found', 'Pengumuman tidak ditemukan');

  return c.json({ ok: true });
});
