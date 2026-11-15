import { and, desc, eq, gte, lte, sql } from 'drizzle-orm';
import type { InvoiceDto, LedgerEntryDto, PaymentDto, SummaryDto } from '../../contracts';
import { db, type Tx } from '../../db/client';
import { houses, invoices, ledgerEntries, payments, users } from '../../db/schema';
import type { Auth } from '../../lib/jwt';
import { ApiError } from '../../lib/problem';

export type InvoiceRow = {
  id: string;
  houseId: string;
  houseLabel: string;
  period: string;
  title: string;
  amount: number;
  paidAmount: number;
  dueDate: string;
  status: string;
};

export async function listInvoices(input: {
  communityId: string;
  houseId?: string | null;
  status?: string;
  period?: string;
  limit?: number;
}): Promise<InvoiceDto[]> {
  const conditions = [eq(invoices.communityId, input.communityId)];
  if (input.houseId) conditions.push(eq(invoices.houseId, input.houseId));
  if (input.status) conditions.push(eq(invoices.status, input.status));
  if (input.period) conditions.push(eq(invoices.period, input.period));

  const rows = await db
    .select({
      id: invoices.id,
      houseId: invoices.houseId,
      houseLabel: houses.label,
      period: invoices.period,
      title: invoices.title,
      amount: invoices.amount,
      paidAmount: sql<number>`coalesce((
        select sum(p.amount)::int from payments p
        where p.invoice_id = ${invoices.id} and p.status = 'approved'
      ), 0)`,
      dueDate: invoices.dueDate,
      status: invoices.status,
    })
    .from(invoices)
    .innerJoin(houses, eq(houses.id, invoices.houseId))
    .where(and(...conditions))
    .orderBy(desc(invoices.period), houses.block, houses.number)
    .limit(input.limit ?? 300);

  return rows as InvoiceDto[];
}

export async function createInvoicesBatch(
  auth: Auth,
  input: { period: string; title: string; amount: number; dueDate: string; houseIds?: string[] },
): Promise<{ created: number; skipped: number }> {
  const communityId = auth.communityId!;

  const targets = input.houseIds?.length
    ? input.houseIds
    : (
        await db
          .select({ id: houses.id })
          .from(houses)
          .where(and(eq(houses.communityId, communityId), eq(houses.isOccupied, true)))
      ).map((row) => row.id);

  if (targets.length === 0) return { created: 0, skipped: 0 };

  const values = targets.map((houseId) => ({
    communityId,
    houseId,
    period: input.period,
    title: input.title,
    amount: input.amount,
    dueDate: input.dueDate,
  }));

  const inserted = await db
    .insert(invoices)
    .values(values)
    .onConflictDoNothing({ target: [invoices.communityId, invoices.houseId, invoices.period] })
    .returning({ id: invoices.id });

  return { created: inserted.length, skipped: values.length - inserted.length };
}

export async function listPayments(input: {
  communityId: string;
  status?: string;
  houseId?: string | null;
  invoiceId?: string;
  limit?: number;
}): Promise<PaymentDto[]> {
  const conditions = [eq(payments.communityId, input.communityId)];
  if (input.status) conditions.push(eq(payments.status, input.status));
  if (input.invoiceId) conditions.push(eq(payments.invoiceId, input.invoiceId));
  if (input.houseId) conditions.push(eq(invoices.houseId, input.houseId));

  const rows = await db
    .select({
      id: payments.id,
      invoiceId: payments.invoiceId,
      houseLabel: houses.label,
      invoiceTitle: invoices.title,
      amount: payments.amount,
      status: payments.status,
      note: payments.note,
      proofMediaId: payments.proofMediaId,
      reportedByName: users.name,
      reportedAt: payments.createdAt,
      reviewedAt: payments.reviewedAt,
    })
    .from(payments)
    .innerJoin(invoices, eq(invoices.id, payments.invoiceId))
    .innerJoin(houses, eq(houses.id, invoices.houseId))
    .innerJoin(users, eq(users.id, payments.reportedBy))
    .where(and(...conditions))
    .orderBy(desc(payments.createdAt))
    .limit(input.limit ?? 200);

  return rows.map((row) => ({
    id: row.id,
    invoiceId: row.invoiceId,
    houseLabel: row.houseLabel,
    invoiceTitle: row.invoiceTitle,
    amount: row.amount,
    status: row.status as PaymentDto['status'],
    note: row.note,
    proofMediaId: row.proofMediaId,
    reportedByName: row.reportedByName,
    reportedAt: row.reportedAt.toISOString(),
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
  }));
}

