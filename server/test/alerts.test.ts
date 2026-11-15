import { beforeAll, describe, expect, test } from 'bun:test';
import { loginAs, phones, request, seedDatabase } from './helpers';

let budiToken = '';
let satpamToken = '';
let alertId = '';

beforeAll(async () => {
  await seedDatabase();
  budiToken = await loginAs(phones.budi);
  satpamToken = await loginAs(phones.satpam);
});

describe('panic', () => {
  test('panic kedua saat masih aktif ditolak 409', async () => {
    const first = await request('/alerts', {
      method: 'POST',
      token: budiToken,
      body: { message: 'maling di pagar' },
    });

    expect(first.status).toBe(201);
    expect(first.body.status).toBe('active');
    expect(first.body.houseLabel).toBe('Blok A No. 3');
    alertId = first.body.id;

    const second = await request('/alerts', {
      method: 'POST',
      token: budiToken,
      body: { message: 'lagi' },
    });

    expect(second.status).toBe(409);
    expect(second.body.code).toBe('alert_active');
  });

  test('warga tidak boleh acknowledge', async () => {
    const result = await request(`/alerts/${alertId}/acknowledge`, {
      method: 'POST',
      token: budiToken,
    });
    expect(result.status).toBe(403);
  });

  test('satpam acknowledge dan timeline tercatat', async () => {
    const ack = await request(`/alerts/${alertId}/acknowledge`, {
      method: 'POST',
      token: satpamToken,
    });

    expect(ack.status).toBe(200);
    expect(ack.body.status).toBe('acknowledged');
    expect(ack.body.acknowledgedByName).toBe('Joko Prasetyo');

    const detail = await request(`/alerts/${alertId}`, { token: satpamToken });
    expect(detail.status).toBe(200);
    expect(detail.body.events.map((event: { type: string }) => event.type)).toEqual([
      'created',
      'notified',
      'acknowledged',
    ]);
  });

  test('resolve lalu panic baru dalam 30 detik kena cooldown', async () => {
    const resolved = await request(`/alerts/${alertId}/resolve`, {
      method: 'POST',
      token: satpamToken,
      body: { resolution: 'handled', note: 'sudah ditangani' },
    });
    expect(resolved.status).toBe(200);
    expect(resolved.body.status).toBe('resolved');

    const again = await request('/alerts', {
      method: 'POST',
      token: budiToken,
      body: {},
    });

    expect(again.status).toBe(429);
    expect(again.body.code).toBe('rate_limited');
  });

  test('pemicu (warga) boleh menyelesaikan alert-nya sendiri', async () => {
    const agusToken = await loginAs(phones.agus);

    const created = await request('/alerts', { method: 'POST', token: agusToken, body: {} });
    expect(created.status).toBe(201);

    const resolved = await request(`/alerts/${created.body.id}/resolve`, {
      method: 'POST',
      token: agusToken,
      body: { resolution: 'false_alarm' },
    });
    expect(resolved.status).toBe(200);
    expect(resolved.body.resolution).toBe('false_alarm');
  });

  test('pemicu bisa membatalkan dalam 10 detik, warga lain tidak', async () => {
    const sriToken = await loginAs(phones.sri);
    const agusToken = await loginAs(phones.agus);

    const created = await request('/alerts', { method: 'POST', token: sriToken, body: {} });
    expect(created.status).toBe(201);

    const byOther = await request(`/alerts/${created.body.id}/cancel`, {
      method: 'POST',
      token: agusToken,
    });
    expect(byOther.status).toBe(403);

    const cancelled = await request(`/alerts/${created.body.id}/cancel`, {
      method: 'POST',
      token: sriToken,
    });
    expect(cancelled.status).toBe(200);
    expect(cancelled.body.status).toBe('cancelled');

    const again = await request(`/alerts/${created.body.id}/cancel`, {
      method: 'POST',
      token: sriToken,
    });
    expect(again.status).toBe(409);
  });

  test('daftar alert aktif kosong setelah diselesaikan', async () => {
    const result = await request('/alerts/active', { token: budiToken });
    expect(result.status).toBe(200);
    expect(result.body.items).toEqual([]);
  });
});
