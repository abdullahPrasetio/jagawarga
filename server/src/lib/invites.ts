import { db } from '../db/client';
import { inviteCodes } from '../db/schema';
import { newInviteCode } from './ids';
import { ApiError } from './problem';

export type InviteKind = 'staff' | 'household';

/** Membuat kode undangan unik; mencoba ulang bila tabrakan (probabilitas sangat kecil). */
export async function createInvite(input: {
  communityId: string;
  kind: InviteKind;
  role: string;
  houseId: string | null;
  createdBy: string;
  days: number;
}): Promise<{ code: string; expiresAt: Date }> {
  const expiresAt = new Date(Date.now() + input.days * 24 * 60 * 60 * 1000);

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const code = newInviteCode();
    const inserted = await db
      .insert(inviteCodes)
      .values({
        communityId: input.communityId,
        code,
        kind: input.kind,
        role: input.role,
        houseId: input.houseId,
        createdBy: input.createdBy,
        expiresAt,
      })
      .onConflictDoNothing({ target: inviteCodes.code })
      .returning({ code: inviteCodes.code });

    if (inserted[0]) return { code: inserted[0].code, expiresAt };
  }

  throw new ApiError(500, 'internal_error', 'Gagal membuat kode undangan unik');
}
