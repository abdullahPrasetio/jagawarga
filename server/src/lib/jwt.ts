import { sign, verify } from 'hono/jwt';
import { env } from '../env';

export type Role = 'admin' | 'pengurus' | 'bendahara' | 'satpam' | 'warga';

export type Auth = {
  userId: string;
  communityId: string | null;
  role: Role | null;
  houseId: string | null;
  platformAdmin: boolean;
};

export type AccessClaims = Auth & { sub: string; exp: number; iat: number };

const ACCESS_TTL_SECONDS = 15 * 60;

export async function signAccess(auth: Auth): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return sign(
    {
      sub: auth.userId,
      communityId: auth.communityId,
      role: auth.role,
      houseId: auth.houseId,
      platformAdmin: auth.platformAdmin,
      iat: now,
      exp: now + ACCESS_TTL_SECONDS,
    },
    env.JWT_SECRET,
  );
}

export async function verifyAccess(token: string): Promise<AccessClaims | null> {
  try {
    const payload = (await verify(token, env.JWT_SECRET, 'HS256')) as Record<string, unknown>;
    if (typeof payload.sub !== 'string') return null;
    return {
      sub: payload.sub,
      userId: payload.sub,
      communityId: (payload.communityId as string | null) ?? null,
      role: (payload.role as Role | null) ?? null,
      houseId: (payload.houseId as string | null) ?? null,
      platformAdmin: payload.platformAdmin === true,
      exp: Number(payload.exp ?? 0),
      iat: Number(payload.iat ?? 0),
    };
  } catch {
    return null;
  }
}

export async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Buffer.from(digest).toString('hex');
}

export function generateRefreshToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Buffer.from(bytes).toString('base64url');
}

export const refreshTtlDays = 30;
