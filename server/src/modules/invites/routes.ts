import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { inviteCreateSchema } from '../../contracts';
import { db, sql as pg } from '../../db/client';
import { houses, inviteCodes, memberships } from '../../db/schema';
import { parseJson } from '../../lib/http';
import { createInvite } from '../../lib/invites';
import { ensure } from '../../lib/permissions';
import { ApiError } from '../../lib/problem';
import { hit } from '../../lib/ratelimit';

export const inviteRoutes = new Hono();

const MAX_PENDING_HOUSEHOLD_CODES = 5;
const STAFF_TTL_DAYS = 30;
const HOUSEHOLD_TTL_DAYS = 7;

inviteRoutes.post('/invites', async (c) => {
  const auth = c.get('auth');
  ensure(auth, 'invites.staff');
  const body = await parseJson(c, inviteCreateSchema);

  if (body.role === 'admin' && auth.role !== 'admin') {
    throw new ApiError(403, 'forbidden', 'Hanya admin komunitas yang boleh mengundang admin');
  }

  if (body.houseId) {
    const [house] = await db
      .select({ id: houses.id })
      .from(houses)
      .where(and(eq(houses.id, body.houseId), eq(houses.communityId, auth.communityId!)))
      .limit(1);
    if (!house) throw new ApiError(404, 'not_found', 'Rumah tidak ditemukan');
  }

  hit(`invite:${auth.userId}`, 20, 60_000);

  const invite = await createInvite({
    communityId: auth.communityId!,
    kind: 'staff',
    role: body.role,
    houseId: body.houseId ?? null,
    createdBy: auth.userId,
    days: STAFF_TTL_DAYS,
  });

  return c.json({ code: invite.code, expiresAt: invite.expiresAt.toISOString(), kind: 'staff' }, 201);
});

inviteRoutes.post('/invites/household', async (c) => {
  const auth = c.get('auth');
  ensure(auth, 'household.invite');

  const membership = await db
    .select({ isHouseholdHead: memberships.isHouseholdHead, houseId: memberships.houseId })
    .from(memberships)
    .where(and(eq(memberships.communityId, auth.communityId!), eq(memberships.userId, auth.userId)))
    .limit(1)
    .then((rows) => rows[0]);

  if (!membership?.isHouseholdHead || !membership.houseId) {
    throw new ApiError(403, 'forbidden', 'Hanya kepala keluarga yang bisa mengundang anggota rumah');
  }

  const [pending] = await pg<{ count: number }[]>`
    select count(*)::int as count from invite_codes
    where community_id = ${auth.communityId!} and house_id = ${membership.houseId}
      and kind = 'household' and used_by is null and revoked_at is null and expires_at > now()
  `;
  if ((pending?.count ?? 0) >= MAX_PENDING_HOUSEHOLD_CODES) {
    throw new ApiError(429, 'rate_limited', 'Terlalu banyak kode aktif untuk rumah ini. Tunggu hingga terpakai');
  }

  const invite = await createInvite({
    communityId: auth.communityId!,
    kind: 'household',
    role: 'warga',
    houseId: membership.houseId,
    createdBy: auth.userId,
    days: HOUSEHOLD_TTL_DAYS,
  });

  return c.json({ code: invite.code, expiresAt: invite.expiresAt.toISOString(), kind: 'household' }, 201);
});

inviteRoutes.get('/invites', async (c) => {
  const auth = c.get('auth');
  ensure(auth, 'invites.staff');

  const rows = await db
    .select({
      id: inviteCodes.id,
      code: inviteCodes.code,
      kind: inviteCodes.kind,
      role: inviteCodes.role,
      houseId: inviteCodes.houseId,
      houseLabel: houses.label,
      expiresAt: inviteCodes.expiresAt,
      usedAt: inviteCodes.usedAt,
      revokedAt: inviteCodes.revokedAt,
    })
    .from(inviteCodes)
    .leftJoin(houses, eq(houses.id, inviteCodes.houseId))
    .where(and(eq(inviteCodes.communityId, auth.communityId!), eq(inviteCodes.kind, 'staff')))
    .orderBy(desc(inviteCodes.createdAt))
    .limit(100);

  return c.json({ items: rows });
});

inviteRoutes.get('/invites/household', async (c) => {
  const auth = c.get('auth');
  ensure(auth, 'household.invite');

  const rows = await db
    .select({
      id: inviteCodes.id,
      code: inviteCodes.code,
      expiresAt: inviteCodes.expiresAt,
      usedAt: inviteCodes.usedAt,
    })
    .from(inviteCodes)
    .where(
      and(
        eq(inviteCodes.communityId, auth.communityId!),
        eq(inviteCodes.kind, 'household'),
        eq(inviteCodes.createdBy, auth.userId),
        isNull(inviteCodes.usedBy),
        isNull(inviteCodes.revokedAt),
      ),
    )
    .orderBy(desc(inviteCodes.createdAt))
    .limit(20);

  return c.json({ items: rows });
});

inviteRoutes.post('/invites/:id/revoke', async (c) => {
  const auth = c.get('auth');
  ensure(auth, 'invites.revoke');

  const invite = await db
    .select()
    .from(inviteCodes)
    .where(and(eq(inviteCodes.id, c.req.param('id')), eq(inviteCodes.communityId, auth.communityId!)))
    .limit(1)
    .then((rows) => rows[0]);

  if (!invite) throw new ApiError(404, 'not_found', 'Kode undangan tidak ditemukan');

  const isStaff = auth.role === 'admin' || auth.role === 'pengurus';
  if (invite.createdBy !== auth.userId && !isStaff) {
    throw new ApiError(403, 'forbidden', 'Hanya pembuat kode atau pengurus yang boleh mencabut');
  }

  await db.update(inviteCodes).set({ revokedAt: new Date() }).where(eq(inviteCodes.id, invite.id));

  return c.json({ ok: true });
});
