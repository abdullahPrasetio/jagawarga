import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import type { PaymentDto } from '../api/types';
import {
  Button,
  QueryError,
  Card,
  EmptyState,
  ImageProof,
  Modal,
  Rupiah,
  SkeletonRows,
  StatusPill,
  formatDateTime,
} from '../components/ui';

type StatusFilter = 'pending' | 'approved' | 'rejected' | 'all';

export function Pembayaran() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<StatusFilter>('pending');
  const [selected, setSelected] = useState<PaymentDto | null>(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const payments = useQuery({
    queryKey: ['payments', status],
    queryFn: () =>
      api.get<{ items: PaymentDto[] }>('finance/payments', status === 'all' ? {} : { status }),
  });

  const review = useMutation({
    mutationFn: (input: { id: string; action: 'approve' | 'reject'; note?: string }) =>
      api.post<PaymentDto>(`finance/payments/${input.id}/review`, {
        action: input.action,
        note: input.note,
      }),
    onSuccess: () => {
      setSelected(null);
      setNote('');
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ['payments'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      void queryClient.invalidateQueries({ queryKey: ['invoices'] });
      void queryClient.invalidateQueries({ queryKey: ['ledger'] });
    },
    onError: (caught) => setError(caught instanceof Error ? caught.message : 'Gagal menyimpan'),
  });

  return (
    <div className="space-y-4">
      <QueryError error={payments.error} onRetry={() => void payments.refetch()} />

      <div className="flex flex-wrap items-center gap-3">
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value as StatusFilter)}
          className="rounded-xl border border-line bg-surface px-3 py-2 text-sm"
        >
          <option value="pending">Menunggu</option>
          <option value="approved">Disetujui</option>
          <option value="rejected">Ditolak</option>
          <option value="all">Semua</option>
        </select>
        <span className="text-sm text-ink-muted">{payments.data?.items.length ?? 0} baris</span>
      </div>

      {/* Ponsel: kartu */}
      <Card className="p-0 md:hidden">
        {payments.isLoading ? (
          <div className="p-5">
            <SkeletonRows />
          </div>
        ) : (payments.data?.items.length ?? 0) === 0 ? (
          <EmptyState title="Tidak ada pembayaran" caption="Laporan warga akan muncul di sini." />
        ) : (
          <ul className="divide-y divide-line">
            {payments.data?.items.map((payment) => (
              <li key={payment.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium">{payment.houseLabel}</p>
                    <p className="text-xs text-ink-muted">{payment.invoiceTitle}</p>
                    <p className="text-xs text-ink-muted">
                      {payment.reportedByName} · {formatDateTime(payment.reportedAt)}
                    </p>
                  </div>
                  <StatusPill status={payment.status} />
                </div>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <Rupiah value={payment.amount} className="font-semibold" />
                  <Button variant="secondary" onClick={() => setSelected(payment)}>
                    Tinjau
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Layar lebar: tabel */}
      <Card className="hidden p-0 md:block">
        {payments.isLoading ? (
          <div className="p-5">
            <SkeletonRows />
          </div>
        ) : (payments.data?.items.length ?? 0) === 0 ? (
          <EmptyState title="Tidak ada pembayaran" caption="Laporan warga akan muncul di sini." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-[11px] uppercase tracking-wider text-ink-muted">
                  <th className="px-5 py-3 font-semibold">Rumah</th>
                  <th className="px-3 py-3 font-semibold">Tagihan</th>
                  <th className="px-3 py-3 text-right font-semibold">Nominal</th>
                  <th className="px-3 py-3 font-semibold">Bukti</th>
                  <th className="px-3 py-3 font-semibold">Dilaporkan</th>
                  <th className="px-3 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 text-right font-semibold">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {payments.data?.items.map((payment) => (
                  <tr key={payment.id} className="border-b border-line last:border-0 hover:bg-paper">
                    <td className="whitespace-nowrap px-5 py-3 font-medium">{payment.houseLabel}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-ink-muted">
                      {payment.invoiceTitle}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <Rupiah value={payment.amount} />
                    </td>
                    <td className="px-3 py-3">
                      <div className="w-10 overflow-hidden rounded border border-line">
                        <ImageProof mediaId={payment.proofMediaId} height={40} />
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-xs text-ink-muted">
                      {formatDateTime(payment.reportedAt)}
                    </td>
                    <td className="px-3 py-3">
                      <StatusPill status={payment.status} />
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Button variant="secondary" onClick={() => setSelected(payment)}>
                        Tinjau
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        open={selected !== null}
        title="Tinjau pembayaran"
        onClose={() => setSelected(null)}
        width={480}
        footer={
          selected && selected.status === 'pending' ? (
            <>
              <Button
                variant="secondary"
                onClick={() => {
                  setError(null);
                  review.mutate({ id: selected.id, action: 'reject', note });
                }}
                disabled={review.isPending}
              >
                Tolak
              </Button>
              <Button
                onClick={() => {
                  setError(null);
                  review.mutate({ id: selected.id, action: 'approve' });
                }}
                disabled={review.isPending}
              >
                Setujui
              </Button>
            </>
          ) : null
        }
      >
        {selected && (
          <div className="space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-lg font-semibold">{selected.houseLabel}</p>
                <p className="text-sm text-ink-muted">{selected.invoiceTitle}</p>
                <p className="text-sm text-ink-muted">
                  Dilaporkan oleh {selected.reportedByName} · {formatDateTime(selected.reportedAt)}
                </p>
              </div>
              <Rupiah value={selected.amount} className="text-xl font-bold" />
            </div>

            <ImageProof mediaId={selected.proofMediaId} height={320} />

            {selected.note && (
              <p className="rounded-xl bg-paper px-3 py-2 text-sm">Catatan pelapor: {selected.note}</p>
            )}

            {selected.status === 'pending' && (
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                  Catatan verifikasi (wajib bila menolak)
                </span>
                <textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  rows={2}
                  className="mt-1 w-full rounded-xl border border-line px-3 py-2 text-sm outline-none focus:border-brand-600"
                />
              </label>
            )}

            {error && <div className="rounded-xl bg-danger-100 px-3 py-2 text-sm text-danger-700">{error}</div>}
          </div>
        )}
      </Modal>
    </div>
  );
}
