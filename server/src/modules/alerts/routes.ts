import { and, eq, inArray } from 'drizzle-orm';
import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { alertCreateSchema, alertResolveSchema } from '../../contracts';
import { db } from '../../db/client';
import { alerts } from '../../db/schema';
import { decodeCursor, encodeCursor, pageSize, parseJson } from '../../lib/http';
import { ensure } from '../../lib/permissions';
import { ApiError } from '../../lib/problem';
import { hit } from '../../lib/ratelimit';
import { publish, registerClient, replay } from '../../lib/sse';
import {
  acknowledgeAlert,
  cancelAlert,
  createAlert,
  findAlert,
  listAlertEvents,
  listAlerts,
  resolveAlert,
} from './service';

export const alertRoutes = new Hono();

alertRoutes.get('/alerts', async (c) => {
  const auth = c.get('auth');
  ensure(auth, 'alerts.read');

  const limit = pageSize(c);
  const cursor = decodeCursor(c.req.query('cursor'));
  const status = c.req.query('status');

  const items = await listAlerts({
    communityId: auth.communityId!,
    status: status || undefined,
    limit: limit + 1,
    cursorCreatedAt: cursor?.createdAt,
    cursorId: cursor?.id,
  });

  const page = items.slice(0, limit);
  const last = page.at(-1);

  return c.json({
    items: page,
    nextCursor: items.length > limit && last ? encodeCursor(new Date(last.createdAt), last.id) : null,
  });
});

alertRoutes.get('/alerts/active', async (c) => {
  const auth = c.get('auth');
  ensure(auth, 'alerts.read');

  const rows = await db
    .select({ id: alerts.id })
    .from(alerts)
    .where(
      and(
        eq(alerts.communityId, auth.communityId!),
        inArray(alerts.status, ['active', 'acknowledged']),
      ),
    )
    .limit(10);

  const items = await Promise.all(rows.map((row) => findAlert(auth.communityId!, row.id)));

  return c.json({ items: items.filter((item) => item !== null) });
});

alertRoutes.get('/alerts/:id', async (c) => {
  const auth = c.get('auth');
  ensure(auth, 'alerts.read');

  const alert = await findAlert(auth.communityId!, c.req.param('id'));
  if (!alert) throw new ApiError(404, 'not_found', 'Alert tidak ditemukan');

  const events = await listAlertEvents(auth.communityId!, alert.id);

  return c.json({ ...alert, events });
});

alertRoutes.post('/alerts', async (c) => {
  const auth = c.get('auth');
  ensure(auth, 'alert.create');
  const body = await parseJson(c, alertCreateSchema);

  hit(`alert:${auth.userId}`, 5, 60_000);

  const alert = await createAlert(auth, body);
  return c.json(alert, 201);
});

alertRoutes.post('/alerts/:id/acknowledge', async (c) => {
  const auth = c.get('auth');
  ensure(auth, 'alert.acknowledge');

  const alert = await acknowledgeAlert(auth, c.req.param('id'));
  return c.json(alert);
});

alertRoutes.post('/alerts/:id/resolve', async (c) => {
  const auth = c.get('auth');
  // Pemicu boleh menyelesaikan alert-nya sendiri; `resolveAlert` yang menegakkan aturan.
  const body = await parseJson(c, alertResolveSchema);

  const alert = await resolveAlert(auth, c.req.param('id'), body);
  return c.json(alert);
});

alertRoutes.post('/alerts/:id/cancel', async (c) => {
  const auth = c.get('auth');
  ensure(auth, 'alert.cancel');

  const alert = await cancelAlert(auth, c.req.param('id'));
  return c.json(alert);
});

alertRoutes.get('/events/stream', async (c) => {
  const auth = c.get('auth');
  ensure(auth, 'events.stream');
  const communityId = auth.communityId!;
  const lastEventId = c.req.header('last-event-id') ?? c.req.query('lastEventId');

  return streamSSE(c, async (stream) => {
    const clientId = crypto.randomUUID();
    const unregister = registerClient(communityId, clientId, {
      writeSSE: (message) => stream.writeSSE({ event: message.event, data: message.data, id: message.id }),
    });

    stream.onAbort(() => unregister());

    await stream.writeSSE({ event: 'ready', data: JSON.stringify({ communityId, clientId }) });

    for (const entry of replay(communityId, lastEventId)) {
      await stream.writeSSE({ event: entry.event, data: entry.data, id: entry.id });
    }

    while (!stream.aborted) {
      await stream.sleep(25_000);
      if (stream.aborted) break;
      await stream.writeSSE({ event: 'ping', data: '{}' });
    }

    unregister();
  });
});

export function notifyStreamReady(communityId: string): void {
  publish(communityId, 'stream.ready', { communityId });
}
