import { beforeAll, describe, expect, test } from 'bun:test';
import { sql } from '../src/db/client';
import { communityId, loginAs, phones, request, seedDatabase } from './helpers';

let platformToken = '';
let budiToken = '';
let secondCommunityId = '';

beforeAll(async () => {
  await seedDatabase();
  budiToken = await loginAs(phones.budi);

  const login = await request('/auth/login', {
    method: 'POST',
    body: { phone: phones.admin, password: 'Rahasia123!' },
  });

  expect(login.status).toBe(200);
  expect(login.body.membership).toBeNull();
  platformToken = login.body.accessToken;
});

describe('platform admin', () => {
  test('token platform admin tanpa komunitas tetap bisa /me', async () => {
    const me = await request('/auth/me', { token: platformToken });
    expect(me.status).toBe(200);
    expect(me.body.user.isPlatformAdmin).toBe(true);
    expect(me.body.membership).toBeNull();
  });

  test('user biasa tidak boleh akses /admin', async () => {
    const result = await request('/admin/communities', { token: budiToken });
    expect(result.status).toBe(403);
  });

  test('buat komunitas + slug duplikat ditolak', async () => {
    const created = await request('/admin/communities', {
      method: 'POST',
      token: platformToken,
      body: { name: 'Kampung Kedua', slug: 'kedua' },
    });

    expect(created.status).toBe(201);
    expect(created.body.inviteCode).toHaveLength(8);
    secondCommunityId = created.body.community.id;

    const duplicate = await request('/admin/communities', {
      method: 'POST',
      token: platformToken,
      body: { name: 'Kampung Kedua Copy', slug: 'kedua' },
    });

    expect(duplicate.status).toBe(409);
  });

  test('join komunitas menulis audit sekali (idempoten)', async () => {
    const join = await request(`/admin/communities/${secondCommunityId}/join`, {
      method: 'POST',
      token: platformToken,
    });
    expect(join.status).toBe(200);

    const again = await request(`/admin/communities/${secondCommunityId}/join`, {
      method: 'POST',
      token: platformToken,
    });
    expect(again.status).toBe(200);

    const [row] = await sql<{ count: number }[]>`
      select count(*)::int as count from audit_logs
      where action = 'community.join' and community_id = ${secondCommunityId}
    `;
    expect(row?.count).toBe(1);
  });

  test('switch-community memberi token untuk komunitas baru', async () => {
    const switched = await request('/auth/switch-community', {
      method: 'POST',
      token: platformToken,
      body: { communityId: secondCommunityId },
    });

    expect(switched.status).toBe(200);
    expect(switched.body.membership.role).toBe('admin');
    expect(switched.body.community.name).toBe('Kampung Kedua');
  });

  test('suspend komunitas memblokir login anggotanya', async () => {
    const demoId = await communityId();

    const suspended = await request(`/admin/communities/${demoId}`, {
      method: 'PATCH',
      token: platformToken,
      body: { isActive: false },
    });
    expect(suspended.status).toBe(200);
    expect(suspended.body.isActive).toBe(false);

    const login = await request('/auth/login', {
      method: 'POST',
      body: { phone: phones.budi, password: 'Rahasia123!' },
    });
    expect(login.status).toBe(403);
    expect(login.body.code).toBe('community_suspended');

    await request(`/admin/communities/${demoId}`, {
      method: 'PATCH',
      token: platformToken,
      body: { isActive: true },
    });
  });

  test('stats melaporkan komunitas dan pengguna', async () => {
    const stats = await request('/admin/stats', { token: platformToken });
    expect(stats.status).toBe(200);
    expect(stats.body.communities).toBeGreaterThanOrEqual(2);
    expect(stats.body.users).toBeGreaterThanOrEqual(8);
  });
});
