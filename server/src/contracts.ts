import { z } from 'zod';

/**
 * Kontrak API: satu sumber untuk validasi server dan tipe klien web
 * (`web/src/api/types.ts` mengimpor `import type` dari sini).
 */

export const roleSchema = z.enum(['admin', 'pengurus', 'bendahara', 'satpam', 'warga']);
export type Role = z.infer<typeof roleSchema>;

export const phoneSchema = z
  .string()
  .min(8)
  .max(20)
  .regex(/^[0-9+\-\s]+$/, 'Nomor HP hanya boleh angka');

export const passwordSchema = z.string().min(8, 'Minimal 8 karakter').max(128);

export const activateSchema = z.object({
  inviteCode: z.string().trim().min(4).max(32),
  name: z.string().trim().min(2).max(80),
  phone: phoneSchema,
  password: passwordSchema,
});

export const loginSchema = z.object({
  phone: phoneSchema,
  password: z.string().min(1),
  communityId: z.string().uuid().optional(),
});

export const refreshSchema = z.object({ refreshToken: z.string().min(10).optional() });

export const switchCommunitySchema = z.object({ communityId: z.string().uuid() });

export const profileUpdateSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  bio: z.string().trim().max(280).optional(),
  interests: z.array(z.string().trim().min(2).max(24)).max(10).optional(),
  directoryVisible: z.boolean().optional(),
  avatarMediaId: z.string().uuid().nullable().optional(),
});

export const deviceSchema = z.object({
  token: z.string().min(10).max(4096),
  platform: z.enum(['android', 'ios']),
});

export const houseBatchSchema = z.object({
  items: z
    .array(
      z.object({
        block: z.string().trim().min(1).max(16),
        number: z.string().trim().min(1).max(16),
        label: z.string().trim().min(1).max(80).optional(),
      }),
    )
    .min(1)
    .max(500),
});

export const memberPatchSchema = z.object({
  role: roleSchema.optional(),
  houseId: z.string().uuid().nullable().optional(),
  isActive: z.boolean().optional(),
  isHouseholdHead: z.boolean().optional(),
});

export const inviteCreateSchema = z.object({
  role: roleSchema,
  houseId: z.string().uuid().nullable().optional(),
});

export const alertCreateSchema = z.object({
  houseId: z.string().uuid().optional(),
  message: z.string().trim().max(280).optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  kind: z.enum(['panic', 'security', 'medical', 'fire']).optional(),
});

export const alertResolveSchema = z.object({
  resolution: z.enum(['handled', 'false_alarm']),
  note: z.string().trim().max(280).optional(),
});

export const announcementCreateSchema = z.object({
  title: z.string().trim().min(3).max(120),
  body: z.string().trim().min(3).max(5000),
  category: z.enum(['umum', 'keamanan', 'kegiatan', 'darurat']).default('umum'),
  isPinned: z.boolean().optional(),
  attachmentMediaId: z.string().uuid().nullable().optional(),
});

export const announcementPatchSchema = announcementCreateSchema.partial();

export const invoiceBatchSchema = z.object({
  period: z.string().regex(/^\d{4}-\d{2}$/, 'Format periode YYYY-MM'),
  title: z.string().trim().min(3).max(120),
  amount: z.number().int().positive().max(1_000_000_000),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal YYYY-MM-DD'),
  houseIds: z.array(z.string().uuid()).optional(),
});

export const paymentUploadSchema = z.object({
  amount: z.coerce.number().int().positive().max(1_000_000_000),
  note: z.string().trim().max(280).optional(),
});

export const reviewSchema = z.object({
  action: z.enum(['approve', 'reject']),
  note: z.string().trim().max(280).optional(),
});

export const ledgerCreateSchema = z.object({
  direction: z.enum(['income', 'expense']),
  category: z.string().trim().min(2).max(40),
  amount: z.number().int().positive().max(1_000_000_000),
  occurredOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  description: z.string().trim().min(3).max(280),
  attachmentMediaId: z.string().uuid().nullable().optional(),
});

export const campaignCreateSchema = z.object({
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().min(3).max(3000),
  targetAmount: z.number().int().positive().max(10_000_000_000),
  deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  coverMediaId: z.string().uuid().nullable().optional(),
});

export const donationUploadSchema = z.object({
  amount: z.coerce.number().int().positive().max(1_000_000_000),
  donorName: z.string().trim().max(80).optional(),
  isAnonymous: z
    .union([z.boolean(), z.literal('true'), z.literal('false')])
    .transform((value) => value === true || value === 'true')
    .optional(),
  note: z.string().trim().max(280).optional(),
});

export const communityCreateSchema = z.object({
  name: z.string().trim().min(2).max(80),
  slug: z.string().trim().regex(/^[a-z0-9-]{3,40}$/, 'Hanya huruf kecil, angka, dan tanda hubung'),
  address: z.string().trim().max(160).optional(),
});