export async function findPayment(communityId: string, paymentId: string): Promise<PaymentDto> {
  const [row] = await db
    .select({
      id: payments.id,
      invoiceId: payments.invoiceId,
      houseLabel: houses.label,
      invoiceTitle: invoices.title,
      amount: payments.amount,
      status: payments.status,
      note: payments.note,
      proofMediaId: payments.proofMediaId,
      reportedByName: users.name,
      reportedAt: payments.createdAt,
      reviewedAt: payments.reviewedAt,
    })
    .from(payments)
    .innerJoin(invoices, eq(invoices.id, payments.invoiceId))
    .innerJoin(houses, eq(houses.id, invoices.houseId))
    .innerJoin(users, eq(users.id, payments.reportedBy))
    .where(and(eq(payments.id, paymentId), eq(payments.communityId, communityId)))
    .limit(1);

  if (!row) throw new ApiError(404, 'not_found', 'Pembayaran tidak ditemukan');

  return {
    id: row.id,
    invoiceId: row.invoiceId,
    houseLabel: row.houseLabel,
    invoiceTitle: row.invoiceTitle,
    amount: row.amount,
    status: row.status as PaymentDto['status'],
    note: row.note,
    proofMediaId: row.proofMediaId,
    reportedByName: row.reportedByName,
    reportedAt: row.reportedAt.toISOString(),
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
  };
}

export async function reportPayment(
  auth: Auth,
  invoiceId: string,
  input: { amount: number; note?: string; proofMediaId?: string | null },
): Promise<PaymentDto> {
  const communityId = auth.communityId!;

  const [invoice] = await db
    .select()
    .from(invoices)
    .where(and(eq(invoices.id, invoiceId), eq(invoices.communityId, communityId)))
    .limit(1);

  if (!invoice) throw new ApiError(404, 'not_found', 'Tagihan tidak ditemukan');
  if (invoice.status === 'paid') throw new ApiError(409, 'conflict', 'Tagihan ini sudah lunas');

  const [created] = await db
    .insert(payments)
    .values({
      communityId,
      invoiceId,
      reportedBy: auth.userId,
      amount: input.amount,
      proofMediaId: input.proofMediaId ?? null,
      note: input.note ?? null,
      status: 'pending',
    })
    .returning({ id: payments.id });

  if (!created) throw new ApiError(500, 'internal_error', 'Gagal menyimpan laporan pembayaran');

  return findPayment(communityId, created.id);
}

async function recomputeInvoiceStatus(tx: Tx, invoiceId: string) {
  const [invoice] = await tx
    .select({ amount: invoices.amount })
    .from(invoices)
    .where(eq(invoices.id, invoiceId))
    .limit(1);

  if (!invoice) return;

  const [totals] = await tx
    .select({ paid: sql<number>`coalesce(sum(${payments.amount}), 0)::int` })
    .from(payments)
    .where(and(eq(payments.invoiceId, invoiceId), eq(payments.status, 'approved')));

  const paid = totals?.paid ?? 0;
  const status = paid >= invoice.amount ? 'paid' : paid > 0 ? 'partial' : 'unpaid';

  await tx.update(invoices).set({ status }).where(eq(invoices.id, invoiceId));
}

export async function reviewPayment(
  auth: Auth,
  paymentId: string,
  input: { action: 'approve' | 'reject'; note?: string },
): Promise<PaymentDto> {
  const communityId = auth.communityId!;

  if (input.action === 'reject' && !input.note) {
    throw new ApiError(400, 'validation_failed', 'Catatan wajib diisi saat menolak pembayaran');
  }

  await db.transaction(async (tx) => {
    const locked = (await tx.execute(
      sql`select id, invoice_id, amount, status from payments
          where id = ${paymentId} and community_id = ${communityId} for update`,
    )) as unknown as Array<{ id: string; invoice_id: string; amount: number; status: string }>;

    const payment = locked[0];
    if (!payment) throw new ApiError(404, 'not_found', 'Pembayaran tidak ditemukan');
    if (payment.status !== 'pending') {
      throw new ApiError(409, 'conflict', 'Pembayaran ini sudah direview');
    }

    await tx
      .update(payments)
      .set({
        status: input.action === 'approve' ? 'approved' : 'rejected',
        note: input.note ?? null,
        reviewedBy: auth.userId,
        reviewedAt: new Date(),
      })
      .where(eq(payments.id, paymentId));

    if (input.action === 'approve') {
      const [invoice] = await tx
        .select({ title: invoices.title, houseId: invoices.houseId })
        .from(invoices)
        .where(eq(invoices.id, payment.invoice_id))
        .limit(1);

      const [house] = invoice
        ? await tx
            .select({ label: houses.label })
            .from(houses)
            .where(eq(houses.id, invoice.houseId))
            .limit(1)
        : [];

      await tx.insert(ledgerEntries).values({
        communityId,
        direction: 'income',
        category: 'iuran',
        amount: payment.amount,
        occurredOn: new Date().toISOString().slice(0, 10),
        description: `${invoice?.title ?? 'Iuran'} — ${house?.label ?? 'tanpa unit'}`,
        sourcePaymentId: paymentId,
        createdBy: auth.userId,
      });
    }

    await recomputeInvoiceStatus(tx, payment.invoice_id);
  });

  return findPayment(communityId, paymentId);
}

