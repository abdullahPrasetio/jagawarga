import { beforeAll, describe, expect, test } from 'bun:test';
import { sql } from '../src/db/client';
import { loginAs, phones, request, seedDatabase } from './helpers';

let budiToken = '';
let rinaToken = '';
let pengurusToken = '';

async function activate(code: string, phone: string) {
  return request('/auth/activate', {
    method: 'POST',
    body: { inviteCode: code, name: `Anggota ${phone}`, phone, password: 'Rahasia123!' },
  });
}

beforeAll(async () => {
  await seedDatabase();
  budiToken = await loginAs(phones.budi);
  rinaToken = await loginAs(phones.rina);
  pengurusToken = await loginAs(phones.pengurus);
});

describe('rumah tangga', () => {
  test('hanya kepala keluarga yang bisa membuat kode', async () => {
    const asRina = await request('/invites/household', { method: 'POST', token: rinaToken });
    expect(asRina.status).toBe(403);

    const asBudi = await request('/invites/household', { method: 'POST', token: budiToken });
    expect(asBudi.status).toBe(201);
    expect(asBudi.body.code).toHaveLength(8);

    const used = await activate(asBudi.body.code, '081199900010');
    expect(used.status).toBe(201);
    expect(used.body.membership.houseLabel).toBe('Blok A No. 3');

    const household = await request('/me/household', { token: budiToken });
    expect(household.body.members).toHaveLength(3);
    expect(household.body.headName).toBe('Budi Santoso');

    const reused = await activate(asBudi.body.code, '081199900011');
    expect(reused.status).toBe(409);
    expect(reused.body.code).toBe('invite_invalid');
  });

  test('maksimal 5 kode household aktif per rumah', async () => {
    for (let index = 0; index < 5; index += 1) {
      const created = await request('/invites/household', { method: 'POST', token: budiToken });
      expect(created.status).toBe(201);
    }

    const overflow = await request('/invites/household', { method: 'POST', token: budiToken });
    expect(overflow.status).toBe(429);
    expect(overflow.body.code).toBe('rate_limited');
  });

  test('anggota ke-7 ditolak household_full', async () => {
    const pending = await request('/invites/household', { token: budiToken });
    const codes: string[] = pending.body.items.map((item: { code: string }) => item.code);

    const budget = 6 - 3;
    for (let index = 0; index < budget; index += 1) {
      const code = codes[index];
      if (!code) throw new Error('kode undangan habis');
      const result = await activate(code, `08119990002${index}`);
      expect(result.status).toBe(201);
    }

    const extra = await request('/invites/household', { method: 'POST', token: budiToken });
    expect(extra.status).toBe(201);

    const seventh = await activate(extra.body.code, '081199900029');
    expect(seventh.status).toBe(409);
    expect(seventh.body.code).toBe('household_full');
  });

  test('kepala keluarga bisa dipindahkan, tetap satu per rumah', async () => {
    const [row] = await sql<{ id: string }[]>`
      select m.id from memberships m
      join users u on u.id = m.user_id
      join houses h on h.id = m.house_id
      where u.phone = ${phones.rina} and h.block = 'A' and h.number = '03'
      limit 1
    `;
    if (!row) throw new Error('membership Rina tidak ditemukan');

    const patched = await request(`/members/${row.id}`, {
      method: 'PATCH',
      token: pengurusToken,
      body: { isHouseholdHead: true },
    });
    expect(patched.status).toBe(200);
    expect(patched.body.isHouseholdHead).toBe(true);

    const household = await request('/me/household', { token: rinaToken });
    expect(household.body.headName).toBe('Rina Santoso');

    const [counts] = await sql<{ heads: number }[]>`
      select count(*)::int as heads from memberships m
      join houses h on h.id = m.house_id
      where h.block = 'A' and h.number = '03' and m.is_household_head and m.is_active
    `;
    expect(counts?.heads).toBe(1);
  });
});
