import { and, eq, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import {
  communityCreateSchema,
  communityPatchSchema,
  pushTestSchema,
  type CommunityAdminDto,
  type StatsDto,
} from '../../contracts';
import { db, sql as pg } from '../../db/client';
import { auditLogs, communities, memberships } from '../../db/schema';
import { parseJson } from '../../lib/http';
import { createInvite } from '../../lib/invites';
import { push } from '../../lib/notify';
import { communityTopic, responderTopic } from '../../lib/push';
import { ApiError } from '../../lib/problem';

export const adminRoutes = new Hono();


async function listCommunities(q?: string): Promise<CommunityAdminDto[]> {
  const filter = q ?? '';

  const rows = await pg<
    Array<{
      id: string;
      name: string;
      slug: string;
      address: string | null;
      is_active: boolean;
      created_at: Date;
      member_count: number;
      house_count: number;
      media_bytes: string;
    }>
  >`
    select
      c.id, c.name, c.slug, c.address, c.is_active, c.created_at,
      (select count(*)::int from memberships m where m.community_id = c.id and m.is_active) as member_count,
      (select count(*)::int from houses h where h.community_id = c.id) as house_count,
      (select coalesce(sum(md.bytes), 0)::text from media md where md.community_id = c.id) as media_bytes
    from communities c
    where ${filter}::text = ''
       or c.name ilike '%' || ${filter} || '%'
       or c.slug ilike '%' || ${filter} || '%'
    order by c.created_at desc
  `;

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    address: row.address,
    isActive: row.is_active,
    memberCount: row.member_count,
    houseCount: row.house_count,
    mediaBytes: Number(row.media_bytes ?? 0),
    createdAt: new Date(row.created_at).toISOString(),
  }));
}

adminRoutes.get('/admin/communities', async (c) => {
  const items = await listCommunities(c.req.query('q')?.trim() || undefined);
  return c.json({ items });
});

adminRoutes.post('/admin/communities', async (c) => {
  const auth = c.get('auth');
  const body = await parseJson(c, communityCreateSchema);

  const [community] = await db
    .insert(communities)
    .values({ name: body.name, slug: body.slug, address: body.address ?? null })
    .returning();

  if (!community) throw new ApiError(500, 'internal_error', 'Gagal membuat komunitas');

  await db.insert(auditLogs).values({
    actorId: auth.userId,
    communityId: community.id,
    action: 'community.create',
    targetType: 'community',
    targetId: community.id,
    meta: { slug: community.slug },
  });

  const invite = await createInvite({
    communityId: community.id,
    kind: 'staff',
    role: 'admin',
    houseId: null,
    createdBy: auth.userId,
    days: 30,
  });

  return c.json(
    {
      community: {
        id: community.id,
        name: community.name,
        slug: community.slug,
        address: community.address,
        isActive: community.isActive,
        memberCount: 0,
        houseCount: 0,
        mediaBytes: 0,
        createdAt: community.createdAt.toISOString(),
      } satisfies CommunityAdminDto,
      inviteCode: invite.code,
      inviteExpiresAt: invite.expiresAt.toISOString(),
    },
    201,
  );
});

adminRoutes.patch('/admin/communities/:id', async (c) => {
  const auth = c.get('auth');
  const body = await parseJson(c, communityPatchSchema);
  const communityId = c.req.param('id');

  const [updated] = await db
    .update(communities)
    .set({
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
    })
    .where(eq(communities.id, communityId))
    .returning();

  if (!updated) throw new ApiError(404, 'not_found', 'Komunitas tidak ditemukan');

  if (body.isActive !== undefined) {
    await db.insert(auditLogs).values({
      actorId: auth.userId,
      communityId,
      action: body.isActive ? 'community.activate' : 'community.suspend',
      targetType: 'community',
      targetId: communityId,
    });
  }

  const [item] = await listCommunities().then((items) => items.filter((row) => row.id === communityId));
  if (!item) throw new ApiError(404, 'not_found', 'Komunitas tidak ditemukan');

  return c.json(item);
});

adminRoutes.post('/admin/communities/:id/join', async (c) => {
  const auth = c.get('auth');
  const communityId = c.req.param('id');

  const [community] = await db
    .select()
    .from(communities)
    .where(eq(communities.id, communityId))
    .limit(1);
  if (!community) throw new ApiError(404, 'not_found', 'Komunitas tidak ditemukan');

  const existing = await db
    .select({ id: memberships.id })
    .from(memberships)
    .where(and(eq(memberships.communityId, communityId), eq(memberships.userId, auth.userId)))
    .limit(1)
    .then((rows) => rows[0]);

  if (!existing) {
    await db
      .insert(memberships)
      .values({ communityId, userId: auth.userId, role: 'admin', isActive: true });
    await db.insert(auditLogs).values({
      actorId: auth.userId,
      communityId,
      action: 'community.join',
      targetType: 'community',
      targetId: communityId,
    });
  }

  return c.json({ ok: true, communityId });
});

/**
 * Kirim notifikasi uji ke topic komunitas/petugas. Dipakai saat menyiapkan
 * Firebase untuk memastikan kredensial server benar sebelum panic sungguhan.
 */
adminRoutes.post('/admin/push-test', async (c) => {
  const body = await parseJson(c, pushTestSchema);
  const communityId = body.communityId;

  const [community] = await db
    .select({ id: communities.id, name: communities.name })
    .from(communities)
    .where(eq(communities.id, communityId))
    .limit(1);

  if (!community) throw new ApiError(404, 'not_found', 'Komunitas tidak ditemukan');

  const topic =
    body.audience === 'responders' ? responderTopic(communityId) : communityTopic(communityId);

  const result = await push.sendToTopic(topic, {
    title: `Uji notifikasi — ${community.name}`,
    body: 'Jika Anda melihat ini, push Jaga Warga berfungsi.',
    data: { type: 'test', communityId },
    tag: `push-test-${communityId}`,
  });

  return c.json({
    adapter: push.kind,
    topic,
    ok: result.ok,
    error: result.error ?? null,
    note:
      push.kind === 'log'
        ? 'Kredensial FCM kosong: push hanya di-log. Isi FCM_SERVICE_ACCOUNT_JSON lalu restart API.'
        : 'Perangkat harus sudah subscribe topic (login di aplikasi).',
  });
});

adminRoutes.get('/admin/stats', async (c) => {
  const [row] = await pg<
    Array<{
      communities: number;
      users: number;
      media_count: number;
      media_bytes: string;
      alerts_24h: number;
    }>
  >`
    select
      (select count(*)::int from communities) as communities,
      (select count(*)::int from users) as users,
      (select count(*)::int from media) as media_count,
      (select coalesce(sum(bytes), 0)::text from media) as media_bytes,
      (select count(*)::int from alerts where created_at > now() - interval '24 hours') as alerts_24h
  `;

  const stats: StatsDto = {
    communities: row?.communities ?? 0,
    users: row?.users ?? 0,
    mediaCount: row?.media_count ?? 0,
    mediaBytes: Number(row?.media_bytes ?? 0),
    alerts24h: row?.alerts_24h ?? 0,
  };

  return c.json(stats);
});
