import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import type { CommunityAdminDto, StatsDto } from '../api/types';
import { Button, Card, EmptyState, Modal, QueryError, SkeletonRows, formatDate } from '../components/ui';
import { useAuth } from '../stores/auth';

export function Platform() {
  const auth = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [address, setAddress] = useState('');
  const [invite, setInvite] = useState<{ code: string; community: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const stats = useQuery({ queryKey: ['platform', 'stats'], queryFn: () => api.get<StatsDto>('admin/stats') });

  const communities = useQuery({
    queryKey: ['platform', 'communities'],
    queryFn: () => api.get<{ items: CommunityAdminDto[] }>('admin/communities'),
  });

  const create = useMutation({
    mutationFn: () =>
      api.post<{ community: CommunityAdminDto; inviteCode: string }>('admin/communities', {
        name,
        slug,
        address: address || undefined,
      }),
    onSuccess: (result) => {
      setOpen(false);
      setInvite({ code: result.inviteCode, community: result.community.name });
      setName('');
      setSlug('');
      setAddress('');
      void queryClient.invalidateQueries({ queryKey: ['platform'] });
    },
    onError: (caught) => setError(caught instanceof Error ? caught.message : 'Gagal membuat komunitas'),
  });

  const toggle = useMutation({
    mutationFn: (community: CommunityAdminDto) =>
      api.patch<CommunityAdminDto>(`admin/communities/${community.id}`, {
        isActive: !community.isActive,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['platform'] });
      setBusyId(null);
    },
    onError: (caught) => {
      setError(caught instanceof Error ? caught.message : 'Gagal mengubah status');
      setBusyId(null);
    },
  });

  const join = useMutation({
    mutationFn: async (community: CommunityAdminDto) => {
      await api.post(`admin/communities/${community.id}/join`);
      await auth.switchCommunity(community.id);
    },
    onSuccess: () => setBusyId(null),
    onError: (caught) => {
      setError(caught instanceof Error ? caught.message : 'Gagal masuk komunitas');
      setBusyId(null);
    },
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Stat label="Komunitas" value={stats.data?.communities ?? 0} />
        <Stat label="Pengguna" value={stats.data?.users ?? 0} />
        <Stat label="Media" value={stats.data?.mediaCount ?? 0} />
        <Stat
          label="Penyimpanan"
          value={`${((stats.data?.mediaBytes ?? 0) / (1024 * 1024)).toFixed(1)} MB`}
        />
      </div>

      <QueryError error={communities.error ?? stats.error} onRetry={() => void communities.refetch()} />
      {error && <div className="rounded-xl bg-danger-100 px-4 py-3 text-sm text-danger-700">{error}</div>}

      <div className="flex justify-end">
        <Button onClick={() => setOpen(true)}>Buat komunitas</Button>
      </div>

      <Card className="p-0">
        {communities.isLoading ? (
          <div className="p-5">
            <SkeletonRows />
          </div>
        ) : (communities.data?.items.length ?? 0) === 0 ? (
          <EmptyState title="Belum ada komunitas" caption="Buat komunitas pertama untuk mulai." />
        ) : (
          <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-[11px] uppercase tracking-wider text-ink-muted">
                <th className="px-5 py-3 font-semibold">Komunitas</th>
                <th className="px-3 py-3 font-semibold">Anggota</th>
                <th className="px-3 py-3 font-semibold">Rumah</th>
                <th className="px-3 py-3 font-semibold">Media</th>
                <th className="px-3 py-3 font-semibold">Dibuat</th>
                <th className="px-5 py-3 text-right font-semibold">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {communities.data?.items.map((community) => (
                <tr key={community.id} className="border-b border-line last:border-0 hover:bg-paper">
                  <td className="px-5 py-3">
                    <p className="font-medium">{community.name}</p>
                    <p className="text-xs text-ink-muted">/{community.slug}</p>
                  </td>
                  <td className="px-3 py-3">{community.memberCount}</td>
                  <td className="px-3 py-3">{community.houseCount}</td>
                  <td className="px-3 py-3">{(community.mediaBytes / (1024 * 1024)).toFixed(1)} MB</td>
                  <td className="px-3 py-3 text-ink-muted">{formatDate(community.createdAt)}</td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="secondary"
                        disabled={busyId === community.id}
                        onClick={() => {
                          setBusyId(community.id);
                          join.mutate(community);
                        }}
                      >
                        Masuk sebagai admin
                      </Button>
                      <Button
                        variant={community.isActive ? 'ghost' : 'danger'}
                        disabled={busyId === community.id}
                        onClick={() => {
                          setBusyId(community.id);
                          toggle.mutate(community);
                        }}
                      >
                        {community.isActive ? 'Suspend' : 'Aktifkan'}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </Card>

      <Modal
        open={open}
        title="Buat komunitas"
        onClose={() => setOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Batal
            </Button>
            <Button onClick={() => create.mutate()} disabled={create.isPending}>
              Buat
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-muted">Nama</span>
            <input
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                setSlug(
                  event.target.value
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/g, '-')
                    .replace(/^-|-$/g, '')
                    .slice(0, 40),
                );
              }}
              className="w-full rounded-xl border border-line px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-muted">Slug</span>
            <input
              value={slug}
              onChange={(event) => setSlug(event.target.value)}
              className="w-full rounded-xl border border-line px-3 py-2 font-mono text-sm"
              placeholder="kampung-melati"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-muted">Alamat</span>
            <input
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              className="w-full rounded-xl border border-line px-3 py-2 text-sm"
            />
          </label>
        </div>
      </Modal>

      <Modal
        open={invite !== null}
        title="Kode undangan admin"
        onClose={() => setInvite(null)}
        footer={<Button onClick={() => setInvite(null)}>Tutup</Button>}
      >
        {invite && (
          <div className="space-y-2">
            <p className="text-sm">
              Komunitas <strong>{invite.community}</strong> dibuat. Bagikan kode ini ke admin komunitas:
            </p>
            <p className="rounded-xl bg-paper px-4 py-4 text-center text-2xl font-bold tracking-[0.3em]">
              {invite.code}
            </p>
            <p className="text-xs text-ink-muted">Berlaku 30 hari · sekali pakai.</p>
          </div>
        )}
      </Modal>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">{label}</p>
      <p className="text-xl font-semibold">{value}</p>
    </Card>
  );
}
