import { and, eq } from 'drizzle-orm';
import { createMiddleware } from 'hono/factory';
import { db } from '../db/client';
import { communities, memberships } from '../db/schema';
import { verifyAccess, type Auth } from '../lib/jwt';
import { ApiError } from '../lib/problem';

declare module 'hono' {
  interface ContextVariableMap {
    auth: Auth;
  }
}

export const withAuth = createMiddleware(async (c, next) => {
  const header = c.req.header('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) throw new ApiError(401, 'unauthorized', 'Header "Authorization: Bearer <token>" diperlukan');

  const claims = await verifyAccess(token);
  if (!claims) throw new ApiError(401, 'unauthorized', 'Token tidak valid atau kedaluwarsa');

  c.set('auth', {
    userId: claims.userId,
    communityId: claims.communityId,
    role: claims.role,
    houseId: claims.houseId,
    platformAdmin: claims.platformAdmin,
  });

  await next();
});

/** Wajib punya komunitas aktif. Dipasang setelah `withAuth` untuk route non-/admin. */
export const withCommunity = createMiddleware(async (c, next) => {
  const auth = c.get('auth');
  if (!auth.communityId || !auth.role) {
    throw new ApiError(403, 'no_community', 'Akun ini belum tergabung di komunitas mana pun');
  }

  const [row] = await db
    .select({
      active: memberships.isActive,
      communityActive: communities.isActive,
      role: memberships.role,
      houseId: memberships.houseId,
    })
    .from(memberships)
    .innerJoin(communities, eq(communities.id, memberships.communityId))
    .where(and(eq(memberships.communityId, auth.communityId), eq(memberships.userId, auth.userId)))
    .limit(1);

  if (!row || !row.active) throw new ApiError(403, 'forbidden', 'Keanggotaan tidak aktif');
  if (!row.communityActive) throw new ApiError(403, 'community_suspended', 'Komunitas dinonaktifkan');

  c.set('auth', { ...auth, role: row.role as Auth['role'], houseId: row.houseId, communityId: auth.communityId });
  await next();
});

export const withPlatformAdmin = createMiddleware(async (c, next) => {
  if (!c.get('auth').platformAdmin) {
    throw new ApiError(403, 'forbidden', 'Hanya platform admin');
  }
  await next();
});
