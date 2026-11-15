import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import type { HouseDto, MemberDto, Role } from '../api/types';
import { Button, Card, EmptyState, Modal, QueryError, SkeletonRows } from '../components/ui';
import { useAuth } from '../stores/auth';

const roles: Role[] = ['warga', 'satpam', 'bendahara', 'pengurus', 'admin'];

export function Warga() {
  const auth = useAuth();
  const queryClient = useQueryClient();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [inviteRole, setInviteRole] = useState<Role>('pengurus');
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [importText, setImportText] = useState('');
  const [tempPassword, setTempPassword] = useState<{ name: string; password: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const members = useQuery({
    queryKey: ['members'],
    queryFn: () => api.get<{ items: MemberDto[] }>('members'),
  });

  const patchMember = useMutation({
    mutationFn: (input: { id: string; body: Record<string, unknown> }) =>
      api.patch<MemberDto>(`members/${input.id}`, input.body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['members'] });
      setError(null);
    },
    onError: (caught) => setError(caught instanceof Error ? caught.message : 'Gagal menyimpan'),
  });

  const resetPassword = useMutation({
    mutationFn: (member: MemberDto) =>
      api.post<{ temporaryPassword: string }>(`members/${member.membershipId}/reset-password`),
    onSuccess: (result, member) =>
      setTempPassword({ name: member.name, password: result.temporaryPassword }),
    onError: (caught) => setError(caught instanceof Error ? caught.message : 'Gagal reset'),
  });

  const createInvite = useMutation({
    mutationFn: () => api.post<{ code: string }>('invites', { role: inviteRole }),
    onSuccess: (result) => {
      setInviteCode(result.code);
      void queryClient.invalidateQueries({ queryKey: ['invites'] });
    },
    onError: (caught) => setError(caught instanceof Error ? caught.message : 'Gagal membuat kode'),
  });

  const importHouses = useMutation({
    mutationFn: () => {
      const items = importText
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const [block, number, label] = line.split(',').map((part) => part.trim());
          return { block: block ?? '', number: number ?? '', label };
        })
        .filter((item) => item.block && item.number);

      return api.post<{ created: number; skipped: number }>('houses/batch', { items });
    },
    onSuccess: (result) => {
      setImportOpen(false);
      setImportText('');
      setMessage(`${result.created} rumah ditambahkan, ${result.skipped} dilewati.`);
      void queryClient.invalidateQueries({ queryKey: ['houses'] });
    },
    onError: (caught) => setError(caught instanceof Error ? caught.message : 'Gagal impor'),
  });

  const houses = useQuery({
    queryKey: ['houses'],
    queryFn: () => api.get<{ items: HouseDto[] }>('houses'),
    enabled: importOpen,
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-muted">{members.data?.items.length ?? 0} anggota</p>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setImportOpen(true)}>
            Impor rumah
          </Button>
          <Button
            onClick={() => {
              setInviteOpen(true);
              setInviteCode(null);
            }}
          >
            Kode undangan
          </Button>
        </div>
      </div>

      {members.isError && <QueryError error={members.error} onRetry={() => void members.refetch()} />}
      {message && <div className="rounded-xl bg-brand-100 px-4 py-3 text-sm text-brand-700">{message}</div>}
      {error && <div className="rounded-xl bg-danger-100 px-4 py-3 text-sm text-danger-700">{error}</div>}

      <Card className="p-0">
        {members.isLoading ? (
          <div className="p-5">
            <SkeletonRows />
          </div>
        ) : (members.data?.items.length ?? 0) === 0 ? (
          <EmptyState title="Belum ada anggota" caption="Bagikan kode undangan untuk merekrut warga." />
        ) : (
          <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-[11px] uppercase tracking-wider text-ink-muted">
                <th className="px-5 py-3 font-semibold">Nama</th>
                <th className="px-3 py-3 font-semibold">Rumah</th>
                <th className="px-3 py-3 font-semibold">Role</th>
                <th className="px-3 py-3 font-semibold">Kepala keluarga</th>
                <th className="px-5 py-3 text-right font-semibold">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {members.data?.items.map((member) => (
                <tr key={member.membershipId} className="border-b border-line last:border-0 hover:bg-paper">
                  <td className="px-5 py-3">
                    <p className="font-medium">{member.name}</p>
                    <p className="text-xs text-ink-muted">{member.phone}</p>
                  </td>
                  <td className="px-3 py-3 text-ink-muted">{member.houseLabel ?? 'Tanpa unit'}</td>
                  <td className="px-3 py-3">
                    <select
                      value={member.role}
                      disabled={member.role === 'admin' && auth.membership?.role !== 'admin'}
                      onChange={(event) =>
                        patchMember.mutate({ id: member.membershipId, body: { role: event.target.value } })
                      }
                      className="rounded-lg border border-line bg-surface px-2 py-1 text-xs"
                    >
                      {roles.map((role) => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-3">
                    <input
                      type="checkbox"
                      checked={member.isHouseholdHead}
                      onChange={(event) =>
                        patchMember.mutate({
                          id: member.membershipId,
                          body: { isHouseholdHead: event.target.checked },
                        })
                      }
                    />
                  </td>
                  <td className="px-5 py-3 text-right">
                    <Button variant="ghost" onClick={() => resetPassword.mutate(member)}>
                      Reset password
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </Card>

      <Modal open={inviteOpen} title="Kode undangan staff" onClose={() => setInviteOpen(false)}>
        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-muted">Role</span>
            <select
              value={inviteRole}
              onChange={(event) => setInviteRole(event.target.value as Role)}
              className="w-full rounded-xl border border-line px-3 py-2 text-sm"
            >
              {roles
                .filter((role) => role !== 'admin' || auth.membership?.role === 'admin')
                .map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
            </select>
          </label>

          {inviteCode ? (
            <div className="rounded-xl bg-paper px-4 py-6 text-center">
              <p className="text-2xl font-bold tracking-[0.3em]">{inviteCode}</p>
              <p className="mt-2 text-xs text-ink-muted">Berlaku 30 hari · sekali pakai</p>
            </div>
          ) : (
            <Button onClick={() => createInvite.mutate()} disabled={createInvite.isPending}>
              Buat kode
            </Button>
          )}
        </div>
      </Modal>

      <Modal
        open={importOpen}
        title="Impor rumah"
        onClose={() => setImportOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setImportOpen(false)}>
              Batal
            </Button>
            <Button onClick={() => importHouses.mutate()} disabled={importHouses.isPending}>
              Impor
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-ink-muted">
            Satu baris per rumah: <code>blok,nomor,label</code>. Contoh: <code>A,01,Blok A No. 1</code>.
          </p>
          <textarea
            value={importText}
            onChange={(event) => setImportText(event.target.value)}
            rows={6}
            className="w-full rounded-xl border border-line px-3 py-2 font-mono text-xs"
            placeholder={'A,01,Blok A No. 1\nA,02,Blok A No. 2'}
          />
          <p className="text-xs text-ink-muted">{houses.data?.items.length ?? 0} rumah tercatat saat ini.</p>
        </div>
      </Modal>

      <Modal
        open={tempPassword !== null}
        title="Password sementara"
        onClose={() => setTempPassword(null)}
        footer={<Button onClick={() => setTempPassword(null)}>Tutup</Button>}
      >
        {tempPassword && (
          <div className="space-y-2">
            <p className="text-sm">
              Password baru untuk <strong>{tempPassword.name}</strong>:
            </p>
            <p className="rounded-xl bg-paper px-4 py-4 text-center text-2xl font-bold tracking-widest">
              {tempPassword.password}
            </p>
            <p className="text-xs text-danger-700">
              Password ini hanya ditampilkan sekali. Minta anggota segera menggantinya.
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
}
