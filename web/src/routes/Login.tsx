import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiError } from '../api/client';
import type { MembershipDto } from '../api/types';
import { Button } from '../components/ui';
import { useAuth } from '../stores/auth';

export function Login() {
  const auth = useAuth();
  const navigate = useNavigate();

  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [choices, setChoices] = useState<MembershipDto[]>([]);

  async function submit(communityId?: string) {
    setBusy(true);
    setError(null);
    try {
      await auth.login(phone.trim(), password, communityId);
      navigate('/');
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === 'validation_failed') {
        const memberships = caught.payload.memberships;
        if (Array.isArray(memberships) && memberships.length > 0) {
          setChoices(memberships as MembershipDto[]);
          return;
        }
      }
      setError(caught instanceof Error ? caught.message : 'Gagal masuk');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center bg-paper p-6">
      <div className="w-full max-w-[400px] rounded-2xl border border-line bg-surface p-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-100 text-brand-700">
            ⛨
          </div>
          <div>
            <h1 className="text-2xl font-bold">Jaga Warga</h1>
            <p className="text-sm text-ink-muted">Masuk untuk mengelola komunitas</p>
          </div>
        </div>

        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void submit(choices.length === 1 ? choices[0]?.communityId : undefined);
          }}
        >
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Nomor HP</span>
            <input
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              inputMode="tel"
              required
              className="mt-1 w-full rounded-xl border border-line bg-surface px-3 py-3 text-[15px] outline-none focus:border-brand-600"
              placeholder="08xxxxxxxxxx"
            />
          </label>

          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Password</span>
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              required
              className="mt-1 w-full rounded-xl border border-line bg-surface px-3 py-3 text-[15px] outline-none focus:border-brand-600"
              placeholder="Minimal 8 karakter"
            />
          </label>

          {choices.length > 1 && (
            <div className="rounded-xl border border-line bg-paper p-3">
              <p className="mb-2 text-sm font-semibold">Pilih komunitas</p>
              {choices.map((membership) => (
                <button
                  key={membership.id}
                  type="button"
                  onClick={() => void submit(membership.communityId)}
                  className="mb-1 flex w-full items-center justify-between rounded-lg border border-line bg-surface px-3 py-2 text-left text-sm hover:bg-brand-100"
                >
                  <span>{membership.communityName}</span>
                  <span className="text-xs text-ink-muted">{membership.role}</span>
                </button>
              ))}
            </div>
          )}

          {error && (
            <div className="rounded-xl bg-danger-100 px-3 py-2 text-sm text-danger-700">{error}</div>
          )}

          <Button type="submit" disabled={busy} className="w-full">
            {busy ? 'Memproses…' : 'Masuk'}
          </Button>
        </form>

        <p className="mt-4 text-xs text-ink-muted">
          Lupa password? Hubungi admin komunitas untuk pembuatan password sementara.
        </p>
      </div>
    </div>
  );
}