export async function createLedgerEntry(
  auth: Auth,
  input: {
    direction: 'income' | 'expense';
    category: string;
    amount: number;
    occurredOn: string;
    description: string;
    attachmentMediaId?: string | null;
  },
): Promise<LedgerEntryDto> {
  const communityId = auth.communityId!;

  const [created] = await db
    .insert(ledgerEntries)
    .values({
      communityId,
      direction: input.direction,
      category: input.category,
      amount: input.amount,
      occurredOn: input.occurredOn,
      description: input.description,
      attachmentMediaId: input.attachmentMediaId ?? null,
      createdBy: auth.userId,
    })
    .returning();

  if (!created) throw new ApiError(500, 'internal_error', 'Gagal menyimpan transaksi');

  return {
    id: created.id,
    direction: created.direction as 'income' | 'expense',
    category: created.category,
    amount: created.amount,
    occurredOn: String(created.occurredOn),
    description: created.description,
    attachmentMediaId: created.attachmentMediaId,
    source: 'manual',
    createdByName: '',
    createdAt: created.createdAt.toISOString(),
  };
}

export async function listLedger(input: {
  communityId: string;
  from?: string;
  to?: string;
  category?: string;
  limit?: number;
}): Promise<LedgerEntryDto[]> {
  const conditions = [eq(ledgerEntries.communityId, input.communityId)];
  if (input.from) conditions.push(gte(ledgerEntries.occurredOn, input.from));
  if (input.to) conditions.push(lte(ledgerEntries.occurredOn, input.to));
  if (input.category) conditions.push(eq(ledgerEntries.category, input.category));

  const rows = await db
    .select({
      id: ledgerEntries.id,
      direction: ledgerEntries.direction,
      category: ledgerEntries.category,
      amount: ledgerEntries.amount,
      occurredOn: ledgerEntries.occurredOn,
      description: ledgerEntries.description,
      attachmentMediaId: ledgerEntries.attachmentMediaId,
      sourcePaymentId: ledgerEntries.sourcePaymentId,
      sourceDonationId: ledgerEntries.sourceDonationId,
      createdByName: users.name,
      createdAt: ledgerEntries.createdAt,
    })
    .from(ledgerEntries)
    .innerJoin(users, eq(users.id, ledgerEntries.createdBy))
    .where(and(...conditions))
    .orderBy(desc(ledgerEntries.occurredOn), desc(ledgerEntries.createdAt))
    .limit(input.limit ?? 200);

  return rows.map((row) => ({
    id: row.id,
    direction: row.direction as 'income' | 'expense',
    category: row.category,
    amount: row.amount,
    occurredOn: String(row.occurredOn),
    description: row.description,
    attachmentMediaId: row.attachmentMediaId,
    source: row.sourcePaymentId ? 'iuran' : row.sourceDonationId ? 'donasi' : 'manual',
    createdByName: row.createdByName,
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function financeSummary(input: {
  communityId: string;
  from: string;
  to: string;
}): Promise<SummaryDto> {
  const [opening] = await db
    .select({
      total: sql<number>`coalesce(sum(case when ${ledgerEntries.direction} = 'income' then ${ledgerEntries.amount} else -${ledgerEntries.amount} end), 0)::int`,
    })
    .from(ledgerEntries)
    .where(and(eq(ledgerEntries.communityId, input.communityId), sql`${ledgerEntries.occurredOn} < ${input.from}`));

  const [income] = await db
    .select({ total: sql<number>`coalesce(sum(${ledgerEntries.amount}), 0)::int` })
    .from(ledgerEntries)
    .where(
      and(
        eq(ledgerEntries.communityId, input.communityId),
        eq(ledgerEntries.direction, 'income'),
        gte(ledgerEntries.occurredOn, input.from),
        lte(ledgerEntries.occurredOn, input.to),
      ),
    );

  const [expense] = await db
    .select({ total: sql<number>`coalesce(sum(${ledgerEntries.amount}), 0)::int` })
    .from(ledgerEntries)
    .where(
      and(
        eq(ledgerEntries.communityId, input.communityId),
        eq(ledgerEntries.direction, 'expense'),
        gte(ledgerEntries.occurredOn, input.from),
        lte(ledgerEntries.occurredOn, input.to),
      ),
    );

  const byCategory = await db
    .select({
      category: ledgerEntries.category,
      direction: ledgerEntries.direction,
      total: sql<number>`coalesce(sum(${ledgerEntries.amount}), 0)::int`,
    })
    .from(ledgerEntries)
    .where(
      and(
        eq(ledgerEntries.communityId, input.communityId),
        gte(ledgerEntries.occurredOn, input.from),
        lte(ledgerEntries.occurredOn, input.to),
      ),
    )
    .groupBy(ledgerEntries.category, ledgerEntries.direction)
    .orderBy(desc(sql`coalesce(sum(${ledgerEntries.amount}), 0)`));

  const openingTotal = opening?.total ?? 0;
  const incomeTotal = income?.total ?? 0;
  const expenseTotal = expense?.total ?? 0;

  return {
    from: input.from,
    to: input.to,
    opening: openingTotal,
    income: incomeTotal,
    expense: expenseTotal,
    closing: openingTotal + incomeTotal - expenseTotal,
    byCategory: byCategory.map((row) => ({
      category: row.category,
      direction: row.direction as 'income' | 'expense',
      total: row.total,
    })),
  };
}
