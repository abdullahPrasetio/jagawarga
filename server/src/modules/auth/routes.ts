import { and, eq, isNull, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import {
  activateSchema,
  deviceSchema,
  loginSchema,
  profileUpdateSchema,
  refreshSchema,
  switchCommunitySchema,
  type MeResponse,
  type MembershipDto,
  type Role,
} from '../../contracts';
import { db, sql as pg } from '../../db/client';
import { auditLogs, communities, deviceTokens, houses, inviteCodes, memberships, sessions, users } from '../../db/schema';
import { cookieSecure } from '../../env';
import { parseJson } from '../../lib/http';
import { normalizePhone } from '../../lib/ids';
import {
  generateRefreshToken,
  hashToken,
  refreshTtlDays,
  signAccess,
  type Auth,
} from '../../lib/jwt';
import { ApiError, problem } from '../../lib/problem';
import { hit } from '../../lib/ratelimit';
import { withAuth } from '../../middleware/auth';

export const authRoutes = new Hono();

const MAX_HOUSEHOLD_MEMBERS = 6;
const COOKIE_NAME = 'jagawarga_refresh';
const COOKIE_PATH = '/api/v1/auth';

function isWebClient(headers: Headers): boolean {
  return (headers.get('x-client') ?? '').toLowerCase() === 'web';
}

function setRefreshCookie(headers: Headers, token: string): void {
  const parts = [
    `${COOKIE_NAME}=${token}`,
    'HttpOnly',
    'SameSite=Strict',
    `Path=${COOKIE_PATH}`,
    `Max-Age=${refreshTtlDays * 24 * 60 * 60}`,
  ];
  if (cookieSecure) parts.push('Secure');
  headers.append('Set-Cookie', parts.join('; '));
}

function clearRefreshCookie(headers: Headers): void {
  const parts = [`${COOKIE_NAME}=`, 'HttpOnly', 'SameSite=Strict', `Path=${COOKIE_PATH}`, 'Max-Age=0'];
  if (cookieSecure) parts.push('Secure');
  headers.append('Set-Cookie', parts.join('; '));
}

function readCookie(headers: Headers): string | null {
  const raw = headers.get('cookie');
  if (!raw) return null;
  for (const part of raw.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === COOKIE_NAME) return rest.join('=');
  }
  return null;
}

function encodeRefreshPayload(userId: string, communityId: string | null): string {
  const payload = Buffer.from(JSON.stringify({ u: userId, c: communityId }), 'utf8').toString('base64url');
  return `${payload}.${generateRefreshToken()}`;
}

function decodeRefreshPayload(token: string): { userId: string; communityId: string | null } | null {
  const [payload] = token.split('.');
  if (!payload) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      u?: string;
      c?: string | null;
    };
    if (!parsed.u) return null;
    return { userId: parsed.u, communityId: parsed.c ?? null };
  } catch {
    return null;
  }
}

async function issueRefresh(userId: string, communityId: string | null, userAgent: string | null) {
  const token = encodeRefreshPayload(userId, communityId);
  const tokenHash = await hashToken(token);
  const expiresAt = new Date(Date.now() + refreshTtlDays * 24 * 60 * 60 * 1000);

  await db.insert(sessions).values({ userId, tokenHash, expiresAt, userAgent });

  return token;
}

async function hasSuspendedMembership(userId: string): Promise<boolean> {
  const [row] = await pg<{ count: number }[]>`
    select count(*)::int as count
    from memberships m
    join communities c on c.id = m.community_id
    where m.user_id = ${userId} and m.is_active = true and c.is_active = false
  `;
  return (row?.count ?? 0) > 0;
}

async function loadMemberships(userId: string): Promise<MembershipDto[]> {
  const rows = await db
    .select({
      id: memberships.id,
      communityId: memberships.communityId,
      communityName: communities.name,
      role: memberships.role,
      houseId: memberships.houseId,
      houseLabel: houses.label,
      isHouseholdHead: memberships.isHouseholdHead,
      isActive: memberships.isActive,
      communityActive: communities.isActive,
    })
    .from(memberships)
    .innerJoin(communities, eq(communities.id, memberships.communityId))
    .leftJoin(houses, eq(houses.id, memberships.houseId))
    .where(and(eq(memberships.userId, userId), eq(memberships.isActive, true)));

  return rows
    .filter((row) => row.communityActive)
    .map((row) => ({
      id: row.id,
      communityId: row.communityId,
      communityName: row.communityName,
      role: row.role as Role,
      houseId: row.houseId,
      houseLabel: row.houseLabel,
      isHouseholdHead: row.isHouseholdHead,
    }));
}

