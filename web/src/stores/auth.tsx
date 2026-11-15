import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  api,
  fetchMe,
  login as loginRequest,
  logout as logoutRequest,
  refreshSession,
  setAccessToken,
} from '../api/client';
import type { CommunityInfo, MembershipDto, MeResponse } from '../api/types';

export type AuthUser = MeResponse['user'];

type AuthState = {
  ready: boolean;
  user: AuthUser | null;
  membership: MembershipDto | null;
  memberships: MembershipDto[];
  community: CommunityInfo | null;
  platformAdmin: boolean;
  needsCommunityPick: boolean;
  pendingMemberships: MembershipDto[];
};

type AuthContextValue = AuthState & {
  login: (phone: string, password: string, communityId?: string) => Promise<void>;
  logout: () => Promise<void>;
  switchCommunity: (communityId: string) => Promise<void>;
  reload: () => Promise<void>;
};

const emptyState: AuthState = {
  ready: false,
  user: null,
  membership: null,
  memberships: [],
  community: null,
  platformAdmin: false,
  needsCommunityPick: false,
  pendingMemberships: [],
};

const AuthContext = createContext<AuthContextValue | null>(null);

function stateFromMe(me: MeResponse): AuthState {
  return {
    ready: true,
    user: me.user,
    membership: me.membership,
    memberships: me.memberships,
    community: me.community
      ? { ...me.community, address: null, memberCount: 0, houseCount: 0 }
      : null,
    platformAdmin: me.user.isPlatformAdmin,
    needsCommunityPick: !me.membership && me.memberships.length > 1,
    pendingMemberships: me.memberships,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(emptyState);

  const reload = useCallback(async () => {
    const me = await fetchMe();
    setState(stateFromMe(me));
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const session = await refreshSession();
      if (cancelled) return;

      if (!session) {
        setState({ ...emptyState, ready: true });
        return;
      }

      try {
        const me = await fetchMe();
        if (!cancelled) setState(stateFromMe(me));
      } catch {
        if (!cancelled) setState({ ...emptyState, ready: true });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [reload]);

  const login = useCallback(
    async (phone: string, password: string, communityId?: string) => {
      const data = await loginRequest(phone, password, communityId);
      setState(stateFromMe(data));
      await reload();
    },
    [reload],
  );

  const logout = useCallback(async () => {
    await logoutRequest();
    setAccessToken(null);
    setState({ ...emptyState, ready: true });
  }, []);

  const switchCommunity = useCallback(
    async (communityId: string) => {
      const result = await api.post<{ accessToken: string }>('auth/switch-community', { communityId });
      setAccessToken(result.accessToken);
      await reload();
    },
    [reload],
  );

  const value = useMemo<AuthContextValue>(
    () => ({ ...state, login, logout, switchCommunity, reload }),
    [state, login, logout, switchCommunity, reload],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth harus dipakai di dalam AuthProvider');
  return context;
}

export function canManageFinance(role: string | undefined): boolean {
  return role === 'admin' || role === 'pengurus' || role === 'bendahara';
}

export function canManageCommunity(role: string | undefined): boolean {
  return role === 'admin' || role === 'pengurus';
}
