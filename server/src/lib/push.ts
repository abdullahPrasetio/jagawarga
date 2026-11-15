import { cert, getApps, initializeApp } from 'firebase-admin/app';
import type { ServiceAccount } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';

export type AlertKind = 'panic' | 'security' | 'fire' | 'medical';

export type PushMessage = {
  title: string;
  body: string;
  data: Record<string, string>;
  /** Notifikasi dengan tag sama saling menggantikan (tidak menumpuk). */
  tag?: string;
};

export type PushResult = { ok: boolean; error?: string };

export interface PushAdapter {
  /** `fcm` = Firebase aktif; `log` = push dinonaktifkan (hanya log). */
  readonly kind: 'fcm' | 'log';
  sendToTopic(topic: string, message: PushMessage): Promise<PushResult>;
}

export const alertKindMeta: Record<AlertKind, { emoji: string; label: string; body: string }> = {
  panic: {
    emoji: '🚨',
    label: 'PANIC',
    body: 'Sinyal darurat dikirim. Buka aplikasi sekarang.',
  },
  security: {
    emoji: '🚨',
    label: 'MALING',
    body: 'Warga melaporkan orang mencurigakan. Buka aplikasi.',
  },
  fire: {
    emoji: '🔥',
    label: 'KEBAKARAN',
    body: 'Laporan kebakaran. Segera bantu dan hubungi petugas.',
  },
  medical: {
    emoji: '🚑',
    label: 'MEDIS',
    body: 'Butuh bantuan medis. Buka aplikasi sekarang.',
  },
};

export function isAlertKind(value: string): value is AlertKind {
  return value in alertKindMeta;
}

/** Judul & badan notifikasi darurat; dipakai push dan bisa diuji terpisah. */
export function alertNotification(
  kind: string,
  houseLabel: string | null,
  message: string | null | undefined,
): { title: string; body: string } {
  const meta = isAlertKind(kind) ? alertKindMeta[kind] : alertKindMeta.panic;
  const house = houseLabel ?? 'Tanpa unit';

  return {
    title: `${meta.emoji} ${meta.label}: ${house}`,
    body: message?.trim() ? message.trim() : meta.body,
  };
}

class LogPush implements PushAdapter {
  readonly kind = 'log' as const;

  async sendToTopic(topic: string, message: PushMessage): Promise<PushResult> {
    console.log(
      `[push:log] topic=${topic} tag=${message.tag ?? '-'} title=${JSON.stringify(message.title)}`,
    );
    return { ok: true };
  }
}

class FcmPush implements PushAdapter {
  readonly kind = 'fcm' as const;

  async sendToTopic(topic: string, message: PushMessage): Promise<PushResult> {
    const emergency = message.data.type === 'panic';

    try {
      await getMessaging().send({
        topic,
        notification: { title: message.title, body: message.body },
        data: message.data,
        android: {
          priority: 'high',
          notification: {
            channelId: emergency ? 'panic' : 'default',
            sound: 'default',
            defaultVibrateTimings: true,
            ...(message.tag ? { tag: message.tag } : {}),
          },
        },
        apns: {
          headers: { 'apns-priority': '10' },
          payload: {
            aps: {
              sound: 'default',
              'interruption-level': emergency ? 'time-sensitive' : 'active',
              ...(message.tag ? { 'thread-id': message.tag } : {}),
            },
          },
        },
      });
      return { ok: true };
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      console.error(`[push] gagal mengirim topic=${topic}`, detail);
      return { ok: false, error: detail.slice(0, 200) };
    }
  }
}

export function parseServiceAccount(raw: string): ServiceAccount | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const json = trimmed.startsWith('{') ? trimmed : Buffer.from(trimmed, 'base64').toString('utf8');
  try {
    return JSON.parse(json) as ServiceAccount;
  } catch {
    throw new Error('FCM_SERVICE_ACCOUNT_JSON tidak bisa diparse sebagai JSON/base64');
  }
}

export function createPushAdapter(options: { credentials: string; isProduction: boolean }): PushAdapter {
  const account = parseServiceAccount(options.credentials);

  if (!account) {
    if (options.isProduction) {
      // Push adalah best-effort: inbox tetap ditulis, jadi deployment tidak
      // boleh gagal total hanya karena Firebase belum dikonfigurasi.
      console.warn('[push] FCM_SERVICE_ACCOUNT_JSON kosong: push dinonaktifkan di production');
    }
    return new LogPush();
  }

  if (getApps().length === 0) initializeApp({ credential: cert(account) });
  return new FcmPush();
}

export function communityTopic(communityId: string): string {
  return `community_${communityId}`;
}

export function responderTopic(communityId: string): string {
  return `community_${communityId}_responders`;
}