authRoutes.post('/activate', async (c) => {
  const body = await parseJson(c, activateSchema);
  const phone = normalizePhone(body.phone);
  hit(`activate:${phone}`, 10, 60_000);

  const invite = await db
    .select()
    .from(inviteCodes)
    .where(eq(inviteCodes.code, body.inviteCode.trim().toUpperCase()))
    .limit(1)
    .then((rows) => rows[0]);

  if (!invite || invite.usedBy || invite.revokedAt || invite.expiresAt.getTime() < Date.now()) {
    throw new ApiError(409, 'invite_invalid', 'Kode undangan tidak berlaku, sudah dipakai, atau kedaluwarsa');
  }

  const [community] = await db
    .select()
    .from(communities)
    .where(eq(communities.id, invite.communityId))
    .limit(1);

  if (!community || !community.isActive) {
    throw new ApiError(403, 'community_suspended', 'Komunitas dinonaktifkan');
  }

  if (invite.houseId) {
    const [household] = await pg<{ count: number }[]>`
      select count(*)::int as count from memberships
      where community_id = ${invite.communityId} and house_id = ${invite.houseId} and is_active = true
    `;
    if ((household?.count ?? 0) >= MAX_HOUSEHOLD_MEMBERS) {
      throw new ApiError(409, 'household_full', 'Rumah ini sudah mencapai batas 6 anggota');
    }
  }

  const existing = await db.select().from(users).where(eq(users.phone, phone)).limit(1).then((r) => r[0]);

  let userId: string;
  if (existing) {
    const passwordOk = await Bun.password.verify(body.password, existing.passwordHash);
    if (!passwordOk) {
      throw new ApiError(409, 'conflict', 'Nomor HP sudah terdaftar. Gunakan password akun yang sudah ada');
    }
    userId = existing.id;
  } else {
    const passwordHash = await Bun.password.hash(body.password, 'argon2id');
    const [created] = await db
      .insert(users)
      .values({ phone, name: body.name, passwordHash })
      .returning({ id: users.id });
    if (!created) throw new ApiError(500, 'internal_error', 'Gagal membuat akun');
    userId = created.id;
  }

  const alreadyMember = await db
    .select({ id: memberships.id })
    .from(memberships)
    .where(and(eq(memberships.userId, userId), eq(memberships.communityId, invite.communityId)))
    .limit(1)
    .then((rows) => rows[0]);

  if (alreadyMember) {
    throw new ApiError(409, 'conflict', 'Akun ini sudah tergabung di komunitas tersebut');
  }

  const claimed = await db
    .update(inviteCodes)
    .set({ usedBy: userId, usedAt: new Date() })
    .where(and(eq(inviteCodes.id, invite.id), isNull(inviteCodes.usedBy)))
    .returning({ id: inviteCodes.id });

  if (claimed.length === 0) {
    throw new ApiError(409, 'invite_invalid', 'Kode undangan baru saja dipakai orang lain');
  }

  const [membership] = await db
    .insert(memberships)
    .values({
      communityId: invite.communityId,
      userId,
      houseId: invite.houseId,
      role: invite.role,
      isHouseholdHead: false,
    })
    .returning({ id: memberships.id, role: memberships.role, houseId: memberships.houseId });

  if (!membership) throw new ApiError(500, 'internal_error', 'Gagal membuat keanggotaan');

  const auth: Auth = {
    userId,
    communityId: invite.communityId,
    role: membership.role as Role,
    houseId: membership.houseId,
    platformAdmin: existing?.isPlatformAdmin ?? false,
  };

  const accessToken = await signAccess(auth);
  const refreshToken = await issueRefresh(userId, invite.communityId, c.req.header('user-agent') ?? null);

  const membershipList = await loadMemberships(userId);
  const current = membershipList.find((item) => item.communityId === invite.communityId) ?? null;

  const headers = new Headers();
  if (isWebClient(c.req.raw.headers)) setRefreshCookie(headers, refreshToken);

  return c.json(
    {
      accessToken,
      expiresIn: 900,
      ...(isWebClient(c.req.raw.headers) ? {} : { refreshToken }),
      user: { id: userId, name: body.name, phone },
      membership: current,
      memberships: membershipList,
      community: { id: community.id, name: community.name, slug: community.slug },
    },
    201,
    Object.fromEntries(headers),
  );
});

