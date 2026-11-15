import { sql } from '../db/client';
import { env, isProduction } from '../env';
import {
  communityTopic,
  createPushAdapter,
  responderTopic,
  type PushResult,
} from './push';

export const push = createPushAdapter({
  credentials: env.FCM_SERVICE_ACCOUNT_JSON,
  isProduction,
});

export type NotifyInput = {
  communityId: string;
  type: 'panic' | 'alert_update' | 'announcement';
  title: string;
  body: string;
  data: Record<string, string>;
  tag?: string;
  /** Notifikasi tambahan hanya untuk pengurus/satpam. */
  responders?: { title: string; body: string };
};

export type NotifyResult = { community: PushResult; responders?: PushResult };

/**
 * Menulis inbox `notifications` untuk semua anggota aktif, lalu mengirim push
 * ke topic komunitas (dan topic petugas bila diminta). Inbox adalah sumber
 * kebenaran; kegagalan push tidak menggagalkan request.
 */
export async function notifyCommunity(input: NotifyInput): Promise<NotifyResult> {
  const payload = JSON.stringify(input.data);

  await sql`
    insert into notifications (community_id, user_id, type, title, body, data)
    select ${input.communityId}, m.user_id, ${input.type}, ${input.title}, ${input.body}, ${payload}::jsonb
    from memberships m
    where m.community_id = ${input.communityId} and m.is_active = true
  `;

  const community = await push.sendToTopic(communityTopic(input.communityId), {
    title: input.title,
    body: input.body,
    data: input.data,
    tag: input.tag,
  });

  if (!input.responders) return { community };

  const responders = await push.sendToTopic(responderTopic(input.communityId), {
    title: input.responders.title,
    body: input.responders.body,
    data: { ...input.data, audience: 'responders' },
    tag: input.tag,
  });

  return { community, responders };
}
