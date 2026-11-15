import { and, asc, eq, ilike, or, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import {
  houseBatchSchema,
  memberPatchSchema,
  type DirectoryEntryDto,
  type HouseDto,
  type MemberDto,
  type Role,
} from '../../contracts';
import { db, sql as pg } from '../../db/client';
import { communities, houses, memberships, users } from '../../db/schema';
import { parseJson } from '../../lib/http';
import { waNumber } from '../../lib/ids';
import { ensure } from '../../lib/permissions';
import { ApiError } from '../../lib/problem';

export const communityRoutes = new Hono();

communityRoutes.get('/community', async (c) => {
  const auth = c.get('auth');
  ensure(auth, 'community.read');
  const communityId = auth.communityId!;

  const [community] = await db.select().from(communities).where(eq(communities.id, communityId)).limit(1);
  if (!community) throw new ApiError(404, 'not_found', 'Komunitas tidak ditemukan');

  const [stats] = await pg<{ memberCount: number; houseCount: number }[]>`
    select
      (select count(*)::int from memberships where community_id = ${communityId} and is_active = true) as "memberCount",
      (select count(*)::int from houses where community_id = ${communityId} and is_occupied = true) as "houseCount"
  `;

  return c.json({
    id: community.id,
    name: community.name,
    slug: community.slug,
    address: community.address,
    memberCount: stats?.memberCount ?? 0,
    houseCount: stats?.houseCount ?? 0,
  });
});

communityRoutes.get('/houses', async (c) => {
  const auth = c.get('auth');
  ensure(auth, 'houses.read');

  const rows = await db
    .select()
    .from(houses)
    .where(eq(houses.communityId, auth.communityId!))
    .orderBy(asc(houses.block), asc(houses.number));

  const items: HouseDto[] = rows.map((row) => ({
    id: row.id,
    block: row.block,
    number: row.number,
    label: row.label,
    isOccupied: row.isOccupied,
  }));

  return c.json({ items });
});

communityRoutes.post('/houses/batch', async (c) => {
  const auth = c.get('auth');
  ensure(auth, 'houses.import');
  const body = await parseJson(c, houseBatchSchema);
  const communityId = auth.communityId!;

  const values = body.items.map((item) => ({
    communityId,
    block: item.block.trim().toUpperCase(),
    number: item.number.trim(),
    label: item.label?.trim() || `Blok ${item.block.trim().toUpperCase()} No. ${item.number.trim()}`,
  }));

  const inserted = await db
    .insert(houses)
    .values(values)
    .onConflictDoNothing({ target: [houses.communityId, houses.block, houses.number] })
    .returning({ id: houses.id });

  return c.json({ created: inserted.length, skipped: values.length - inserted.length }, 201);
});

communityRoutes.get('/members', async (c) => {
  const auth = c.get('auth');
  ensure(auth, 'members.read');

  const q = c.req.query('q')?.trim();
  const houseId = c.req.query('houseId');

  const conditions = [eq(memberships.communityId, auth.communityId!), eq(memberships.isActive, true)];
  if (houseId) conditions.push(eq(memberships.houseId, houseId));
  if (q) {
    const like = `%${q}%`;
    const nameFilter = or(ilike(users.name, like), ilike(houses.label, like));
    if (nameFilter) conditions.push(nameFilter);
  }

  const rows = await db
    .select({
      membershipId: memberships.id,
      userId: users.id,
      name: users.name,
      phone: users.phone,
      role: memberships.role,
      houseId: memberships.houseId,
      houseLabel: houses.label,
      isActive: memberships.isActive,
      isHouseholdHead: memberships.isHouseholdHead,
    })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .leftJoin(houses, eq(houses.id, memberships.houseId))
    .where(and(...conditions))
    .orderBy(asc(houses.block), asc(houses.number), asc(users.name));

  const items: MemberDto[] = rows.map((row) => ({
    membershipId: row.membershipId,
    userId: row.userId,
    name: row.name,
    phone: row.phone,
    role: row.role as Role,
    houseId: row.houseId,
    houseLabel: row.houseLabel,
    isActive: row.isActive,
    isHouseholdHead: row.isHouseholdHead,
  }));

  return c.json({ items });
});

communityRoutes.patch('/members/:id', async (c) => {
  const auth = c.get('auth');
  ensure(auth, 'members.manage');
  const membershipId = c.req.param('id');
  const body = await parseJson(c, memberPatchSchema);
  const communityId = auth.communityId!;

  const target = await db
    .select()
    .from(memberships)
    .where(and(eq(memberships.id, membershipId), eq(memberships.communityId, communityId)))
    .limit(1)
    .then((rows) => rows[0]);

  if (!target) throw new ApiError(404, 'not_found', 'Anggota tidak ditemukan');

  const isAdminActor = auth.role === 'admin';
  if (!isAdminActor && target.role === 'admin') {
    throw new ApiError(403, 'forbidden', 'Hanya admin komunitas yang boleh mengubah admin');
  }
  if (body.role === 'admin' && !isAdminActor) {
    throw new ApiError(403, 'forbidden', 'Hanya admin komunitas yang boleh memberikan role admin');
  }
  if (body.isHouseholdHead === true && !(body.houseId ?? target.houseId)) {
    throw new ApiError(400, 'validation_failed', 'Tetapkan rumah sebelum menjadikan kepala keluarga');
  }

  const nextHouseId = body.houseId !== undefined ? body.houseId : target.houseId;
  const houseChanged = body.houseId !== undefined && body.houseId !== target.houseId;

  await db.transaction(async (tx) => {
    if (body.isHouseholdHead === true && nextHouseId) {
      await tx
        .update(memberships)
        .set({ isHouseholdHead: false })
        .where(and(eq(memberships.communityId, communityId), eq(memberships.houseId, nextHouseId)));
    }

    await tx
      .update(memberships)
      .set({
        ...(body.role !== undefined ? { role: body.role } : {}),
        ...(nextHouseId !== target.houseId ? { houseId: nextHouseId } : {}),
        ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
        ...(body.isHouseholdHead !== undefined
          ? { isHouseholdHead: body.isHouseholdHead }
          : houseChanged
            ? { isHouseholdHead: false }
            : {}),
      })
      .where(eq(memberships.id, membershipId));
  });

  const [updated] = await db
    .select({
      membershipId: memberships.id,
      userId: users.id,
      name: users.name,
      phone: users.phone,
      role: memberships.role,
      houseId: memberships.houseId,
      houseLabel: houses.label,
      isActive: memberships.isActive,
      isHouseholdHead: memberships.isHouseholdHead,
    })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .leftJoin(houses, eq(houses.id, memberships.houseId))
    .where(eq(memberships.id, membershipId))
    .limit(1);

  if (!updated) throw new ApiError(404, 'not_found', 'Anggota tidak ditemukan');

  return c.json({
    membershipId: updated.membershipId,
    userId: updated.userId,
    name: updated.name,
    phone: updated.phone,
    role: updated.role,
    houseId: updated.houseId,
    houseLabel: updated.houseLabel,
    isActive: updated.isActive,
    isHouseholdHead: updated.isHouseholdHead,
  });
});

communityRoutes.post('/members/:id/reset-password', async (c) => {
  const auth = c.get('auth');
  ensure(auth, 'members.manage');
  const membershipId = c.req.param('id');

  const target = await db
    .select({ userId: memberships.userId, role: memberships.role })
    .from(memberships)
    .where(and(eq(memberships.id, membershipId), eq(memberships.communityId, auth.communityId!)))
    .limit(1)
    .then((rows) => rows[0]);

  if (!target) throw new ApiError(404, 'not_found', 'Anggota tidak ditemukan');
  if (target.role === 'admin' && auth.role !== 'admin') {
    throw new ApiError(403, 'forbidden', 'Hanya admin komunitas yang boleh mereset admin');
  }

  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = new Uint8Array(10);
  crypto.getRandomValues(bytes);
  const temporaryPassword = Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('');

  await db
    .update(users)
    .set({ passwordHash: await Bun.password.hash(temporaryPassword, 'argon2id') })
    .where(eq(users.id, target.userId));

  return c.json({ temporaryPassword });
});

communityRoutes.get('/me/household', async (c) => {
  const auth = c.get('auth');
  ensure(auth, 'household.read');

  if (!auth.houseId) return c.json({ house: null, headName: null, members: [] });

  const [house] = await db
    .select()
    .from(houses)
    .where(and(eq(houses.id, auth.houseId), eq(houses.communityId, auth.communityId!)))
    .limit(1);

  const rows = await db
    .select({
      userId: users.id,
      name: users.name,
      isHouseholdHead: memberships.isHouseholdHead,
      isActive: memberships.isActive,
    })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .where(
      and(
        eq(memberships.communityId, auth.communityId!),
        eq(memberships.houseId, auth.houseId),
        eq(memberships.isActive, true),
      ),
    )
    .orderBy(asc(users.name));

  const head = rows.find((row) => row.isHouseholdHead);

  return c.json({
    house: house ? { id: house.id, label: house.label } : null,
    headName: head?.name ?? null,
    members: rows.map((row) => ({
      userId: row.userId,
      name: row.name,
      isHouseholdHead: row.isHouseholdHead,
    })),
  });
});

communityRoutes.get('/community/staff', async (c) => {
  const auth = c.get('auth');
  ensure(auth, 'community.read');

  const rows = await db
    .select({ name: users.name, phone: users.phone, role: memberships.role })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .where(
      and(
        eq(memberships.communityId, auth.communityId!),
        eq(memberships.isActive, true),
        sql`${memberships.role} in ('admin','pengurus','satpam')`,
      ),
    )
    .orderBy(asc(memberships.role), asc(users.name));

  return c.json({ items: rows });
});

communityRoutes.get('/directory', async (c) => {
  const auth = c.get('auth');
  ensure(auth, 'directory.read');

  const q = c.req.query('q')?.trim();
  const interest = c.req.query('interest')?.trim();

  const conditions = [
    eq(memberships.communityId, auth.communityId!),
    eq(memberships.isActive, true),
    eq(users.directoryVisible, true),
  ];
  if (q) {
    const like = `%${q}%`;
    const filter = or(ilike(users.name, like), ilike(houses.label, like));
    if (filter) conditions.push(filter);
  }
  if (interest) conditions.push(sql`${users.interests} @> ARRAY[${interest}]::text[]`);

  const rows = await db
    .select({
      userId: users.id,
      name: users.name,
      phone: users.phone,
      bio: users.bio,
      interests: users.interests,
      houseLabel: houses.label,
    })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .leftJoin(houses, eq(houses.id, memberships.houseId))
    .where(and(...conditions))
    .orderBy(asc(houses.block), asc(houses.number), asc(users.name))
    .limit(300);

  const items: DirectoryEntryDto[] = rows.map((row) => ({
    userId: row.userId,
    name: row.name,
    houseLabel: row.houseLabel,
    bio: row.bio,
    interests: row.interests,
    waNumber: waNumber(row.phone),
  }));

  return c.json({ items });
});