authRoutes.post('/login', async (c) => {
  const body = await parseJson(c, loginSchema);
  const phone = normalizePhone(body.phone);
  const ip = c.req.header('x-forwarded-for') ?? 'local';
  hit(`login:${ip}`, 20, 60_000);
  hit(`login:${phone}`, 10, 60_000);

  const user = await db.select().from(users).where(eq(users.phone, phone)).limit(1).then((r) => r[0]);
  if (!user) throw new ApiError(401, 'unauthorized', 'Nomor HP atau password salah');

  const passwordOk = await Bun.password.verify(body.password, user.passwordHash);
  if (!passwordOk) throw new ApiError(401, 'unauthorized', 'Nomor HP atau password salah');

  const membershipList = await loadMemberships(user.id);

  if (user.isPlatformAdmin && !body.communityId) {
    const auth: Auth = {
      userId: user.id,
      communityId: null,
      role: null,
      houseId: null,
      platformAdmin: true,
    };
    const accessToken = await signAccess(auth);
    const refreshToken = await issueRefresh(user.id, null, c.req.header('user-agent') ?? null);
    const web = isWebClient(c.req.raw.headers);
    const headers = new Headers();
    if (web) setRefreshCookie(headers, refreshToken);

    return c.json(
      {
        accessToken,
        expiresIn: 900,
        ...(web ? {} : { refreshToken }),
        user: {
          id: user.id,
          phone: user.phone,
          name: user.name,
          bio: user.bio,
          interests: user.interests,
          directoryVisible: user.directoryVisible,
          isPlatformAdmin: user.isPlatformAdmin,
          avatarMediaId: user.avatarMediaId,
        },
        membership: null,
        memberships: membershipList,
        community: null,
      },
      200,
      Object.fromEntries(headers),
    );
  }

  const requested = body.communityId
    ? membershipList.find((item) => item.communityId === body.communityId)
    : membershipList.length === 1
      ? membershipList[0]
      : undefined;

  if (!requested) {
    if (membershipList.length === 0) {
      if (await hasSuspendedMembership(user.id)) {
        throw new ApiError(403, 'community_suspended', 'Komunitas dinonaktifkan');
      }
      throw new ApiError(403, 'no_community', 'Akun ini belum tergabung di komunitas mana pun');
    }
    if (!body.communityId) {
      return problem(
        c,
        400,
        'validation_failed',
        'Pilih komunitas terlebih dahulu',
        { memberships: membershipList },
      );
    }
    throw new ApiError(403, 'forbidden', 'Anda bukan anggota komunitas tersebut');
  }

  const auth: Auth = {
    userId: user.id,
    communityId: requested.communityId,
    role: requested.role,
    houseId: requested.houseId,
    platformAdmin: user.isPlatformAdmin,
  };

  const accessToken = await signAccess(auth);
  const refreshToken = await issueRefresh(user.id, requested.communityId, c.req.header('user-agent') ?? null);
  const web = isWebClient(c.req.raw.headers);
  const headers = new Headers();
  if (web) setRefreshCookie(headers, refreshToken);

  const me: MeResponse = {
    user: {
      id: user.id,
      phone: user.phone,
      name: user.name,
      bio: user.bio,
      interests: user.interests,
      directoryVisible: user.directoryVisible,
      isPlatformAdmin: user.isPlatformAdmin,
      avatarMediaId: user.avatarMediaId,
    },
    membership: requested,
    memberships: membershipList,
    community: {
      id: requested.communityId,
      name: requested.communityName,
      slug: '',
    },
  };

  return c.json(
    {
      accessToken,
      expiresIn: 900,
      ...(web ? {} : { refreshToken }),
      ...me,
    },
    200,
    Object.fromEntries(headers),
  );
});

