import { and, desc, eq, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type { AlertDto, AlertEventDto } from '../../contracts';
import { db } from '../../db/client';
import { alertEvents, alerts, houses, users } from '../../db/schema';
import type { Auth } from '../../lib/jwt';
import { notifyCommunity, type NotifyResult } from '../../lib/notify';
import { alertKindMeta, alertNotification, isAlertKind } from '../../lib/push';
import { ApiError } from '../../lib/problem';
import { publish } from '../../lib/sse';

const ackUser = alias(users, 'ack_user');
const resUser = alias(users, 'res_user');

const alertColumns = {
  id: alerts.id,
  kind: alerts.kind,
  status: alerts.status,
  message: alerts.message,
  houseId: alerts.houseId,
  houseLabel: houses.label,
  triggeredBy: alerts.triggeredBy,
  triggeredByName: users.name,
  lat: alerts.lat,
  lng: alerts.lng,
  acknowledgedAt: alerts.acknowledgedAt,
  acknowledgedByName: ackUser.name,
  resolvedAt: alerts.resolvedAt,
  resolvedByName: resUser.name,
  resolution: alerts.resolution,
  createdAt: alerts.createdAt,
  eventCount: sql<number>`(select count(*)::int from alert_events e where e.alert_id = ${alerts.id})`,
};

type AlertRow = {
  id: string;
  kind: string;
  status: string;
  message: string | null;
  houseId: string | null;
  houseLabel: string | null;
  triggeredBy: string;
  triggeredByName: string;
  lat: number | null;
  lng: number | null;
  acknowledgedAt: Date | null;
  acknowledgedByName: string | null;
  resolvedAt: Date | null;
  resolvedByName: string | null;
  resolution: string | null;
  createdAt: Date;
  eventCount: number;
};

function toDto(row: AlertRow): AlertDto {
  return {
    id: row.id,
    kind: row.kind as AlertDto['kind'],
    status: row.status as AlertDto['status'],
    message: row.message,
    houseId: row.houseId,
    houseLabel: row.houseLabel,
    triggeredBy: row.triggeredBy,
    triggeredByName: row.triggeredByName,
    lat: row.lat,
    lng: row.lng,
    acknowledgedByName: row.acknowledgedByName,
    acknowledgedAt: row.acknowledgedAt?.toISOString() ?? null,
    resolvedByName: row.resolvedByName,
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
    resolution: row.resolution,
    createdAt: row.createdAt.toISOString(),
    eventCount: row.eventCount,
  };
}

function baseQuery() {
  return db
    .select(alertColumns)
    .from(alerts)
    .innerJoin(users, eq(users.id, alerts.triggeredBy))
    .leftJoin(houses, eq(houses.id, alerts.houseId))
    .leftJoin(ackUser, eq(ackUser.id, alerts.acknowledgedBy))
    .leftJoin(resUser, eq(resUser.id, alerts.resolvedBy));
}

export async function findAlert(communityId: string, alertId: string): Promise<AlertDto | null> {
  const rows = await baseQuery()
    .where(and(eq(alerts.id, alertId), eq(alerts.communityId, communityId)))
    .limit(1);
  const row = rows[0];
  return row ? toDto(row as AlertRow) : null;
}

export async function listAlerts(input: {
  communityId: string;
  status?: string;
  limit: number;
  cursorCreatedAt?: Date;
  cursorId?: string;
}): Promise<AlertDto[]> {
  const conditions = [eq(alerts.communityId, input.communityId)];
  if (input.status) conditions.push(eq(alerts.status, input.status));
  if (input.cursorCreatedAt && input.cursorId) {
    conditions.push(
      sql`(${alerts.createdAt}, ${alerts.id}) < (${input.cursorCreatedAt.toISOString()}::timestamptz, ${input.cursorId}::uuid)`,
    );
  }

  const rows = await baseQuery()
    .where(and(...conditions))
    .orderBy(desc(alerts.createdAt), desc(alerts.id))
    .limit(input.limit);

  return rows.map((row) => toDto(row as AlertRow));
}

export async function listAlertEvents(
  communityId: string,
  alertId: string,
): Promise<AlertEventDto[]> {
  const rows = await db
    .select({
      id: alertEvents.id,
      type: alertEvents.type,
      actorName: users.name,
      meta: alertEvents.meta,
      createdAt: alertEvents.createdAt,
    })
    .from(alertEvents)
    .leftJoin(users, eq(users.id, alertEvents.actorId))
    .where(and(eq(alertEvents.alertId, alertId), eq(alertEvents.communityId, communityId)))
    .orderBy(alertEvents.createdAt);

  return rows.map((row) => ({
    id: row.id,
    type: row.type,
    actorName: row.actorName,
    meta: (row.meta ?? {}) as Record<string, unknown>,
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function createAlert(
  auth: Auth,
  input: {
    houseId?: string;
    message?: string;
    lat?: number;
    lng?: number;
    kind?: 'panic' | 'security' | 'medical' | 'fire';
  },
): Promise<AlertDto> {
  const communityId = auth.communityId!;

  const [active] = await db
    .select({ id: alerts.id })
    .from(alerts)
    .where(
      and(
        eq(alerts.communityId, communityId),
        eq(alerts.triggeredBy, auth.userId),
        eq(alerts.status, 'active'),
      ),
    )
    .limit(1);

  if (active) {
    throw new ApiError(409, 'alert_active', 'Masih ada panic aktif. Selesaikan dulu sebelum mengirim lagi');
  }

  const [recent] = await db
    .select({ createdAt: alerts.createdAt })
    .from(alerts)
    .where(and(eq(alerts.communityId, communityId), eq(alerts.triggeredBy, auth.userId)))
    .orderBy(desc(alerts.createdAt))
    .limit(1);

  if (recent && Date.now() - recent.createdAt.getTime() < 30_000) {
    throw new ApiError(429, 'rate_limited', 'Tunggu 30 detik sebelum mengirim sinyal lagi');
  }

  const houseId = input.houseId ?? auth.houseId ?? null;

  const created = await db.transaction(async (tx) => {
    const [alert] = await tx
      .insert(alerts)
      .values({
        communityId,
        triggeredBy: auth.userId,
        houseId,
        kind: input.kind ?? 'panic',
        status: 'active',
        message: input.message ?? null,
        lat: input.lat ?? null,
        lng: input.lng ?? null,
      })
      .returning({ id: alerts.id });

    if (!alert) throw new ApiError(500, 'internal_error', 'Gagal membuat alert');

    await tx.insert(alertEvents).values({
      communityId,
      alertId: alert.id,
      actorId: auth.userId,
      type: 'created',
      meta: { kind: input.kind ?? 'panic' },
    });

    return alert.id;
  });

  const dto = await findAlert(communityId, created);
  if (!dto) throw new ApiError(500, 'internal_error', 'Alert tidak ditemukan setelah dibuat');

  publish(communityId, 'panic.created', dto);

  const notification = alertNotification(dto.kind, dto.houseLabel, dto.message);
  const result = await notifyCommunity({
    communityId,
    type: 'panic',
    title: notification.title,
    body: notification.body,
    tag: dto.id,
    data: {
      type: 'panic',
      alertId: dto.id,
      status: 'active',
      kind: dto.kind,
      action: 'open',
    },
    responders: {
      title: `Anda petugas — ${notification.title}`,
      body: 'Segera buka aplikasi dan berikan respons.',
    },
  });

  await recordPush(communityId, dto.id, auth.userId, result);

  return dto;
}

async function loadAlertForAction(communityId: string, alertId: string) {
  const [alert] = await db
    .select()
    .from(alerts)
    .where(and(eq(alerts.id, alertId), eq(alerts.communityId, communityId)))
    .limit(1);
  if (!alert) throw new ApiError(404, 'not_found', 'Alert tidak ditemukan');
  return alert;
}

export async function acknowledgeAlert(auth: Auth, alertId: string): Promise<AlertDto> {
  const communityId = auth.communityId!;
  const alert = await loadAlertForAction(communityId, alertId);

  if (alert.status !== 'active') {
    throw new ApiError(409, 'conflict', 'Alert ini sudah ditangani atau dibatalkan');
  }

  await db.transaction(async (tx) => {
    await tx
      .update(alerts)
      .set({ status: 'acknowledged', acknowledgedBy: auth.userId, acknowledgedAt: new Date() })
      .where(eq(alerts.id, alertId));
    await tx
      .insert(alertEvents)
      .values({ communityId, alertId, actorId: auth.userId, type: 'acknowledged' });
  });

  return publishUpdate(communityId, alertId, 'Sinyal sedang ditangani');
}

export async function resolveAlert(
  auth: Auth,
  alertId: string,
  input: { resolution: 'handled' | 'false_alarm'; note?: string },
): Promise<AlertDto> {
  const communityId = auth.communityId!;
  const alert = await loadAlertForAction(communityId, alertId);

  const isResponder = auth.role === 'admin' || auth.role === 'pengurus' || auth.role === 'satpam';
  const isTrigger = alert.triggeredBy === auth.userId;

  if (!isResponder && !isTrigger) {
    throw new ApiError(403, 'forbidden', 'Hanya pemicu atau petugas yang bisa menyelesaikan');
  }
  if (alert.status === 'resolved' || alert.status === 'cancelled') {
    throw new ApiError(409, 'conflict', 'Alert ini sudah selesai');
  }

  await db.transaction(async (tx) => {
    await tx
      .update(alerts)
      .set({
        status: 'resolved',
        resolvedBy: auth.userId,
        resolvedAt: new Date(),
        resolution: input.resolution,
      })
      .where(eq(alerts.id, alertId));
    await tx.insert(alertEvents).values({
      communityId,
      alertId,
      actorId: auth.userId,
      type: 'resolved',
      meta: { resolution: input.resolution, note: input.note ?? null },
    });
  });

  return publishUpdate(communityId, alertId, 'Sinyal darurat selesai');
}

export async function cancelAlert(auth: Auth, alertId: string): Promise<AlertDto> {
  const communityId = auth.communityId!;
  const alert = await loadAlertForAction(communityId, alertId);

  if (alert.triggeredBy !== auth.userId) {
    throw new ApiError(403, 'forbidden', 'Hanya pemicu yang bisa membatalkan');
  }
  if (Date.now() - alert.createdAt.getTime() > 10_000) {
    throw new ApiError(409, 'conflict', 'Batas waktu pembatalan (10 detik) sudah lewat');
  }
  if (alert.status === 'cancelled' || alert.status === 'resolved') {
    throw new ApiError(409, 'conflict', 'Alert ini sudah selesai');
  }

  await db.transaction(async (tx) => {
    await tx
      .update(alerts)
      .set({ status: 'cancelled', cancelledAt: new Date() })
      .where(eq(alerts.id, alertId));
    await tx
      .insert(alertEvents)
      .values({ communityId, alertId, actorId: auth.userId, type: 'cancelled' });
  });

  return publishUpdate(communityId, alertId, 'Sinyal darurat dibatalkan');
}

const statusLabel: Record<string, string> = {
  acknowledged: 'sedang ditangani',
  resolved: 'selesai',
  cancelled: 'dibatalkan',
};

async function publishUpdate(communityId: string, alertId: string, body: string): Promise<AlertDto> {
  const dto = await findAlert(communityId, alertId);
  if (!dto) throw new ApiError(404, 'not_found', 'Alert tidak ditemukan');

  publish(communityId, 'panic.updated', dto);

  const meta = isAlertKind(dto.kind) ? alertKindMeta[dto.kind] : alertKindMeta.panic;

  await notifyCommunity({
    communityId,
    type: 'alert_update',
    title: `${meta.emoji} ${meta.label}: ${dto.houseLabel ?? 'Tanpa unit'} — ${
      statusLabel[dto.status] ?? dto.status
    }`,
    body,
    tag: dto.id,
    data: {
      type: 'alert',
      alertId: dto.id,
      status: dto.status,
      kind: dto.kind,
      action: 'open',
    },
  });

  return dto;
}

/** Jejak upaya push agar bisa diaudit saat warga mengaku tidak menerima. */
async function recordPush(
  communityId: string,
  alertId: string,
  actorId: string,
  result: NotifyResult,
): Promise<void> {
  await db.insert(alertEvents).values({
    communityId,
    alertId,
    actorId,
    type: 'notified',
    meta: {
      community: result.community.ok,
      responders: result.responders?.ok ?? null,
      ...(result.community.error ? { error: result.community.error } : {}),
    },
  });
}
