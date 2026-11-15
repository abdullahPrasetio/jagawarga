import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import type { LedgerEntryDto, SummaryDto } from '../api/types';
import {
  Button,
  QueryError,
  Card,
  EmptyState,
  Modal,
  Rupiah,
  SkeletonRows,
  DateField,
  MoneyInput,
  PeriodSelect,
  formatDate,
} from '../components/ui';

const categories = ['iuran', 'donasi', 'keamanan', 'kebersihan', 'perbaikan', 'kegiatan', 'lain-lain'];

export function Kas() {
  const queryClient = useQueryClient();
  const [month, setMonth] = useState(currentMonth());
  const [open, setOpen] = useState(false);
  const [direction, setDirection] = useState<'income' | 'expense'>('expense');
  const [category, setCategory] = useState('keamanan');
  const [amount, setAmount] = useState(0);
  const [date, setDate] = useState(today());
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  const summary = useQuery({
    queryKey: ['summary', month],
    queryFn: () => api.get<SummaryDto>('finance/summary', { from: `${month}-01`, to: endOfMonth(month) }),
  });

  const ledger = useQuery({
    queryKey: ['ledger', month],
    queryFn: () =>
      api.get<{ items: LedgerEntryDto[] }>('finance/ledger', {
        from: `${month}-01`,
        to: endOfMonth(month),
      }),
  });

  const create = useMutation({
    mutationFn: () =>
      api.post<LedgerEntryDto>('finance/ledger', {
        direction,
        category,
        amount,
        occurredOn: date,
        description,
      }),
    onSuccess: () => {
      setOpen(false);
      setDescription('');
      setAmount(0);
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ['summary'] });
      void queryClient.invalidateQueries({ queryKey: ['ledger'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (caught) => setError(caught instanceof Error ? caught.message : 'Gagal menyimpan'),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PeriodSelect value={month} onChange={setMonth} ariaLabel="Bulan kas" />
        <Button className="whitespace-nowrap" onClick={() => setOpen(true)}>Tambah transaksi</Button>
      </div>

      <QueryError error={ledger.error ?? summary.error} onRetry={() => void ledger.refetch()} />

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Card>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">Saldo awal</p>
          <Rupiah value={summary.data?.opening ?? 0} className="text-xl font-semibold" />
        </Card>
        <Card>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">Masuk</p>
          <Rupiah value={summary.data?.income ?? 0} className="text-xl font-semibold text-brand-700" />
        </Card>
        <Card>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">Keluar</p>
          <Rupiah value={summary.data?.expense ?? 0} className="text-xl font-semibold text-danger-700" />
        </Card>
        <Card className="bg-brand-100">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-700">Saldo akhir</p>
          <Rupiah value={summary.data?.closing ?? 0} className="text-xl font-bold text-brand-700" />
        </Card>
      </div>

      {/* Ponsel: kartu */}
      <Card className="p-0 md:hidden">
        {ledger.isLoading ? (
          <div className="p-5">
            <SkeletonRows />
          </div>
        ) : (ledger.data?.items.length ?? 0) === 0 ? (
          <EmptyState title="Belum ada transaksi" caption="Catat pemasukan atau pengeluaran kas warga." />
        ) : (
          <ul className="divide-y divide-line">
            {ledger.data?.items.map((entry) => (
              <li key={entry.id} className="flex items-start justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="font-medium">{entry.description}</p>
                  <p className="text-xs text-ink-muted">
                    {[entry.category, formatDate(entry.occurredOn), entry.source === entry.category ? null : entry.source]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
                <span
                  className={`shrink-0 font-semibold ${
                    entry.direction === 'income' ? 'text-brand-700' : 'text-danger-700'
                  }`}
                >
                  {entry.direction === 'income' ? '+' : '−'} <Rupiah value={entry.amount} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Layar lebar: tabel */}
      <Card className="hidden p-0 md:block">
        {ledger.isLoading ? (
          <div className="p-5">
            <SkeletonRows />
          </div>
        ) : (ledger.data?.items.length ?? 0) === 0 ? (
          <EmptyState title="Belum ada transaksi" caption="Catat pemasukan atau pengeluaran kas warga." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-[11px] uppercase tracking-wider text-ink-muted">
                  <th className="px-5 py-3 font-semibold">Tanggal</th>
                  <th className="px-3 py-3 font-semibold">Keterangan</th>
                  <th className="px-3 py-3 font-semibold">Kategori</th>
                  <th className="px-3 py-3 font-semibold">Sumber</th>
                  <th className="px-5 py-3 text-right font-semibold">Nominal</th>
                </tr>
              </thead>
              <tbody>
                {ledger.data?.items.map((entry) => (
                  <tr key={entry.id} className="border-b border-line last:border-0 hover:bg-paper">
                    <td className="whitespace-nowrap px-5 py-3 text-ink-muted">
                      {formatDate(entry.occurredOn)}
                    </td>
                    <td className="px-3 py-3 font-medium">{entry.description}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-ink-muted">{entry.category}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-xs uppercase tracking-wide text-ink-muted">
                      {entry.source}
                    </td>
                    <td
                      className={`whitespace-nowrap px-5 py-3 text-right font-semibold ${
                        entry.direction === 'income' ? 'text-brand-700' : 'text-danger-700'
                      }`}
                    >
                      {entry.direction === 'income' ? '+' : '−'} <Rupiah value={entry.amount} />
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
        title="Tambah transaksi"
        onClose={() => setOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Batal
            </Button>
            <Button onClick={() => create.mutate()} disabled={create.isPending}>
              Simpan
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="flex gap-2">
            {(['income', 'expense'] as const).map((value) => (
              <button
                key={value}
                onClick={() => setDirection(value)}
                className={`flex-1 rounded-xl border px-3 py-2 text-sm font-semibold ${
                  direction === value
                    ? 'border-brand-600 bg-brand-100 text-brand-700'
                    : 'border-line text-ink-muted'
                }`}
              >
                {value === 'income' ? 'Pemasukan' : 'Pengeluaran'}
              </button>
            ))}
          </div>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-muted">Kategori</span>
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className="w-full rounded-xl border border-line px-3 py-2 text-sm"
            >
              {categories.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-muted">Nominal</span>
            <MoneyInput value={amount} onChange={setAmount} ariaLabel="Nominal transaksi" />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-muted">Tanggal</span>
            <DateField value={date} onChange={setDate} ariaLabel="Tanggal transaksi" />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-muted">Keterangan</span>
            <input
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="w-full rounded-xl border border-line px-3 py-2 text-sm"
              placeholder="Beli lampu portal"
            />
          </label>

          {error && <div className="rounded-xl bg-danger-100 px-3 py-2 text-sm text-danger-700">{error}</div>}
        </div>
      </Modal>
    </div>
  );
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function currentMonth(): string {
  return today().slice(0, 7);
}

export function endOfMonth(month: string): string {
  const [year, rawMonth] = month.split('-').map(Number);
  const date = new Date(year ?? 2026, rawMonth ?? 1, 0);
  return date.toISOString().slice(0, 10);
}
