import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Alert } from './routes/Alert';
import { Dashboard } from './routes/Dashboard';
import { Kas } from './routes/Kas';
import { Login } from './routes/Login';
import { Pembayaran } from './routes/Pembayaran';
import { Pengumuman } from './routes/Pengumuman';
import { Platform } from './routes/Platform';
import { Tagihan } from './routes/Tagihan';
import { Warga } from './routes/Warga';
import { useAuth } from './stores/auth';

export function App() {
  const auth = useAuth();

  if (!auth.ready) {
    return (
      <div className="flex h-full items-center justify-center bg-paper text-sm text-ink-muted">
        Memuat…
      </div>
    );
  }

  if (!auth.user) return <Login />;

  if (auth.needsCommunityPick && auth.pendingMemberships.length > 0) {
    return (
      <div className="flex h-full items-center justify-center bg-paper p-6">
        <div className="w-full max-w-[420px] rounded-2xl border border-line bg-surface p-6">
          <h1 className="mb-1 text-lg font-semibold">Pilih komunitas</h1>
          <p className="mb-4 text-sm text-ink-muted">Akun Anda terdaftar di beberapa komunitas.</p>
          <div className="space-y-2">
            {auth.pendingMemberships.map((membership) => (
              <button
                key={membership.id}
                onClick={() => void auth.switchCommunity(membership.communityId)}
                className="flex w-full items-center justify-between rounded-xl border border-line px-4 py-3 text-left text-sm hover:bg-brand-100"
              >
                <span>{membership.communityName}</span>
                <span className="text-xs text-ink-muted">{membership.role}</span>
              </button>
            ))}
          </div>
          <button
            onClick={() => void auth.logout()}
            className="mt-4 text-xs text-ink-muted underline"
          >
            Keluar
          </button>
        </div>
      </div>
    );
  }

  if (auth.platformAdmin && !auth.membership) {
    return (
      <Routes>
        <Route element={<Layout />}>
          <Route path="/platform" element={<Platform />} />
          <Route path="*" element={<Navigate to="/platform" replace />} />
        </Route>
      </Routes>
    );
  }

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/pembayaran" element={<Pembayaran />} />
        <Route path="/tagihan" element={<Tagihan />} />
        <Route path="/kas" element={<Kas />} />
        <Route path="/warga" element={<Warga />} />
        <Route path="/pengumuman" element={<Pengumuman />} />
        <Route path="/alert" element={<Alert />} />
        <Route path="/platform" element={<Platform />} />
        <Route path="/login" element={<Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
