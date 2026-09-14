import { clearPlanTabRecovery } from './tabRecovery';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import { ApiRequestError, apiRequest, type CurrentUser } from './api';
import { subscribeToSessionLoss } from './sessionLoss';

type AuthState = {
  user: CurrentUser | null;
  loading: boolean;
  sessionExpired: boolean;
  error: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
};
const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({
  children,
  initialUser,
}: PropsWithChildren<{ initialUser?: CurrentUser }>) {
  const queryClient = useQueryClient();
  const [sessionLost, setSessionLost] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);
  const query = useQuery({
    queryKey: ['current-user'],
    queryFn: () => apiRequest<{ user: CurrentUser }>('/api/me'),
    retry: false,
    enabled: initialUser === undefined,
  });
  const resolvedUser = sessionLost ? null : (initialUser ?? query.data?.user ?? null);
  const userRef = useRef<CurrentUser | null>(resolvedUser);
  useEffect(() => {
    userRef.current = resolvedUser;
  }, [resolvedUser]);
  useEffect(
    () =>
      subscribeToSessionLoss(() => {
        if (!userRef.current) return;
        userRef.current = null;
        setSessionExpired(true);
        clearPlanTabRecovery();
        setSessionLost(true);
        queryClient.setQueryData(['current-user'], null);
        void queryClient.cancelQueries({
          predicate: (entry) => entry.queryKey[0] !== 'current-user',
        });
        queryClient.removeQueries({
          predicate: (entry) => entry.queryKey[0] !== 'current-user' && entry.meta?.public !== true,
        });
      }),
    [queryClient],
  );
  const refresh = async () => {
    setSessionExpired(false);
    setSessionLost(false);
    await queryClient.invalidateQueries({ queryKey: ['current-user'] });
  };
  const logout = async () => {
    await apiRequest<void>('/api/auth/sign-out', { method: 'POST' });
    userRef.current = null;
    setSessionExpired(false);
    clearPlanTabRecovery();
    setSessionLost(true);
    queryClient.setQueryData(['current-user'], null);
    await queryClient.cancelQueries({
      predicate: (entry) => entry.queryKey[0] !== 'current-user' && entry.meta?.public !== true,
    });
    queryClient.removeQueries({
      predicate: (entry) => entry.queryKey[0] !== 'current-user' && entry.meta?.public !== true,
    });
  };
  return (
    <AuthContext.Provider
      value={{
        user: resolvedUser,
        sessionExpired,
        loading: initialUser === undefined && query.isLoading,
        error:
          initialUser === undefined &&
          query.isError &&
          !(query.error instanceof ApiRequestError && query.error.status === 401),
        refresh,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
