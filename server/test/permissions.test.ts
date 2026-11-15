import { beforeAll, describe, expect, test } from 'bun:test';
import type { Role } from '../src/contracts';
import { MATRIX, can, type Capability } from '../src/lib/permissions';
import { invoiceIdFor, loginAs, phones, request, seedDatabase } from './helpers';

const roles: Role[] = ['admin', 'pengurus', 'bendahara', 'satpam', 'warga'];

const capabilities = Object.keys(MATRIX) as Capability[];

function authFor(role: Role) {
  return {
    userId: '00000000-0000-0000-0000-000000000000',
    communityId: '00000000-0000-0000-0000-000000000001',
    role,
    houseId: '00000000-0000-0000-0000-000000000002',
    platformAdmin: false,
  };
}

beforeAll(async () => {
  await seedDatabase();
});

describe('matriks izin', () => {
  test('setiap role cocok dengan tabel plan', () => {
    for (const role of roles) {
      for (const capability of capabilities) {
        const expected = role === 'admin' ? true : MATRIX[capability].includes(role);
        expect({ role, capability, allowed: can(authFor(role), capability) }).toEqual({
          role,
          capability,
          allowed: expected,
        });
      }
    }
  });

  test('warga tidak bisa membaca daftar anggota', async () => {
    const token = await loginAs(phones.budi);
    const result = await request('/members', { token });
    expect(result.status).toBe(403);
  });

  test('satpam tidak bisa menulis kas', async () => {
    const token = await loginAs(phones.satpam);
    const result = await request('/finance/ledger', {
      method: 'POST',
      token,
      body: {
        direction: 'expense',
        category: 'keamanan',
        amount: 50_000,
        occurredOn: '2026-11-01',
        description: 'Beli senter',
      },
    });
    expect(result.status).toBe(403);
  });

  test('bendahara tidak bisa menerbitkan pengumuman', async () => {
    const token = await loginAs(phones.bendahara);
    const result = await request('/announcements', {
      method: 'POST',
      token,
      body: { title: 'Tes', body: 'Isi pengumuman', category: 'umum' },
    });
    expect(result.status).toBe(403);
  });

  test('pengurus bisa mereview pembayaran', async () => {
    const budi = await loginAs(phones.budi);
    const invoiceId = await invoiceIdFor('A-03');

    const report = await request(`/finance/invoices/${invoiceId}/payments`, {
      method: 'POST',
      token: budi,
      body: { amount: 150_000 },
    });
    expect(report.status).toBe(201);

    const pengurus = await loginAs(phones.pengurus);
    const review = await request(`/finance/payments/${report.body.id}/review`, {
      method: 'POST',
      token: pengurus,
      body: { action: 'approve' },
    });

    expect(review.status).toBe(200);
  });
});
