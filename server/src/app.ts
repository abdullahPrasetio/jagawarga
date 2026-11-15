import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { cors } from 'hono/cors';
import { corsOrigins } from './env';
import { withAuth, withCommunity, withPlatformAdmin } from './middleware/auth';
import { problem, toProblem } from './lib/problem';
import { adminRoutes } from './modules/admin/routes';
import { alertRoutes } from './modules/alerts/routes';
import { announcementRoutes } from './modules/announcements/routes';
import { authRoutes } from './modules/auth/routes';
import { campaignRoutes } from './modules/campaigns/routes';
import { communityRoutes } from './modules/community/routes';
import { financeRoutes } from './modules/finance/routes';
import { inviteRoutes } from './modules/invites/routes';
import { mediaRoutes } from './modules/media/routes';
import { notificationRoutes } from './modules/notifications/routes';
import { sql } from './db/client';

export const app = new Hono();

app.onError((err, c) => toProblem(c, err));

if (corsOrigins.length > 0) {
  app.use(
    '/api/*',
    cors({
      origin: corsOrigins,
      credentials: true,
      allowHeaders: ['authorization', 'content-type', 'x-client', 'last-event-id'],
      allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
      maxAge: 600,
    }),
  );
}

const api = new Hono();

api.get('/health', async (c) => {
  try {
    await sql`select 1`;
    return c.json({ ok: true, db: 'up' });
  } catch {
    return problem(c, 503, 'internal_error', 'Database tidak dapat dihubungi');
  }
});

api.use('/admin', withAuth, withPlatformAdmin);
api.use('/admin/*', withAuth, withPlatformAdmin);

const scopedPaths = [
  '/community',
  '/community/staff',
  '/houses',
  '/houses/*',
  '/members',
  '/members/*',
  '/me/household',
  '/directory',
  '/invites',
  '/invites/*',
  '/alerts',
  '/alerts/*',
  '/events/stream',
  '/announcements',
  '/announcements/*',
  '/notifications',
  '/notifications/*',
  '/media',
  '/media/*',
  '/finance/*',
  '/campaigns',
  '/campaigns/*',
  '/campaign-donations',
  '/campaign-donations/*',
];

for (const path of scopedPaths) api.use(path, withAuth, withCommunity);

api.use(
  '/media',
  bodyLimit({
    maxSize: 8 * 1024 * 1024,
    onError: (c) => problem(c, 413, 'payload_too_large', 'Ukuran gambar maksimal 5 MB'),
  }),
);

api.route('/auth', authRoutes);
api.route('/', adminRoutes);
api.route('/', communityRoutes);
api.route('/', inviteRoutes);
api.route('/', alertRoutes);
api.route('/', announcementRoutes);
api.route('/', notificationRoutes);
api.route('/', mediaRoutes);
api.route('/', financeRoutes);
api.route('/', campaignRoutes);

app.route('/api/v1', api);

app.notFound((c) => problem(c, 404, 'not_found', `Route ${c.req.path} tidak ada`));
