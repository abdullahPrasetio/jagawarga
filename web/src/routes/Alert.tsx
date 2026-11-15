import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import type { AlertDto, Paginated } from '../api/types';
import { Button, Card, EmptyState, Modal, QueryError, StatusPill, formatDateTime } from '../components/ui';

export function Alert() {
  const queryClient = useQueryClient();
  const [resolving, setResolving] = useState<AlertDto | null>(null);
  const [resolution, setResolution] = useState<'handled' | 'false_alarm'>('handled');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const active = useQuery({
    queryKey: ['alerts', 'active'],
    queryFn: () => api.get<{ items: AlertDto[] }>('alerts/active'),
    refetchInterval: 10_000,
  });

  const history = useQuery({
    queryKey: ['alerts', 'history'],
    queryFn: () => api.get<Paginated<AlertDto>>('alerts', { limit: 30 }),
  });

  const acknowledge = useMutation({
    mutationFn: (id: string) => api.post<AlertDto>(`alerts/${id}/acknowledge`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['alerts'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (caught) => setError(caught instanceof Error ? caught.message : 'Gagal'),
  });

  const resolve = useMutation({
    mutationFn: (input: { id: string; resolution: string; note?: string }) =>
      api.post<AlertDto>(`alerts/${input.id}/resolve`, {
        resolution: input.resolution,
        note: input.note,
      }),
    onSuccess: () => {
      setResolving(null);
      setNote('');
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ['alerts'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (caught) => setError(caught instanceof Error ? caught.message : 'Gagal'),
  });

  return (
    <div className="space-y-4">
      <QueryError error={active.error ?? history.error} onRetry={() => void active.refetch()} />
      {error && <div className="rounded-xl bg-danger-100 px-4 py-3 text-sm text-danger-700">{error}</div>}

      {(active.data?.items.length ?? 0) === 0 ? (
        <Card>
          <EmptyState title="Tidak ada alert aktif" caption="Sinyal darurat warga akan muncul di sini secara langsung." />
        </Card>
      ) : (
        <div className="space-y-3">
          {active.data?.items.map((alert) => (
            <Card key={alert.id} className="border-danger-100 bg-danger-100/60">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-lg font-bold text-danger-700">{alert.houseLabel ?? 'Tanpa unit'}</p>
                  <p className="text-sm text-danger-700">
                    {alert.triggeredByName} · {formatDateTime(alert.createdAt)}
                  </p>
                  {alert.message && <p className="mt-1 text-sm">“{alert.message}”</p>}
                </div>
                <StatusPill status={alert.status} />
              </div>

              <div className="mt-4 flex gap-2">
                {alert.status === 'active' && (
                  <Button onClick={() => acknowledge.mutate(alert.id)} disabled={acknowledge.isPending}>
                    Saya merespons
                  </Button>
                )}
                <Button
                  variant="secondary"
                  onClick={() => {
                    setResolving(alert);
                    setResolution('handled');
                  }}
                >
                  Selesaikan
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Card className="p-0">
        <div className="border-b border-line px-5 py-3">
          <h2 className="text-sm font-semibold">Riwayat alert</h2>
        </div>
        {(history.data?.items.length ?? 0) === 0 ? (
          <EmptyState title="Belum ada riwayat" caption="Alert yang selesai akan tercatat di sini." />
        ) : (
          <>
            <div className="hidden grid-cols-5 gap-x-4 border-b border-line px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-ink-muted sm:grid">
              <span>Waktu</span>
              <span>Rumah</span>
              <span>Pemicu</span>
              <span>Respons pertama</span>
              <span>Status</span>
            </div>
            <ul className="divide-y divide-line">
              {history.data?.items.map((alert) => (
                <li
                  key={alert.id}
                  className="grid grid-cols-2 gap-x-4 gap-y-1 px-5 py-3 text-sm hover:bg-paper sm:grid-cols-5 sm:items-center"
                >
                  <span className="text-ink-muted">{formatDateTime(alert.createdAt)}</span>
                  <span className="font-medium">{alert.houseLabel ?? '-'}</span>
                  <span className="text-ink-muted">{alert.triggeredByName}</span>
                  <span className="text-ink-muted">{alert.acknowledgedByName ?? '—'}</span>
                  <span>
                    <StatusPill status={alert.status} />
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>

      <Modal
        open={resolving !== null}
        title="Selesaikan alert"
        onClose={() => setResolving(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setResolving(null)}>
              Batal
            </Button>
            <Button
              onClick={() =>
                resolving &&
                resolve.mutate({ id: resolving.id, resolution, note: note || undefined })
              }
              disabled={resolve.isPending}
            >
              Simpan
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="flex gap-2">
            {(
              [
                { value: 'handled', label: 'Ditangani' },
                { value: 'false_alarm', label: 'False alarm' },
              ] as const
            ).map((option) => (
              <button
                key={option.value}
                onClick={() => setResolution(option.value)}
                className={`flex-1 rounded-xl border px-3 py-2 text-sm font-semibold ${
                  resolution === option.value
                    ? 'border-brand-600 bg-brand-100 text-brand-700'
                    : 'border-line text-ink-muted'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-muted">
              Catatan (opsional)
            </span>
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={2}
              className="w-full rounded-xl border border-line px-3 py-2 text-sm"
            />
          </label>
        </div>
      </Modal>
    </div>
  );
}