export const communityPatchSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  isActive: z.boolean().optional(),
});

export const listQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

/* ---------- DTO response ---------- */

export type Problem = {
  type: string;
  title: string;
  status: number;
  detail: string;
  code: string;
  issues?: Array<{ path: string; message: string }>;
};

export type MembershipDto = {
  id: string;
  communityId: string;
  communityName: string;
  role: Role;
  houseId: string | null;
  houseLabel: string | null;
  isHouseholdHead: boolean;
};

export type MeResponse = {
  user: {
    id: string;
    phone: string;
    name: string;
    bio: string | null;
    interests: string[];
    directoryVisible: boolean;
    isPlatformAdmin: boolean;
    avatarMediaId: string | null;
  };
  membership: MembershipDto | null;
  memberships: MembershipDto[];
  community: { id: string; name: string; slug: string } | null;
};

export type AuthTokens = { accessToken: string; refreshToken?: string; expiresIn: number };

export type HouseDto = {
  id: string;
  block: string;
  number: string;
  label: string;
  isOccupied: boolean;
};

export type MemberDto = {
  membershipId: string;
  userId: string;
  name: string;
  phone: string;
  role: Role;
  houseId: string | null;
  houseLabel: string | null;
  isActive: boolean;
  isHouseholdHead: boolean;
};

export type DirectoryEntryDto = {
  userId: string;
  name: string;
  houseLabel: string | null;
  bio: string | null;
  interests: string[];
  waNumber: string | null;
};

export type AlertDto = {
  id: string;
  kind: 'panic' | 'security' | 'medical' | 'fire';
  status: 'active' | 'acknowledged' | 'cancelled' | 'resolved';
  message: string | null;
  houseId: string | null;
  houseLabel: string | null;
  triggeredBy: string;
  triggeredByName: string;
  lat: number | null;
  lng: number | null;
  acknowledgedByName: string | null;
  acknowledgedAt: string | null;
  resolvedByName: string | null;
  resolvedAt: string | null;
  resolution: string | null;
  createdAt: string;
  eventCount: number;
};

export type AlertEventDto = {
  id: string;
  type: string;
  actorName: string | null;
  meta: Record<string, unknown>;
  createdAt: string;
};

export type AnnouncementDto = {
  id: string;
  title: string;
  body: string;
  category: 'umum' | 'keamanan' | 'kegiatan' | 'darurat';
  isPinned: boolean;
  attachmentMediaId: string | null;
  authorName: string;
  publishedAt: string | null;
  createdAt: string;
};

export type MediaDto = { id: string; url: string; mime: string; bytes: number };

export type InvoiceDto = {
  id: string;
  houseId: string;
  houseLabel: string;
  period: string;
  title: string;
  amount: number;
  paidAmount: number;
  dueDate: string;
  status: 'unpaid' | 'partial' | 'paid' | 'void';
};

export type PaymentDto = {
  id: string;
  invoiceId: string;
  houseLabel: string;
  invoiceTitle: string;
  amount: number;
  status: 'pending' | 'approved' | 'rejected';
  note: string | null;
  proofMediaId: string | null;
  reportedByName: string;
  reportedAt: string;
  reviewedAt: string | null;
};

export type LedgerEntryDto = {
  id: string;
  direction: 'income' | 'expense';
  category: string;
  amount: number;
  occurredOn: string;
  description: string;
  attachmentMediaId: string | null;
  source: 'iuran' | 'donasi' | 'manual';
  createdByName: string;
  createdAt: string;
};

export type SummaryDto = {
  from: string;
  to: string;
  opening: number;
  income: number;
  expense: number;
  closing: number;
  byCategory: Array<{ category: string; direction: 'income' | 'expense'; total: number }>;
};

export type CampaignDto = {
  id: string;
  title: string;
  description: string;
  targetAmount: number;
  collectedAmount: number;
  deadline: string | null;
  status: 'open' | 'closed';
  coverMediaId: string | null;
  donorCount: number;
  createdAt: string;
};

export type DonationDto = {
  id: string;
  campaignId: string;
  donorName: string;
  amount: number;
  status: 'pending' | 'approved' | 'rejected';
  note: string | null;
  proofMediaId: string | null;
  createdAt: string;
};

export type CommunityAdminDto = {
  id: string;
  name: string;
  slug: string;
  address: string | null;
  isActive: boolean;
  memberCount: number;
  houseCount: number;
  mediaBytes: number;
  createdAt: string;
};

export type StatsDto = {
  communities: number;
  users: number;
  mediaCount: number;
  mediaBytes: number;
  alerts24h: number;
};

export type Paginated<T> = { items: T[]; nextCursor: string | null };
