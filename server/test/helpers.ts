import { app } from '../src/app';
import { sql } from '../src/db/client';
import { resetLimits } from '../src/lib/ratelimit';
import { seedDemo } from '../src/seed';

export const PASSWORD = 'Rahasia123!';

const tables = [
  'alert_events',
  'alerts',
  'announcements',
  'audit_logs',
  'campaign_donations',
  'campaigns',
  'device_tokens',
  'invite_codes',
  'invoices',
  'ledger_entries',
  'media',
  'memberships',
  'notifications',
  'payments',
  'sessions',
  'houses',
  'users',
  'communities',
];

export async function resetDatabase(): Promise<void> {
  await sql.unsafe(`truncate table ${tables.join(', ')} restart identity cascade`);
  resetLimits();
}

export async function seedDatabase(): Promise<void> {
  await resetDatabase();
  await seedDemo();
}

export type ApiResult<T = any> = { status: number; body: T; headers: Headers };

export async function request<T = any>(
  path: string,
  options: { method?: string; token?: string; body?: unknown; headers?: Record<string, string> } = {},
): Promise<ApiResult<T>> {
  const headers: Record<string, string> = { ...options.headers };
  if (options.token) headers['authorization'] = `Bearer ${options.token}`;
  if (options.body !== undefined && !(options.body instanceof FormData)) {
    headers['content-type'] = 'application/json';
  }

  const response = await app.request(`/api/v1${path}`, {
    method: options.method ?? 'GET',
    headers,
    body:
      options.body === undefined
        ? undefined
        : options.body instanceof FormData
          ? options.body
          : JSON.stringify(options.body),
  });

  const text = await response.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  return { status: response.status, body: body as T, headers: response.headers };
}

export async function loginAs(phone: string): Promise<string> {
  const result = await request<{ accessToken: string }>('/auth/login', {
    method: 'POST',
    body: { phone, password: PASSWORD },
  });

  if (result.status !== 200) {
    throw new Error(`login ${phone} gagal: ${result.status} ${JSON.stringify(result.body)}`);
  }

  return result.body.accessToken;
}

export async function communityId(): Promise<string> {
  const [row] = await sql<{ id: string }[]>`select id from communities limit 1`;
  if (!row) throw new Error('komunitas demo belum ada');
  return row.id;
}

export async function houseId(code: string): Promise<string> {
  const [block, number] = code.split('-');
  const [row] = await sql<{ id: string }[]>`
    select id from houses where block = ${block!} and number = ${number!} limit 1
  `;
  if (!row) throw new Error(`rumah ${code} tidak ada`);
  return row.id;
}

export async function invoiceIdFor(code: string): Promise<string> {
  const [row] = await sql<{ id: string }[]>`
    select i.id from invoices i
    join houses h on h.id = i.house_id
    where h.block = ${code.split('-')[0]!} and h.number = ${code.split('-')[1]!}
    order by i.created_at desc limit 1
  `;
  if (!row) throw new Error(`invoice ${code} tidak ada`);
  return row.id;
}

export const phones = {
  admin: '081100000001',
  pengurus: '081100000002',
  bendahara: '081100000003',
  satpam: '081100000004',
  budi: '081100000005',
  rina: '081100000006',
  agus: '081100000007',
  sri: '081100000008',
};

export function imageFile(): File {
  // PNG 1×1 piksel valid (magic bytes + IEND).
  const base64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  const bytes = Buffer.from(base64, 'base64');
  return new File([bytes], 'bukti.png', { type: 'image/png' });
}