authRoutes.post('/refresh', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = refreshSchema.parse(body ?? {});
  const web = isWebClient(c.req.raw.headers);
  const token = parsed.refreshToken ?? (web ? readCookie(c.req.raw.headers) : null);

  if (!token) throw new ApiError(401, 'unauthorized', 'Refresh token tidak ada');

  const tokenHash = await hashToken(token);
  const session = await db
    .select()
    .from(sessions)
    .where(eq(sessions.tokenHash, tokenHash))
    .limit(1)
    .then((rows) => rows[0]);

  if (!session || session.revokedAt || session.expiresAt.getTime() < Date.now()) {
    throw new ApiError(401, 'unauthorized', 'Sesi tidak valid atau kedaluwarsa');
  }

  const payload = decodeRefreshPayload(token);
  if (!payload) throw new ApiError(401, 'unauthorized', 'Sesi tidak valid');

  const user = await db.select().from(users).where(eq(users.id, payload.userId)).limit(1).then((r) => r[0]);
  if (!user) throw new ApiError(401, 'unauthorized', 'Akun tidak ditemukan');

  await db.update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.id, session.id));

  let auth: Auth = {
    userId: user.id,
    communityId: null,
    role: null,
    houseId: null,
    platformAdmin: user.isPlatformAdmin,
  };

  if (payload.communityId) {
    const membership = await db
      .select({
        role: memberships.role,
        houseId: memberships.houseId,
        isActive: memberships.isActive,
        communityActive: communities.isActive,
      })
      .from(memberships)
      .innerJoin(communities, eq(communities.id, memberships.communityId))
      .where(and(eq(memberships.userId, user.id), eq(memberships.communityId, payload.communityId)))
      .limit(1)
      .then((rows) => rows[0]);

    if (!membership || !membership.isActive) {
      throw new ApiError(403, 'forbidden', 'Keanggotaan tidak aktif');
    }
    if (!membership.communityActive) {
      throw new ApiError(403, 'community_suspended', 'Komunitas dinonaktifkan');
    }

    auth = {
      ...auth,
      communityId: payload.communityId,
      role: membership.role as Role,
      houseId: membership.houseId,
    };
  }

  const accessToken = await signAccess(auth);
  const refreshToken = await issueRefresh(user.id, auth.communityId, c.req.header('user-agent') ?? null);
  const headers = new Headers();
  if (web) setRefreshCookie(headers, refreshToken);

  const membershipList = await loadMemberships(user.id);

  return c.json(
    {
      accessToken,
      expiresIn: 900,
      ...(web ? {} : { refreshToken }),
      membership: membershipList.find((item) => item.communityId === auth.communityId) ?? null,
      memberships: membershipList,
    },
    200,
    Object.fromEntries(headers),
  );
});

authRoutes.post('/logout', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = refreshSchema.parse(body ?? {});
  const web = isWebClient(c.req.raw.headers);
  const token = parsed.refreshToken ?? readCookie(c.req.raw.headers);

  if (token) {
    const tokenHash = await hashToken(token);
    await db.update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.tokenHash, tokenHash));
  }

  const headers = new Headers();
  if (web) clearRefreshCookie(headers);

  return c.json({ ok: true }, 200, Object.fromEntries(headers));
});

authRoutes.get('/me', withAuth, async (c) => {
  const auth = c.get('auth');
  const user = await db.select().from(users).where(eq(users.id, auth.userId)).limit(1).then((r) => r[0]);
  if (!user) throw new ApiError(401, 'unauthorized', 'Akun tidak ditemukan');

  const membershipList = await loadMemberships(user.id);
  const current = membershipList.find((item) => item.communityId === auth.communityId) ?? null;

  const community = current
    ? await db
        .select({ id: communities.id, name: communities.name, slug: communities.slug })
        .from(communities)
        .where(eq(communities.id, current.communityId))
        .limit(1)
        .then((rows) => rows[0] ?? null)
    : null;

  const response: MeResponse = {
    user: {
      id: user.id,
      phone: user.phone,
      name: user.name,
      bio: user.bio,
      interests: user.interests,
      directoryVisible: user.directoryVisible,
      isPlatformAdmin: user.isPlatformAdmin,
      avatarMediaId: user.avatarMediaId,
    },
    membership: current,
    memberships: membershipList,
    community,
  };

  return c.json(response);
});

