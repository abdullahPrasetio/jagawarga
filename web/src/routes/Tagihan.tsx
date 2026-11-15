import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import type { HouseDto, InvoiceDto } from '../api/types';
import {
  Button,
  QueryError,
  Card,
  EmptyState,
  Modal,
  Rupiah,
  SkeletonRows,
  StatusPill,
  DateField,
  MoneyInput,
  PeriodSelect,
  formatDate,
  periodLabel,
} from '../components/ui';

export function Tagihan() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<string>('all');
  const [period, setPeriod] = useState(nextPeriod());
  const [amount, setAmount] = useState(150_000);
  const [dueDate, setDueDate] = useState(`${nextPeriod()}-10`);
  const [title, setTitle] = useState(`Iuran ${monthName(nextPeriod())}`);
  const [selectedHouses, setSelectedHouses] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const invoices = useQuery({
    queryKey: ['invoices', filter],
    queryFn: () =>
      api.get<{ items: InvoiceDto[] }>(
        'finance/invoices',
        filter === 'all' ? {} : { period: filter },
      ),
  });

  const houses = useQuery({
    queryKey: ['houses'],
    queryFn: () => api.get<{ items: HouseDto[] }>('houses'),
  });

  const batch = useMutation({
    mutationFn: () =>
      api.post<{ created: number; skipped: number }>('finance/invoices/batch', {
        period,
        title,
        amount,
        dueDate,
        ...(selectedHouses ? { houseIds: selectedHouses } : {}),
      }),
    onSuccess: (result) => {
      setOpen(false);
      setError(null);
      setMessage(
        `${result.created} tagihan periode ${periodLabel(period)} dibuat, ${result.skipped} dilewati (sudah ada).`,
      );
      setFilter('all');
      void queryClient.invalidateQueries({ queryKey: ['invoices'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (caught) => setError(caught instanceof Error ? caught.message : 'Gagal membuat tagihan'),
  });

  const items = invoices.data?.items ?? [];
  const published = items.length;
  const collected = items.reduce((total, item) => total + item.paidAmount, 0);
  const remaining = items.reduce((total, item) => total + (item.amount - item.paidAmount), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <PeriodSelect value={filter} onChange={setFilter} includeAll ariaLabel="Filter periode" />
          <span className="text-sm text-ink-muted">
            {published} tagihan
            {filter === 'all' ? ' (semua periode)' : ` · ${periodLabel(filter)}`}
          </span>
        </div>
        <Button className="whitespace-nowrap" onClick={() => setOpen(true)}>Buat tagihan massal</Button>
      </div>

      <QueryError error={invoices.error} onRetry={() => void invoices.refetch()} />

      {message && (
        <div className="rounded-xl bg-brand-100 px-4 py-3 text-sm text-brand-700">{message}</div>
      )}

      <Card className="flex flex-wrap gap-x-8 gap-y-4">
        <Summary label="Diterbitkan" value={items.reduce((total, item) => total + item.amount, 0)} />
        <Summary label="Terkumpul" value={collected} />
        <Summary label="Sisa" value={remaining} />
      </Card>

      {/* Ponsel: kartu ringkas */}
      <Card className="p-0 md:hidden">
        {invoices.isLoading ? (
          <div className="p-5">
            <SkeletonRows />
          </div>
        ) : items.length === 0 ? (
          <EmptyState title="Belum ada tagihan" caption="Buat tagihan massal untuk periode ini." />
        ) : (
          <ul className="divide-y divide-line">
            {items.map((invoice) => (
              <li key={invoice.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium leading-tight">{invoice.houseLabel}</p>
                    <p className="text-xs text-ink-muted">
                      {periodLabel(invoice.period)} · jatuh {formatDate(invoice.dueDate)}
                    </p>
                  </div>
                  <StatusPill status={invoice.status} />
                </div>
                <div className="mt-2 flex items-baseline justify-between gap-3">
                  <Rupiah value={invoice.amount} className="font-semibold" />
                  <span className="text-xs text-ink-muted">
                    Dibayar <Rupiah value={invoice.paidAmount} />
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Layar lebar: tabel */}
      <Card className="hidden p-0 md:block">
        {invoices.isLoading ? (
          <div className="p-5">
            <SkeletonRows />
          </div>
        ) : items.length === 0 ? (
          <EmptyState title="Belum ada tagihan" caption="Buat tagihan massal untuk periode ini." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-[11px] uppercase tracking-wider text-ink-muted">
                  <th className="px-5 py-3 font-semibold">Rumah</th>
                  <th className="px-3 py-3 font-semibold">Periode</th>
                  <th className="px-3 py-3 font-semibold">Judul</th>
                  <th className="px-3 py-3 font-semibold">Jatuh tempo</th>
                  <th className="px-3 py-3 text-right font-semibold">Nominal</th>
                  <th className="px-3 py-3 text-right font-semibold">Dibayar</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {items.map((invoice) => (
                  <tr key={invoice.id} className="border-b border-line last:border-0 hover:bg-paper">
                    <td className="whitespace-nowrap px-5 py-3 font-medium">{invoice.houseLabel}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-ink-muted">
                      {periodLabel(invoice.period)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-ink-muted">{invoice.title}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-ink-muted">
                      {formatDate(invoice.dueDate)}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <Rupiah value={invoice.amount} />
                    </td>
                    <td className="px-3 py-3 text-right text-ink-muted">
                      <Rupiah value={invoice.paidAmount} />
                    </td>
                    <td className="px-5 py-3">
                      <StatusPill status={invoice.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        open={open}
        title="Buat tagihan massal"
        onClose={() => setOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Batal
            </Button>
            <Button onClick={() => batch.mutate()} disabled={batch.isPending}>
              {batch.isPending ? 'Menyimpan…' : 'Terbitkan'}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Periode">
            <PeriodSelect
              value={period}
              className="w-full"
              ariaLabel="Periode tagihan"
              onChange={(value) => {
                setPeriod(value);
                setDueDate(`${value}-10`);
                setTitle(`Iuran ${monthName(value)}`);
              }}
            />
          </Field>
          <Field label="Judul">
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="w-full rounded-xl border border-line px-3 py-2 text-sm"
            />
          </Field>
          <Field label="Nominal">
            <MoneyInput value={amount} onChange={setAmount} ariaLabel="Nominal tagihan" />
          </Field>
          <Field label="Jatuh tempo">
            <DateField value={dueDate} onChange={setDueDate} ariaLabel="Jatuh tempo" />
          </Field>

          <Field label="Rumah">
            <div className="space-y-2 rounded-xl border border-line p-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="houses"
                  checked={selectedHouses === null}
                  onChange={() => setSelectedHouses(null)}
                />
                Semua rumah berpenghuni
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="houses"
                  checked={selectedHouses !== null}
                  onChange={() => setSelectedHouses([])}
                />
                Pilih manual
              </label>

              {selectedHouses !== null && (
                <div className="grid max-h-40 grid-cols-2 gap-1 overflow-y-auto pt-2 sm:grid-cols-3">
                  {houses.data?.items.map((house) => (
                    <label key={house.id} className="flex items-center gap-1 text-xs">
                      <input
                        type="checkbox"
                        checked={selectedHouses.includes(house.id)}
                        onChange={(event) =>
                          setSelectedHouses((current) =>
                            event.target.checked
                              ? [...(current ?? []), house.id]
                              : (current ?? []).filter((id) => id !== house.id),
                          )
                        }
                      />
                      {house.label}
                    </label>
                  ))}
                </div>
              )}
            </div>
          </Field>

          {error && <div className="rounded-xl bg-danger-100 px-3 py-2 text-sm text-danger-700">{error}</div>}
        </div>
      </Modal>
    </div>
  );
}

function Summary({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">{label}</p>
      <Rupiah value={value} className="text-xl font-semibold" />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-muted">{label}</span>
      {children}
    </label>
  );
}

export function nextPeriod(): string {
  const date = new Date();
  date.setDate(1);
  date.setMonth(date.getMonth() + 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function monthName(period: string): string {
  const [year, month] = period.split('-').map(Number);
  if (!year || !month) return period;
  return new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(
    new Date(year, month - 1, 1),
  );
}
