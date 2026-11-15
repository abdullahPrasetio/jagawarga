import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import type { AnnouncementDto, Paginated } from '../api/types';
import { Button, Card, EmptyState, QueryError, StatusPill, formatDateTime } from '../components/ui';

const categories = ['umum', 'keamanan', 'kegiatan', 'darurat'] as const;

type Draft = {
  id?: string;
  title: string;
  body: string;
  category: string;
  isPinned: boolean;
  attachmentMediaId: string | null;
};

const emptyDraft: Draft = {
  title: '',
  body: '',
  category: 'umum',
  isPinned: false,
  attachmentMediaId: null,
};

export function Pengumuman() {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const list = useQuery({
    queryKey: ['announcements', 'all'],
    queryFn: () => api.get<Paginated<AnnouncementDto>>('announcements', { includeDrafts: 'true', limit: 50 }),
  });

  useEffect(() => {
    if (draft.id && list.data && !list.data.items.some((item) => item.id === draft.id)) {
      setDraft(emptyDraft);
    }
  }, [draft.id, list.data]);

  const save = useMutation({
    mutationFn: async (publish: boolean) => {
      const body = {
        title: draft.title,
        body: draft.body,
        category: draft.category,
        isPinned: draft.isPinned,
        attachmentMediaId: draft.attachmentMediaId,
      };

      const saved = draft.id
        ? await api.patch<AnnouncementDto>(`announcements/${draft.id}`, body)
        : await api.post<AnnouncementDto>('announcements', body);

      if (publish) await api.post(`announcements/${saved.id}/publish`);
      return saved;
    },
    onSuccess: (saved) => {
      setDraft({
        id: saved.id,
        title: saved.title,
        body: saved.body,
        category: saved.category,
        isPinned: saved.isPinned,
        attachmentMediaId: saved.attachmentMediaId,
      });
      setError(null);
      setMessage('Tersimpan.');
      void queryClient.invalidateQueries({ queryKey: ['announcements'] });
    },
    onError: (caught) => setError(caught instanceof Error ? caught.message : 'Gagal menyimpan'),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`announcements/${id}`),
    onSuccess: () => {
      setDraft(emptyDraft);
      void queryClient.invalidateQueries({ queryKey: ['announcements'] });
    },
  });

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append('file', file);
      return api.upload<{ id: string }>('media', form);
    },
    onSuccess: (media) => setDraft((current) => ({ ...current, attachmentMediaId: media.id })),
    onError: (caught) => setError(caught instanceof Error ? caught.message : 'Gagal unggah'),
  });

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[320px_1fr_340px]">
      <QueryError error={list.error} onRetry={() => void list.refetch()} />
      <Card className="p-0">
        <div className="border-b border-line px-4 py-3">
          <Button variant="secondary" className="w-full" onClick={() => setDraft(emptyDraft)}>
            + Pengumuman baru
          </Button>
        </div>
        {list.isLoading ? null : (list.data?.items.length ?? 0) === 0 ? (
          <EmptyState title="Belum ada pengumuman" caption="Tulis pengumuman pertama." />
        ) : (
          <ul className="divide-y divide-line">
            {list.data?.items.map((item) => (
              <li key={item.id}>
                <button
                  onClick={() =>
                    setDraft({
                      id: item.id,
                      title: item.title,
                      body: item.body,
                      category: item.category,
                      isPinned: item.isPinned,
                      attachmentMediaId: item.attachmentMediaId,
                    })
                  }
                  className={`w-full px-4 py-3 text-left hover:bg-paper ${
                    draft.id === item.id ? 'bg-brand-100/60' : ''
                  }`}
                >
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="text-xs text-ink-muted">
                    {item.category} · {item.publishedAt ? formatDateTime(item.publishedAt) : 'draf'}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <div className="space-y-3">
          <input
            value={draft.title}
            onChange={(event) => setDraft({ ...draft, title: event.target.value })}
            placeholder="Judul pengumuman"
            className="w-full rounded-xl border border-line px-3 py-3 text-lg font-semibold outline-none focus:border-brand-600"
          />

          <div className="flex flex-wrap items-center gap-2">
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setDraft({ ...draft, category })}
                className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                  draft.category === category
                    ? 'border-brand-600 bg-brand-100 text-brand-700'
                    : 'border-line text-ink-muted'
                }`}
              >
                {category}
              </button>
            ))}
            <label className="ml-2 flex items-center gap-2 text-xs text-ink-muted">
              <input
                type="checkbox"
                checked={draft.isPinned}
                onChange={(event) => setDraft({ ...draft, isPinned: event.target.checked })}
              />
              Sematkan di atas
            </label>
          </div>

          <textarea
            value={draft.body}
            onChange={(event) => setDraft({ ...draft, body: event.target.value })}
            rows={14}
            placeholder="Isi pengumuman…"
            className="w-full rounded-xl border border-line px-3 py-3 text-sm leading-relaxed outline-none focus:border-brand-600"
          />

          <div className="flex items-center gap-3">
            <label className="cursor-pointer rounded-xl border border-line px-3 py-2 text-sm text-ink-muted hover:bg-paper">
              {draft.attachmentMediaId ? 'Ganti gambar' : 'Tambah gambar'}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) upload.mutate(file);
                }}
              />
            </label>
            {draft.attachmentMediaId && (
              <button
                className="text-xs text-danger-700"
                onClick={() => setDraft({ ...draft, attachmentMediaId: null })}
              >
                Hapus gambar
              </button>
            )}
          </div>

          {error && <div className="rounded-xl bg-danger-100 px-3 py-2 text-sm text-danger-700">{error}</div>}
          {message && <div className="rounded-xl bg-brand-100 px-3 py-2 text-sm text-brand-700">{message}</div>}

          <div className="flex justify-end gap-2">
            {draft.id && (
              <Button variant="ghost" onClick={() => remove.mutate(draft.id!)}>
                Hapus
              </Button>
            )}
            <Button variant="secondary" onClick={() => save.mutate(false)} disabled={save.isPending}>
              Simpan draf
            </Button>
            <Button onClick={() => save.mutate(true)} disabled={save.isPending}>
              Terbitkan
            </Button>
          </div>
        </div>
      </Card>

      <div className="hidden xl:block">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">Pratinjau mobile</p>
        <div className="rounded-[28px] border border-line bg-paper p-3">
          <div className="rounded-2xl border border-line bg-surface p-4">
            <div className="flex items-start gap-2">
              {draft.isPinned && <span className="text-brand-600">📌</span>}
              <p className="text-base font-semibold">{draft.title || 'Judul pengumuman'}</p>
            </div>
            <p className="mt-1 text-xs text-ink-muted">
              {draft.category} · baru saja
            </p>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">
              {draft.body || 'Isi pengumuman akan tampil di sini.'}
            </p>
            <div className="mt-3">
              <StatusPill status={draft.id ? 'open' : 'pending'} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