authRoutes.patch('/me/profile', withAuth, async (c) => {
  const auth = c.get('auth');
  const body = await parseJson(c, profileUpdateSchema);

  const [updated] = await db
    .update(users)
    .set({
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.bio !== undefined ? { bio: body.bio } : {}),
      ...(body.interests !== undefined ? { interests: body.interests } : {}),
      ...(body.directoryVisible !== undefined ? { directoryVisible: body.directoryVisible } : {}),
      ...(body.avatarMediaId !== undefined ? { avatarMediaId: body.avatarMediaId } : {}),
    })
    .where(eq(users.id, auth.userId))
    .returning();

  if (!updated) throw new ApiError(404, 'not_found', 'Pengguna tidak ditemukan');

  return c.json({
    id: updated.id,
    name: updated.name,
    bio: updated.bio,
    interests: updated.interests,
    directoryVisible: updated.directoryVisible,
    avatarMediaId: updated.avatarMediaId,
  });
});

authRoutes.post('/me/devices', withAuth, async (c) => {
  const auth = c.get('auth');
  if (!auth.communityId) throw new ApiError(403, 'no_community', 'Belum tergabung di komunitas');
  const body = await parseJson(c, deviceSchema);

  await db
    .insert(deviceTokens)
    .values({
      userId: auth.userId,
      communityId: auth.communityId,
      platform: body.platform,
      token: body.token,
    })
    .onConflictDoUpdate({
      target: deviceTokens.token,
      set: { userId: auth.userId, communityId: auth.communityId, lastSeenAt: new Date() },
    });

  return c.json({ ok: true });
});

authRoutes.post('/switch-community', withAuth, async (c) => {
  const auth = c.get('auth');
  const body = await parseJson(c, switchCommunitySchema);

  const [community] = await db
    .select()
    .from(communities)
    .where(eq(communities.id, body.communityId))
    .limit(1);
  if (!community) throw new ApiError(404, 'not_found', 'Komunitas tidak ditemukan');
  if (!community.isActive) throw new ApiError(403, 'community_suspended', 'Komunitas dinonaktifkan');

  let membership = await db
    .select()
    .from(memberships)
    .where(and(eq(memberships.userId, auth.userId), eq(memberships.communityId, body.communityId)))
    .limit(1)
    .then((rows) => rows[0]);

  if (!membership) {
    if (!auth.platformAdmin) throw new ApiError(403, 'forbidden', 'Anda bukan anggota komunitas tersebut');

    const [created] = await db
      .insert(memberships)
      .values({ communityId: body.communityId, userId: auth.userId, role: 'admin', isActive: true })
      .returning();

    await db.insert(auditLogs).values({
      actorId: auth.userId,
      communityId: body.communityId,
      action: 'community.join',
      targetType: 'community',
      targetId: body.communityId,
    });

    membership = created;
  }

  if (!membership || !membership.isActive) {
    throw new ApiError(403, 'forbidden', 'Keanggotaan tidak aktif');
  }

  const nextAuth: Auth = {
    userId: auth.userId,
    communityId: body.communityId,
    role: membership.role as Role,
    houseId: membership.houseId,
    platformAdmin: auth.platformAdmin,
  };

  const accessToken = await signAccess(nextAuth);
  const web = isWebClient(c.req.raw.headers);
  const refreshToken = await issueRefresh(auth.userId, body.communityId, c.req.header('user-agent') ?? null);
  const headers = new Headers();
  if (web) setRefreshCookie(headers, refreshToken);

  const membershipList = await loadMemberships(auth.userId);

  return c.json(
    {
      accessToken,
      expiresIn: 900,
      ...(web ? {} : { refreshToken }),
      membership: membershipList.find((item) => item.communityId === body.communityId) ?? null,
      memberships: membershipList,
      community: { id: community.id, name: community.name, slug: community.slug },
    },
    200,
    Object.fromEntries(headers),
  );
});
