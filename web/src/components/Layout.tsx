import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { subscribeEvents } from '../api/sse';
import type { AlertDto, Paginated } from '../api/types';
import { useAuth, canManageCommunity, canManageFinance } from '../stores/auth';

const navClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm transition-colors ${
    isActive ? 'bg-white/12 text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'
  }`;

export function Layout() {
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [menuOpen, setMenuOpen] = useState(false);

  const { data: activeAlerts } = useQuery({
    queryKey: ['alerts', 'active'],
    queryFn: () => api.get<{ items: AlertDto[] }>('alerts/active'),
    refetchInterval: 20_000,
  });

  useEffect(() => {
    const unsubscribe = subscribeEvents((event) => {
      if (event.event.startsWith('panic')) {
        void queryClient.invalidateQueries({ queryKey: ['alerts'] });
        void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      }
      if (event.event === 'announcement.published') {
        void queryClient.invalidateQueries({ queryKey: ['announcements'] });
      }
    });
    return unsubscribe;
  }, [queryClient]);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  const role = auth.membership?.role;
  const activeCount = activeAlerts?.items.length ?? 0;

  const sidebar = (
    <div className="flex h-full flex-col bg-brand-900 px-3 py-5">
      <div className="mb-6 flex items-center gap-2 px-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-sm font-bold text-white">
          JW
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white">Jaga Warga</p>
          <p className="truncate text-[11px] text-white/60">{auth.community?.name ?? 'Platform'}</p>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-1">
        {auth.membership && (
          <NavLink to="/" end className={navClass}>
            Dasbor
          </NavLink>
        )}
        {canManageFinance(role) && (
          <>
            <NavLink to="/pembayaran" className={navClass}>
              Pembayaran
            </NavLink>
            <NavLink to="/tagihan" className={navClass}>
              Tagihan
            </NavLink>
            <NavLink to="/kas" className={navClass}>
              Kas
            </NavLink>
          </>
        )}
        {canManageCommunity(role) && (
          <NavLink to="/warga" className={navClass}>
            Warga
          </NavLink>
        )}
        {auth.membership && (
          <NavLink to="/pengumuman" className={navClass}>
            Pengumuman
          </NavLink>
        )}
        {auth.membership && (
          <NavLink to="/alert" className={navClass}>
            <span className="flex-1">Alert</span>
            {activeCount > 0 && (
              <span className="rounded-full bg-danger-600 px-1.5 text-[11px] font-semibold text-white">
                {activeCount}
              </span>
            )}
          </NavLink>
        )}
        {auth.platformAdmin && (
          <NavLink to="/platform" className={navClass}>
            Platform
          </NavLink>
        )}
      </nav>

      <div className="border-t border-white/10 pt-3">
        <p className="truncate px-2 text-sm font-medium text-white">{auth.user?.name}</p>
        <p className="px-2 text-[11px] text-white/60">{role ?? 'platform admin'}</p>
        <button
          onClick={async () => {
            await auth.logout();
            navigate('/login');
          }}
          className="mt-2 w-full rounded-lg px-2 py-1.5 text-left text-xs text-white/60 hover:bg-white/10"
        >
          Keluar
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-full">
      {/* Sidebar tetap untuk layar lebar */}
      <aside className="hidden w-[240px] shrink-0 lg:block">{sidebar}</aside>

      {/* Drawer untuk ponsel/tablet */}
      <div
        className={`fixed inset-0 z-40 lg:hidden ${menuOpen ? '' : 'pointer-events-none'}`}
        aria-hidden={!menuOpen}
      >
        <div
          className={`absolute inset-0 bg-ink/40 transition-opacity ${
            menuOpen ? 'opacity-100' : 'opacity-0'
          }`}
          onClick={() => setMenuOpen(false)}
        />
        <aside
          className={`absolute inset-y-0 left-0 w-[260px] max-w-[80vw] shadow-xl transition-transform duration-200 ${
            menuOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          {sidebar}
        </aside>
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line bg-surface px-4 sm:h-16 lg:px-8">
          <button
            onClick={() => setMenuOpen(true)}
            className="rounded-lg p-2 text-ink hover:bg-paper lg:hidden"
            aria-label="Buka menu"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
              <path d="M2 4h14M2 9h14M2 14h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>

          <p className="min-w-0 flex-1 truncate text-base font-semibold sm:text-lg">
            {titleFor(location.pathname)}
          </p>

          <div className="flex items-center gap-2 sm:gap-3">
            {auth.memberships.length > 1 && (
              <select
                value={auth.membership?.communityId ?? ''}
                onChange={(event) => auth.switchCommunity(event.target.value)}
                className="max-w-[140px] truncate rounded-lg border border-line bg-surface px-2 py-1.5 text-xs sm:max-w-none sm:px-3 sm:py-2 sm:text-sm"
                aria-label="Pilih komunitas"
              >
                {auth.memberships.map((membership) => (
                  <option key={membership.communityId} value={membership.communityId}>
                    {membership.communityName}
                  </option>
                ))}
              </select>
            )}
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-paper text-xs font-semibold text-ink-muted sm:h-9 sm:w-9">
              {initials(auth.user?.name ?? '?')}
            </div>
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto bg-paper p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

function titleFor(path: string): string {
  const map: Record<string, string> = {
    '/': 'Dasbor',
    '/pembayaran': 'Pembayaran',
    '/tagihan': 'Tagihan',
    '/kas': 'Kas warga',
    '/warga': 'Warga',
    '/pengumuman': 'Pengumuman',
    '/alert': 'Alert',
    '/platform': 'Platform',
  };
  return map[path] ?? 'Jaga Warga';
}

export type AlertList = Paginated<AlertDto>;
