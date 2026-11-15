import { Hono } from 'hono';
import {
  invoiceBatchSchema,
  ledgerCreateSchema,
  paymentUploadSchema,
  reviewSchema,
  type SummaryDto,
} from '../../contracts';
import { db } from '../../db/client';
import { media } from '../../db/schema';
import { and, eq } from 'drizzle-orm';
import { parseFormOrJson, parseJson } from '../../lib/http';
import { ensure } from '../../lib/permissions';
import { ApiError } from '../../lib/problem';
import { hit } from '../../lib/ratelimit';
import { saveImage } from '../../lib/storage';
import {
  createInvoicesBatch,
  createLedgerEntry,
  financeSummary,
  findPayment,
  listInvoices,
  listLedger,
  listPayments,
  reportPayment,
  reviewPayment,
} from './service';

export const financeRoutes = new Hono();

financeRoutes.get('/finance/invoices', async (c) => {
  const auth = c.get('auth');
  ensure(auth, 'invoices.read');

  const isWarga = auth.role === 'warga';
  const houseId = isWarga ? auth.houseId : (c.req.query('houseId') ?? null);

  if (isWarga && !houseId) return c.json({ items: [] });

  const items = await listInvoices({
    communityId: auth.communityId!,
    houseId,
    status: c.req.query('status') || undefined,
    period: c.req.query('period') || undefined,
  });

  return c.json({ items });
});

financeRoutes.post('/finance/invoices/batch', async (c) => {
  const auth = c.get('auth');
  ensure(auth, 'invoices.create');
  const body = await parseJson(c, invoiceBatchSchema);

  const result = await createInvoicesBatch(auth, body);
  return c.json(result, 201);
});

financeRoutes.get('/finance/invoices/:id/payments', async (c) => {
  const auth = c.get('auth');
  ensure(auth, 'invoices.read');

  const invoice = await listInvoices({ communityId: auth.communityId! }).then((items) =>
    items.find((item) => item.id === c.req.param('id')),
  );
  if (!invoice) throw new ApiError(404, 'not_found', 'Tagihan tidak ditemukan');
  if (auth.role === 'warga' && invoice.houseId !== auth.houseId) {
    throw new ApiError(403, 'forbidden', 'Hanya untuk rumah Anda sendiri');
  }

  const items = await listPayments({
    communityId: auth.communityId!,
    invoiceId: invoice.id,
  });

  return c.json({ items });
});

financeRoutes.get('/finance/payments', async (c) => {
  const auth = c.get('auth');
  ensure(auth, 'payments.review');

  const items = await listPayments({
    communityId: auth.communityId!,
    status: c.req.query('status') || undefined,
    houseId: c.req.query('houseId') ?? null,
  });

  return c.json({ items });
});

financeRoutes.post('/finance/invoices/:id/payments', async (c) => {
  const auth = c.get('auth');
  ensure(auth, 'payments.report');

  const invoiceId = c.req.param('id');
  const invoice = await listInvoices({ communityId: auth.communityId! }).then((items) =>
    items.find((item) => item.id === invoiceId),
  );
  if (!invoice) throw new ApiError(404, 'not_found', 'Tagihan tidak ditemukan');
  if (auth.role === 'warga' && invoice.houseId !== auth.houseId) {
    throw new ApiError(403, 'forbidden', 'Hanya untuk rumah Anda sendiri');
  }

  const { data: parsed, file } = await parseFormOrJson(c, paymentUploadSchema);

  hit(`payment:${auth.userId}:day`, 20, 24 * 60 * 60 * 1000);

  let proofMediaId: string | null = null;
  if (file) {
    const saved = await saveImage(auth.communityId!, file);
    const [row] = await db
      .insert(media)
      .values({
        communityId: auth.communityId!,
        ownerId: auth.userId,
        mime: saved.mime,
        bytes: saved.bytes,
        storageKey: saved.storageKey,
      })
      .returning({ id: media.id });
    proofMediaId = row?.id ?? null;
  }

  const payment = await reportPayment(auth, invoiceId, {
    amount: parsed.amount,
    note: parsed.note,
    proofMediaId,
  });

  return c.json(payment, 201);
});

financeRoutes.post('/finance/payments/:id/review', async (c) => {
  const auth = c.get('auth');
  ensure(auth, 'payments.review');
  const body = await parseJson(c, reviewSchema);

  const payment = await reviewPayment(auth, c.req.param('id'), body);
  return c.json(payment);
});

financeRoutes.get('/finance/ledger', async (c) => {
  const auth = c.get('auth');
  ensure(auth, 'ledger.read');

  const items = await listLedger({
    communityId: auth.communityId!,
    from: c.req.query('from') || undefined,
    to: c.req.query('to') || undefined,
    category: c.req.query('category') || undefined,
  });

  return c.json({ items });
});

financeRoutes.post('/finance/ledger', async (c) => {
  const auth = c.get('auth');
  ensure(auth, 'ledger.write');
  const body = await parseJson(c, ledgerCreateSchema);

  const entry = await createLedgerEntry(auth, body);
  return c.json(entry, 201);
});

financeRoutes.get('/finance/summary', async (c) => {
  const auth = c.get('auth');
  ensure(auth, 'ledger.read');

  const now = new Date();
  const from = c.req.query('from') || `${now.toISOString().slice(0, 7)}-01`;
  const to = c.req.query('to') || now.toISOString().slice(0, 10);

  const summary: SummaryDto = await financeSummary({
    communityId: auth.communityId!,
    from,
    to,
  });

  return c.json(summary);
});

financeRoutes.get('/finance/payments/:id', async (c) => {
  const auth = c.get('auth');
  ensure(auth, 'payments.review');
  return c.json(await findPayment(auth.communityId!, c.req.param('id')));
});
