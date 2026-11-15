import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import type { AlertDto, AnnouncementDto, InvoiceDto, Paginated, PaymentDto, SummaryDto } from '../api/types';
import {
  Card,
  EmptyState,
  Rupiah,
  SectionTitle,
  SkeletonRows,
  QueryError,
  StatusPill,
  formatDateTime,
  periodLabel,
} from '../components/ui';
import { useAuth } from '../stores/auth';

export function Dashboard() {
  const auth = useAuth();

  const community = useQuery({
    queryKey: ['community'],
    queryFn: () =>
      api.get<{ id: string; name: string; memberCount: number; houseCount: number }>('community'),
  });

  const summary = useQuery({
    queryKey: ['dashboard', 'summary'],
    queryFn: () => api.get<SummaryDto>('finance/summary'),
  });

  const invoices = useQuery({
    queryKey: ['dashboard', 'invoices'],
    queryFn: () => api.get<{ items: InvoiceDto[] }>('finance/invoices'),
  });

  const payments = useQuery({
    queryKey: ['dashboard', 'payments'],
    queryFn: () => api.get<{ items: PaymentDto[] }>('finance/payments', { status: 'pending' }),
    enabled: ['admin', 'pengurus', 'bendahara'].includes(auth.membership?.role ?? ''),
  });

  const alerts = useQuery({
    queryKey: ['alerts', 'active'],
    queryFn: () => api.get<{ items: AlertDto[] }>('alerts/active'),
    refetchInterval: 20_000,
  });

  const announcements = useQuery({
    queryKey: ['announcements', 'latest'],
    queryFn: () => api.get<Paginated<AnnouncementDto>>('announcements', { limit: 5 }),
  });

  const unpaid = (invoices.data?.items ?? []).filter((item) => item.status !== 'paid');
  const unpaidTotal = unpaid.reduce((total, item) => total + (item.amount - item.paidAmount), 0);
  const unpaidPeriods = Array.from(new Set(unpaid.map((item) => item.period))).sort().reverse();

  return (
    <div className="space-y-6">
      <QueryError error={summary.error ?? invoices.error} onRetry={() => void summary.refetch()} />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <MetricCard
          label="Saldo kas"
          value={<Rupiah value={summary.data?.closing ?? 0} className="text-xl font-bold sm:text-2xl" />}
          caption={`Masuk ${formatShort(summary.data?.income ?? 0)} · Keluar ${formatShort(summary.data?.expense ?? 0)}`}
        />
        <MetricCard
          label="Tagihan belum lunas"
          value={<Rupiah value={unpaidTotal} className="text-xl font-bold sm:text-2xl" />}
          caption={`${unpaid.length} tagihan · ${unpaidPeriods.map(periodLabel).join(' + ') || '-'}`}
        />
        <MetricCard
          label="Menunggu verifikasi"
          value={<span className="text-xl font-bold sm:text-2xl">{payments.data?.items.length ?? 0}</span>}
          caption="pembayaran"
        />
        <MetricCard
          label="Alert 24 jam"
          value={
            <span className={`text-xl font-bold sm:text-2xl ${(alerts.data?.items.length ?? 0) > 0 ? 'text-danger-600' : ''}`}>
              {alerts.data?.items.length ?? 0}
            </span>
          }
          caption={`${community.data?.memberCount ?? 0} anggota aktif`}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[3fr_2fr]">
        <Card>
          <SectionTitle>Pembayaran terbaru</SectionTitle>
          {(payments.data?.items.length ?? 0) === 0 ? (
            <EmptyState title="Tidak ada pembayaran menunggu" caption="Semua laporan sudah diverifikasi." />
          ) : (
            <ul className="divide-y divide-line">
              {payments.data?.items.slice(0, 6).map((payment) => (
                <li
                  key={payment.id}
                  className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2"
                >
                  <span className="font-medium">{payment.houseLabel}</span>
                  <span className="hidden min-w-0 flex-1 truncate text-ink-muted sm:block">
                    {payment.invoiceTitle}
                  </span>
                  <Rupiah value={payment.amount} />
                  <span className="w-full text-xs text-ink-muted sm:w-32 sm:text-right">
                    {formatDateTime(payment.reportedAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <SectionTitle>Alert aktif</SectionTitle>
          {(alerts.data?.items.length ?? 0) === 0 ? (
            <EmptyState title="Tidak ada alert aktif" caption="Sinyal darurat akan muncul di sini secara langsung." />
          ) : (
            <ul className="space-y-2">
              {alerts.data?.items.map((alert) => (
                <li key={alert.id} className="rounded-xl bg-danger-100 px-3 py-2">
                  <p className="text-sm font-semibold text-danger-700">
                    {alert.houseLabel ?? 'Tanpa unit'}
                  </p>
                  <p className="text-xs text-danger-700">
                    {alert.triggeredByName} · {formatDateTime(alert.createdAt)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card>
        <SectionTitle>Pengumuman terbaru</SectionTitle>
        {announcements.isLoading ? (
          <SkeletonRows rows={3} />
        ) : (announcements.data?.items.length ?? 0) === 0 ? (
          <EmptyState title="Belum ada pengumuman" caption="Terbitkan pengumuman pertama dari menu Pengumuman." />
        ) : (
          <ul className="divide-y divide-line">
            {announcements.data?.items.map((item) => (
              <li key={item.id} className="flex items-center justify-between py-2">
                <div>
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="text-xs text-ink-muted">
                    {item.category} · {formatDateTime(item.publishedAt ?? item.createdAt)}
                  </p>
                </div>
                <StatusPill status={item.publishedAt ? 'open' : 'pending'} />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function MetricCard({
  label,
  value,
  caption,
}: {
  label: string;
  value: React.ReactNode;
  caption: string;
}) {
  return (
    <Card className="flex min-w-0 flex-col gap-1">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">{label}</span>
      {value}
      <span className="text-xs text-ink-muted">{caption}</span>
    </Card>
  );
}

function formatShort(value: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  })
    .format(value)
    .replace(/\u00a0/g, ' ');
}
