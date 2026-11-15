import { beforeAll, describe, expect, test } from 'bun:test';
import { loginAs, phones, request, seedDatabase } from './helpers';

let demoToken = '';
let otherCommunityToken = '';
let alertId = '';
let paymentId = '';

beforeAll(async () => {
  await seedDatabase();
  demoToken = await loginAs(phones.budi);

  const adminLogin = await request('/auth/login', {
    method: 'POST',
    body: { phone: phones.admin, password: 'Rahasia123!' },
  });
  const platformToken = adminLogin.body.accessToken as string;

  const created = await request('/admin/communities', {
    method: 'POST',
    token: platformToken,
    body: { name: 'Kampung Lain', slug: 'lain' },
  });

  await request(`/admin/communities/${created.body.community.id}/join`, {
    method: 'POST',
    token: platformToken,
  });

  const switched = await request('/auth/switch-community', {
    method: 'POST',
    token: platformToken,
    body: { communityId: created.body.community.id },
  });
  otherCommunityToken = switched.body.accessToken;

  const alert = await request('/alerts', { method: 'POST', token: demoToken, body: {} });
  alertId = alert.body.id;

  const invoices = await request('/finance/invoices', { token: demoToken });
  const invoice = invoices.body.items[0];
  const report = await request(`/finance/invoices/${invoice.id}/payments`, {
    method: 'POST',
    token: demoToken,
    body: { amount: 150_000 },
  });
  paymentId = report.body.id;
});

describe('isolasi antar komunitas', () => {
  test('alert komunitas lain tidak terlihat (404)', async () => {
    const result = await request(`/alerts/${alertId}`, { token: otherCommunityToken });
    expect(result.status).toBe(404);
  });

  test('review pembayaran komunitas lain tidak bisa (404)', async () => {
    const result = await request(`/finance/payments/${paymentId}/review`, {
      method: 'POST',
      token: otherCommunityToken,
      body: { action: 'approve' },
    });
    expect(result.status).toBe(404);
  });

  test('direktori komunitas lain kosong, bukan data demo', async () => {
    const result = await request('/directory', { token: otherCommunityToken });
    expect(result.status).toBe(200);
    const names = result.body.items.map((item: { name: string }) => item.name);
    expect(names).not.toContain('Budi Santoso');
  });
});
