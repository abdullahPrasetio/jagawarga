import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

const id = () => uuid('id').primaryKey().defaultRandom();
const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();

/** communities */
export const communities = pgTable('communities', {
  id: id(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  address: text('address'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: createdAt(),
});

/** users */
export const users = pgTable(
  'users',
  {
    id: id(),
    phone: text('phone').notNull().unique(),
    name: text('name').notNull(),
    passwordHash: text('password_hash').notNull(),
    bio: text('bio'),
    interests: text('interests')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    avatarMediaId: uuid('avatar_media_id'),
    directoryVisible: boolean('directory_visible').notNull().default(true),
    isPlatformAdmin: boolean('is_platform_admin').notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index('users_interests_gin').using('gin', t.interests)],
);

/** houses */
export const houses = pgTable(
  'houses',
  {
    id: id(),
    communityId: uuid('community_id')
      .notNull()
      .references(() => communities.id, { onDelete: 'cascade' }),
    block: text('block').notNull(),
    number: text('number').notNull(),
    label: text('label').notNull(),
    isOccupied: boolean('is_occupied').notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('houses_community_block_number_unique').on(t.communityId, t.block, t.number)],
);

/** memberships */
export const memberships = pgTable(
  'memberships',
  {
    id: id(),
    communityId: uuid('community_id')
      .notNull()
      .references(() => communities.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    houseId: uuid('house_id').references(() => houses.id, { onDelete: 'set null' }),
    role: text('role').notNull(),
    isActive: boolean('is_active').notNull().default(true),
    isHouseholdHead: boolean('is_household_head').notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('memberships_community_user_unique').on(t.communityId, t.userId),
    uniqueIndex('memberships_house_head_unique')
      .on(t.communityId, t.houseId)
      .where(sql`is_household_head and is_active and house_id is not null`),
    index('memberships_community_idx').on(t.communityId),
    check(
      'memberships_role_check',
      sql`${t.role} in ('admin','pengurus','bendahara','satpam','warga')`,
    ),
  ],
);

/** invite_codes */
export const inviteCodes = pgTable(
  'invite_codes',
  {
    id: id(),
    communityId: uuid('community_id')
      .notNull()
      .references(() => communities.id, { onDelete: 'cascade' }),
    code: text('code').notNull().unique(),
    kind: text('kind').notNull(),
    role: text('role').notNull(),
    houseId: uuid('house_id').references(() => houses.id, { onDelete: 'set null' }),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    usedBy: uuid('used_by').references(() => users.id, { onDelete: 'set null' }),
    usedAt: timestamp('used_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    index('invite_codes_community_idx').on(t.communityId),
    check('invite_codes_kind_check', sql`${t.kind} in ('staff','household')`),
    check(
      'invite_codes_role_check',
      sql`${t.role} in ('admin','pengurus','bendahara','satpam','warga')`,
    ),
  ],
);

/** sessions (refresh token) */
export const sessions = pgTable(
  'sessions',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    userAgent: text('user_agent'),
    createdAt: createdAt(),
  },
  (t) => [index('sessions_user_idx').on(t.userId)],
);

/** device_tokens */
export const deviceTokens = pgTable(
  'device_tokens',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    communityId: uuid('community_id')
      .notNull()
      .references(() => communities.id, { onDelete: 'cascade' }),
    platform: text('platform').notNull(),
    token: text('token').notNull().unique(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
    createdAt: createdAt(),
  },
  (t) => [check('device_tokens_platform_check', sql`${t.platform} in ('android','ios')`)],
);

/** media */
export const media = pgTable(
  'media',
  {
    id: id(),
    communityId: uuid('community_id')
      .notNull()
      .references(() => communities.id, { onDelete: 'cascade' }),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull().default('image'),
    mime: text('mime').notNull(),
    bytes: integer('bytes').notNull(),
    storageKey: text('storage_key').notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    index('media_owner_created_idx').on(t.ownerId, t.createdAt),
    index('media_community_idx').on(t.communityId),
  ],
);

/** announcements */
export const announcements = pgTable(
  'announcements',
  {
    id: id(),
    communityId: uuid('community_id')
      .notNull()
      .references(() => communities.id, { onDelete: 'cascade' }),
    authorId: uuid('author_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    body: text('body').notNull(),
    category: text('category').notNull().default('umum'),
    isPinned: boolean('is_pinned').notNull().default(false),
    attachmentMediaId: uuid('attachment_media_id'),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    index('announcements_community_published_idx').on(t.communityId, t.publishedAt),
    check(
      'announcements_category_check',
      sql`${t.category} in ('umum','keamanan','kegiatan','darurat')`,
    ),
  ],
);

/** notifications */
export const notifications = pgTable(
  'notifications',
  {
    id: id(),
    communityId: uuid('community_id')
      .notNull()
      .references(() => communities.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    title: text('title').notNull(),
    body: text('body').notNull(),
    data: jsonb('data').notNull().default(sql`'{}'::jsonb`),
    readAt: timestamp('read_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index('notifications_user_read_idx').on(t.userId, t.readAt)],
);

/** alerts */
export const alerts = pgTable(
  'alerts',
  {
    id: id(),
    communityId: uuid('community_id')
      .notNull()
      .references(() => communities.id, { onDelete: 'cascade' }),
    triggeredBy: uuid('triggered_by')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    houseId: uuid('house_id').references(() => houses.id, { onDelete: 'set null' }),
    kind: text('kind').notNull().default('panic'),
    status: text('status').notNull().default('active'),
    message: text('message'),
    lat: doublePrecision('lat'),
    lng: doublePrecision('lng'),
    acknowledgedBy: uuid('acknowledged_by').references(() => users.id, { onDelete: 'set null' }),
    acknowledgedAt: timestamp('acknowledged_at', { withTimezone: true }),
    resolvedBy: uuid('resolved_by').references(() => users.id, { onDelete: 'set null' }),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    resolution: text('resolution'),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    index('alerts_community_status_idx').on(t.communityId, t.status),
    index('alerts_community_created_idx').on(t.communityId, t.createdAt),
    check('alerts_kind_check', sql`${t.kind} in ('panic','security','medical','fire')`),
    check(
      'alerts_status_check',
      sql`${t.status} in ('active','acknowledged','cancelled','resolved')`,
    ),
  ],
);

/** alert_events */
export const alertEvents = pgTable(
  'alert_events',
  {
    id: id(),
    communityId: uuid('community_id')
      .notNull()
      .references(() => communities.id, { onDelete: 'cascade' }),
    alertId: uuid('alert_id')
      .notNull()
      .references(() => alerts.id, { onDelete: 'cascade' }),
    actorId: uuid('actor_id').references(() => users.id, { onDelete: 'set null' }),
    type: text('type').notNull(),
    meta: jsonb('meta').notNull().default(sql`'{}'::jsonb`),
    createdAt: createdAt(),
  },
  (t) => [index('alert_events_alert_idx').on(t.alertId, t.createdAt)],
);

/** invoices */
export const invoices = pgTable(
  'invoices',
  {
    id: id(),
    communityId: uuid('community_id')
      .notNull()
      .references(() => communities.id, { onDelete: 'cascade' }),
    houseId: uuid('house_id')
      .notNull()
      .references(() => houses.id, { onDelete: 'cascade' }),
    period: text('period').notNull(),
    title: text('title').notNull(),
    amount: bigint('amount', { mode: 'number' }).notNull(),
    dueDate: date('due_date').notNull(),
    status: text('status').notNull().default('unpaid'),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('invoices_community_house_period_unique').on(t.communityId, t.houseId, t.period),
    index('invoices_community_status_idx').on(t.communityId, t.status),
    check(
      'invoices_status_check',
      sql`${t.status} in ('unpaid','partial','paid','void')`,
    ),
  ],
);

/** payments */
export const payments = pgTable(
  'payments',
  {
    id: id(),
    communityId: uuid('community_id')
      .notNull()
      .references(() => communities.id, { onDelete: 'cascade' }),
    invoiceId: uuid('invoice_id')
      .notNull()
      .references(() => invoices.id, { onDelete: 'cascade' }),
    reportedBy: uuid('reported_by')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    amount: bigint('amount', { mode: 'number' }).notNull(),
    method: text('method').notNull().default('transfer'),
    proofMediaId: uuid('proof_media_id'),
    status: text('status').notNull().default('pending'),
    note: text('note'),
    reviewedBy: uuid('reviewed_by').references(() => users.id, { onDelete: 'set null' }),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    index('payments_community_status_idx').on(t.communityId, t.status, t.createdAt),
    index('payments_invoice_idx').on(t.invoiceId),
    check('payments_status_check', sql`${t.status} in ('pending','approved','rejected')`),
  ],
);

/** ledger_entries */
export const ledgerEntries = pgTable(
  'ledger_entries',
  {
    id: id(),
    communityId: uuid('community_id')
      .notNull()
      .references(() => communities.id, { onDelete: 'cascade' }),
    direction: text('direction').notNull(),
    category: text('category').notNull(),
    amount: bigint('amount', { mode: 'number' }).notNull(),
    occurredOn: date('occurred_on').notNull(),
    description: text('description').notNull(),
    attachmentMediaId: uuid('attachment_media_id'),
    sourcePaymentId: uuid('source_payment_id').unique(),
    sourceDonationId: uuid('source_donation_id').unique(),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: createdAt(),
  },
  (t) => [
    index('ledger_entries_community_occurred_idx').on(t.communityId, t.occurredOn),
    check('ledger_entries_direction_check', sql`${t.direction} in ('income','expense')`),
  ],
);

/** campaigns */
export const campaigns = pgTable(
  'campaigns',
  {
    id: id(),
    communityId: uuid('community_id')
      .notNull()
      .references(() => communities.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    description: text('description').notNull(),
    targetAmount: bigint('target_amount', { mode: 'number' }).notNull(),
    deadline: date('deadline'),
    status: text('status').notNull().default('open'),
    coverMediaId: uuid('cover_media_id'),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: createdAt(),
  },
  (t) => [check('campaigns_status_check', sql`${t.status} in ('open','closed')`)],
);

/** campaign_donations */
export const campaignDonations = pgTable(
  'campaign_donations',
  {
    id: id(),
    communityId: uuid('community_id')
      .notNull()
      .references(() => communities.id, { onDelete: 'cascade' }),
    campaignId: uuid('campaign_id')
      .notNull()
      .references(() => campaigns.id, { onDelete: 'cascade' }),
    reportedBy: uuid('reported_by')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    donorName: text('donor_name'),
    isAnonymous: boolean('is_anonymous').notNull().default(false),
    amount: bigint('amount', { mode: 'number' }).notNull(),
    proofMediaId: uuid('proof_media_id'),
    status: text('status').notNull().default('pending'),
    note: text('note'),
    reviewedBy: uuid('reviewed_by').references(() => users.id, { onDelete: 'set null' }),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    index('campaign_donations_campaign_status_idx').on(t.campaignId, t.status),
    check(
      'campaign_donations_status_check',
      sql`${t.status} in ('pending','approved','rejected')`,
    ),
  ],
);

/** audit_logs */
export const auditLogs = pgTable(
  'audit_logs',
  {
    id: id(),
    actorId: uuid('actor_id').references(() => users.id, { onDelete: 'set null' }),
    communityId: uuid('community_id').references(() => communities.id, { onDelete: 'cascade' }),
    action: text('action').notNull(),
    targetType: text('target_type'),
    targetId: text('target_id'),
    meta: jsonb('meta').notNull().default(sql`'{}'::jsonb`),
    createdAt: createdAt(),
  },
  (t) => [index('audit_logs_actor_created_idx').on(t.actorId, t.createdAt)],
);
