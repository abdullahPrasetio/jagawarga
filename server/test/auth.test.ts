import { beforeAll, describe, expect, test } from 'bun:test';
import { request, seedDatabase, phones } from './helpers';

beforeAll(async () => {
  await seedDatabase();
});

describe('auth', () => {
  test('aktivasi memakai kode undangan sekali pakai', async () => {
    const created = await request('/auth/activate', {
      method: 'POST',
      body: {
        inviteCode: 'DEMO-WARGA-1',
        name: 'Warga Baru',
        phone: '081199900001',
        password: 'Rahasia123!',
      },
    });

    expect(created.status).toBe(201);
    expect(created.body.membership.role).toBe('warga');
    expect(typeof created.body.accessToken).toBe('string');

    const reused = await request('/auth/activate', {
      method: 'POST',
      body: {
        inviteCode: 'DEMO-WARGA-1',
        name: 'Warga Lain',
        phone: '081199900002',
        password: 'Rahasia123!',
      },
    });

    expect(reused.status).toBe(409);
    expect(reused.body.code).toBe('invite_invalid');
  });

  test('password salah ditolak 401', async () => {
    const result = await request('/auth/login', {
      method: 'POST',
      body: { phone: phones.budi, password: 'salah-sekali' },
    });

    expect(result.status).toBe(401);
    expect(result.body.code).toBe('unauthorized');
  });

  test('refresh merotasi token dan token lama tidak bisa dipakai lagi', async () => {
    const login = await request('/auth/login', {
      method: 'POST',
      body: { phone: phones.budi, password: 'Rahasia123!' },
    });

    expect(login.status).toBe(200);
    const first = login.body.refreshToken as string;

    const refreshed = await request('/auth/refresh', {
      method: 'POST',
      body: { refreshToken: first },
    });

    expect(refreshed.status).toBe(200);
    expect(refreshed.body.refreshToken).not.toBe(first);

    const replay = await request('/auth/refresh', {
      method: 'POST',
      body: { refreshToken: first },
    });

    expect(replay.status).toBe(401);
  });
});
