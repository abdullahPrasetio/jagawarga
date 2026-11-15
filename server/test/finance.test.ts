import { beforeAll, describe, expect, test } from 'bun:test';
import { houseId, invoiceIdFor, loginAs, phones, request, seedDatabase } from './helpers';

let bendaharaToken = '';
let budiToken = '';
let paymentId = '';

beforeAll(async () => {
  await seedDatabase();
  bendaharaToken = await loginAs(phones.bendahara);
  budiToken = await loginAs(phones.budi);
});

describe('keuangan', () => {
  test('buat tagihan massal: idempoten terhadap periode yang sama', async () => {
    const a03 = await houseId('A-03');
    const a04 = await houseId('A-04');

    const created = await request('/finance/invoices/batch', {
      method: 'POST',
      token: bendaharaToken,
      body: {
        period: '2030-01',
        title: 'Iuran Januari 2030',
        amount: 150_000,
        dueDate: '2030-01-10',
        houseIds: [a03, a04],
      },
    });

    expect(created.status).toBe(201);
    expect(created.body).toEqual({ created: 2, skipped: 0 });

    const again = await request('/finance/invoices/batch', {
      method: 'POST',
      token: bendaharaToken,
      body: {
        period: '2030-01',
        title: 'Iuran Januari 2030',
        amount: 150_000,
        dueDate: '2030-01-10',
        houseIds: [a03, a04],
      },
    });

    expect(again.body).toEqual({ created: 0, skipped: 2 });
  });

  test('warga melaporkan pembayaran dan bendahara menyetujui', async () => {
    const list = await request('/finance/invoices?period=2030-01', { token: bendaharaToken });
    const invoice = list.body.items.find((item: { houseLabel: string }) => item.houseLabel === 'Blok A No. 3');
    expect(invoice).toBeDefined();

    const report = await request(`/finance/invoices/${invoice.id}/payments`, {
      method: 'POST',
      token: budiToken,
      body: { amount: 150_000, note: 'transfer BCA' },
    });

    expect(report.status).toBe(201);
    expect(report.body.status).toBe('pending');
    paymentId = report.body.id;

    const review = await request(`/finance/payments/${paymentId}/review`, {
      method: 'POST',
      token: bendaharaToken,
      body: { action: 'approve' },
    });

    expect(review.status).toBe(200);
    expect(review.body.status).toBe('approved');

    const after = await request('/finance/invoices?period=2030-01', { token: bendaharaToken });
    const paidInvoice = after.body.items.find((item: { id: string }) => item.id === invoice.id);
    expect(paidInvoice.status).toBe('paid');
    expect(paidInvoice.paidAmount).toBe(150_000);

    const ledger = await request('/finance/ledger', { token: bendaharaToken });
    const entries = ledger.body.items.filter(
      (item: { description: string }) => item.description === 'Iuran Januari 2030 — Blok A No. 3',
    );
    expect(entries).toHaveLength(1);
    expect(entries[0].source).toBe('iuran');
    expect(entries[0].amount).toBe(150_000);

    const today = new Date().toISOString().slice(0, 10);
    const summary = await request(`/finance/summary?from=${today.slice(0, 7)}-01&to=${today}`, {
      token: budiToken,
    });
    expect(summary.body.income).toBe(150_000);
  });

  test('approve ulang ditolak 409 dan ledger tidak dobel', async () => {
    const again = await request(`/finance/payments/${paymentId}/review`, {
      method: 'POST',
      token: bendaharaToken,
      body: { action: 'approve' },
    });

    expect(again.status).toBe(409);

    const ledger = await request('/finance/ledger', { token: bendaharaToken });
    const iuranEntries = ledger.body.items.filter(
      (item: { source: string }) => item.source === 'iuran',
    );
    expect(iuranEntries).toHaveLength(1);
  });

  test('tolak pembayaran wajib catatan', async () => {
    const invoiceId = await invoiceIdFor('A-04');
    const agusToken = await loginAs(phones.agus);

    const report = await request(`/finance/invoices/${invoiceId}/payments`, {
      method: 'POST',
      token: agusToken,
      body: { amount: 150_000 },
    });
    expect(report.status).toBe(201);

    const rejected = await request(`/finance/payments/${report.body.id}/review`, {
      method: 'POST',
      token: bendaharaToken,
      body: { action: 'reject' },
    });
    expect(rejected.status).toBe(400);

    const withNote = await request(`/finance/payments/${report.body.id}/review`, {
      method: 'POST',
      token: bendaharaToken,
      body: { action: 'reject', note: 'bukti tidak terbaca' },
    });
    expect(withNote.status).toBe(200);
    expect(withNote.body.status).toBe('rejected');
  });

  test('pengeluaran manual mengurangi saldo', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const monthStart = `${today.slice(0, 7)}-01`;

    const created = await request('/finance/ledger', {
      method: 'POST',
      token: bendaharaToken,
      body: {
        direction: 'expense',
        category: 'keamanan',
        amount: 50_000,
        occurredOn: today,
        description: 'Beli lampu portal',
      },
    });
    expect(created.status).toBe(201);

    const summary = await request(`/finance/summary?from=${monthStart}&to=${today}`, {
      token: bendaharaToken,
    });
    expect(summary.body.income).toBe(150_000);
    expect(summary.body.expense).toBe(50_000);
    expect(summary.body.closing).toBe(100_000);
  });
});
