import { and, desc, eq, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import {
  campaignCreateSchema,
  donationUploadSchema,
  reviewSchema,
  type CampaignDto,
  type DonationDto,
} from '../../contracts';
import { db } from '../../db/client';
import { campaignDonations, campaigns, ledgerEntries, media, users } from '../../db/schema';
import { parseFormOrJson, parseJson } from '../../lib/http';
import { ensure } from '../../lib/permissions';
import { ApiError } from '../../lib/problem';
import { hit } from '../../lib/ratelimit';
import { saveImage } from '../../lib/storage';

export const campaignRoutes = new Hono();

campaignRoutes.get('/campaigns', async (c) => {
  const auth = c.get('auth');
  ensure(auth, 'campaigns.read');
  const status = c.req.query('status');

  const conditions = [eq(campaigns.communityId, auth.communityId!)];
  if (status) conditions.push(eq(campaigns.status, status));

  const rows = await db
    .select({
      id: campaigns.id,
      title: campaigns.title,
      description: campaigns.description,
      targetAmount: campaigns.targetAmount,
      deadline: campaigns.deadline,
      status: campaigns.status,
      coverMediaId: campaigns.coverMediaId,
      createdAt: campaigns.createdAt,
      collectedAmount: sql<number>`coalesce((
        select sum(d.amount)::int from campaign_donations d
        where d.campaign_id = ${campaigns.id} and d.status = 'approved'
      ), 0)`,
      donorCount: sql<number>`(
        select count(*)::int from campaign_donations d
        where d.campaign_id = ${campaigns.id} and d.status = 'approved'
      )`,
    })
    .from(campaigns)
    .where(and(...conditions))
    .orderBy(desc(campaigns.createdAt));

  const items: CampaignDto[] = rows.map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    targetAmount: row.targetAmount,
    collectedAmount: row.collectedAmount,
    deadline: row.deadline,
    status: row.status as CampaignDto['status'],
    coverMediaId: row.coverMediaId,
    donorCount: row.donorCount,
    createdAt: row.createdAt.toISOString(),
  }));

  return c.json({ items });
});

campaignRoutes.post('/campaigns', async (c) => {
  const auth = c.get('auth');
  ensure(auth, 'campaigns.write');
  const body = await parseJson(c, campaignCreateSchema);

  const [created] = await db
    .insert(campaigns)
    .values({
      communityId: auth.communityId!,
      title: body.title,
      description: body.description,
      targetAmount: body.targetAmount,
      deadline: body.deadline ?? null,
      coverMediaId: body.coverMediaId ?? null,
      createdBy: auth.userId,
    })
    .returning();

  if (!created) throw new ApiError(500, 'internal_error', 'Gagal membuat kampanye');

  return c.json(
    {
      id: created.id,
      title: created.title,
      description: created.description,
      targetAmount: created.targetAmount,
      collectedAmount: 0,
      deadline: created.deadline,
      status: created.status as CampaignDto['status'],
      coverMediaId: created.coverMediaId,
      donorCount: 0,
      createdAt: created.createdAt.toISOString(),
    } satisfies CampaignDto,
    201,
  );
});

campaignRoutes.get('/campaigns/:id', async (c) => {
  const auth = c.get('auth');
  ensure(auth, 'campaigns.read');

  const [campaign] = await db
    .select()
    .from(campaigns)
    .where(and(eq(campaigns.id, c.req.param('id')), eq(campaigns.communityId, auth.communityId!)))
    .limit(1);

  if (!campaign) throw new ApiError(404, 'not_found', 'Kampanye tidak ditemukan');

  const [totals] = await db
    .select({
      collected: sql<number>`coalesce(sum(${campaignDonations.amount}), 0)::int`,
      donors: sql<number>`count(*)::int`,
    })
    .from(campaignDonations)
    .where(
      and(eq(campaignDonations.campaignId, campaign.id), eq(campaignDonations.status, 'approved')),
    );

  const donations = await db
    .select({
      id: campaignDonations.id,
      donorName: campaignDonations.donorName,
      isAnonymous: campaignDonations.isAnonymous,
      amount: campaignDonations.amount,
      createdAt: campaignDonations.createdAt,
    })
    .from(campaignDonations)
    .where(
      and(eq(campaignDonations.campaignId, campaign.id), eq(campaignDonations.status, 'approved')),
    )
    .orderBy(desc(campaignDonations.createdAt))
    .limit(50);

  return c.json({
    id: campaign.id,
    title: campaign.title,
    description: campaign.description,
    targetAmount: campaign.targetAmount,
    collectedAmount: totals?.collected ?? 0,
    deadline: campaign.deadline,
    status: campaign.status,
    coverMediaId: campaign.coverMediaId,
    donorCount: totals?.donors ?? 0,
    createdAt: campaign.createdAt.toISOString(),
    donations: donations.map((row) => ({
      id: row.id,
      donorName: row.isAnonymous ? 'Anonim' : (row.donorName ?? 'Warga'),
      amount: row.amount,
      createdAt: row.createdAt.toISOString(),
    })),
  });
});

campaignRoutes.post('/campaigns/:id/donations', async (c) => {
  const auth = c.get('auth');
  ensure(auth, 'donations.report');

  const [campaign] = await db
    .select({ id: campaigns.id, status: campaigns.status })
    .from(campaigns)
    .where(and(eq(campaigns.id, c.req.param('id')), eq(campaigns.communityId, auth.communityId!)))
    .limit(1);

  if (!campaign) throw new ApiError(404, 'not_found', 'Kampanye tidak ditemukan');
  if (campaign.status !== 'open') throw new ApiError(409, 'conflict', 'Kampanye sudah ditutup');

  const { data: parsed, file } = await parseFormOrJson(c, donationUploadSchema);

  hit(`donation:${auth.userId}:day`, 20, 24 * 60 * 60 * 1000);

  let proofMediaId: string | null = null;
  if (file) {
    const saved = await saveImage(auth.communityId!, file);
    const [row] = await db
      .insert(media)
      .values({
        communityId: auth.communityId!,
        ownerId: auth.userId,
        mime: saved.mime,
        bytes: saved.bytes,
        storageKey: saved.storageKey,
      })
      .returning({ id: media.id });
    proofMediaId = row?.id ?? null;
  }

  const [created] = await db
    .insert(campaignDonations)
    .values({
      communityId: auth.communityId!,
      campaignId: campaign.id,
      reportedBy: auth.userId,
      donorName: parsed.donorName ?? null,
      isAnonymous: parsed.isAnonymous ?? false,
      amount: parsed.amount,
      proofMediaId,
      note: parsed.note ?? null,
    })
    .returning();

  if (!created) throw new ApiError(500, 'internal_error', 'Gagal menyimpan donasi');

  return c.json(
    {
      id: created.id,
      campaignId: created.campaignId,
      donorName: created.isAnonymous ? 'Anonim' : (created.donorName ?? auth.userId),
      amount: created.amount,
      status: created.status as DonationDto['status'],
      note: created.note,
      proofMediaId: created.proofMediaId,
      createdAt: created.createdAt.toISOString(),
    } satisfies DonationDto,
    201,
  );
});

campaignRoutes.get('/campaign-donations', async (c) => {
  const auth = c.get('auth');
  ensure(auth, 'donations.review');

  const conditions = [eq(campaignDonations.communityId, auth.communityId!)];
  const status = c.req.query('status');
  if (status) conditions.push(eq(campaignDonations.status, status));

  const rows = await db
    .select({
      id: campaignDonations.id,
      campaignId: campaignDonations.campaignId,
      campaignTitle: campaigns.title,
      donorName: campaignDonations.donorName,
      isAnonymous: campaignDonations.isAnonymous,
      amount: campaignDonations.amount,
      status: campaignDonations.status,
      note: campaignDonations.note,
      proofMediaId: campaignDonations.proofMediaId,
      createdAt: campaignDonations.createdAt,
      reporterName: users.name,
    })
    .from(campaignDonations)
    .innerJoin(campaigns, eq(campaigns.id, campaignDonations.campaignId))
    .innerJoin(users, eq(users.id, campaignDonations.reportedBy))
    .where(and(...conditions))
    .orderBy(desc(campaignDonations.createdAt))
    .limit(200);

  return c.json({
    items: rows.map((row) => ({
      id: row.id,
      campaignId: row.campaignId,
      campaignTitle: row.campaignTitle,
      donorName: row.isAnonymous ? 'Anonim' : (row.donorName ?? row.reporterName),
      amount: row.amount,
      status: row.status,
      note: row.note,
      proofMediaId: row.proofMediaId,
      createdAt: row.createdAt.toISOString(),
    })),
  });
});

campaignRoutes.post('/campaign-donations/:id/review', async (c) => {
  const auth = c.get('auth');
  ensure(auth, 'donations.review');
  const body = await parseJson(c, reviewSchema);

  if (body.action === 'reject' && !body.note) {
    throw new ApiError(400, 'validation_failed', 'Catatan wajib diisi saat menolak donasi');
  }

  await db.transaction(async (tx) => {
    const locked = (await tx.execute(
      sql`select id, campaign_id, amount, status, donor_name, is_anonymous
          from campaign_donations
          where id = ${c.req.param('id')} and community_id = ${auth.communityId!} for update`,
    )) as unknown as Array<{
      id: string;
      campaign_id: string;
      amount: number;
      status: string;
      donor_name: string | null;
      is_anonymous: boolean;
    }>;

    const donation = locked[0];
    if (!donation) throw new ApiError(404, 'not_found', 'Donasi tidak ditemukan');
    if (donation.status !== 'pending') {
      throw new ApiError(409, 'conflict', 'Donasi ini sudah direview');
    }

    await tx
      .update(campaignDonations)
      .set({
        status: body.action === 'approve' ? 'approved' : 'rejected',
        note: body.note ?? null,
        reviewedBy: auth.userId,
        reviewedAt: new Date(),
      })
      .where(eq(campaignDonations.id, donation.id));

    if (body.action === 'approve') {
      await tx.insert(ledgerEntries).values({
        communityId: auth.communityId!,
        direction: 'income',
        category: 'donasi',
        amount: donation.amount,
        occurredOn: new Date().toISOString().slice(0, 10),
        description: `Donasi ${donation.is_anonymous ? 'anonim' : (donation.donor_name ?? 'warga')}`,
        sourceDonationId: donation.id,
        createdBy: auth.userId,
      });
    }
  });

  return c.json({ ok: true });
});
