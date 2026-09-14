import { bindRequestActor } from './requestActor';
import { clearPlanTabRecovery } from './tabRecovery';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import { ApiRequestError, apiRequest, type CurrentUser } from './api';
import { signalSessionLoss, subscribeToSessionLoss } from './sessionLoss';
import { connectSessionTabs } from './sessionTabs';

type AuthState = {
  user: CurrentUser | null;
  loading: boolean;
  sessionExpired: boolean;
  error: boolean;
  refresh: (notifyOtherTabs?: boolean) => Promise<void>;
  logout: () => Promise<void>;
};
const AuthContext = createContext<AuthState | null>(null);
export const SessionEndedContext = createContext(false);

export function AuthProvider({
  children,
  initialUser,
}: PropsWithChildren<{ initialUser?: CurrentUser }>) {
  const queryClient = useQueryClient();
  const sessionTabs = useRef<ReturnType<typeof connectSessionTabs> | null>(null);
  useEffect(() => {
    const connection = connectSessionTabs(signalSessionLoss);
    sessionTabs.current = connection;
    return () => {
      connection.close();
      sessionTabs.current = null;
    };
  }, []);
  const userRef = useRef<CurrentUser | null>(initialUser ?? null);
  const [sessionLost, setSessionLost] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);
  const query = useQuery({
    queryKey: ['current-user'],
    queryFn: async () => {
      const result = await apiRequest<{ user: CurrentUser }>('/api/me');
      const previous = userRef.current;
      if (
        previous &&
        (previous.userId !== result.user.userId ||
          previous.clientId !== result.user.clientId ||
          previous.role !== result.user.role ||
          previous.status !== result.user.status)
      ) {
        signalSessionLoss();
        return null;
      }
      bindRequestActor(result.user.userId);
      return result;
    },
    retry: false,
    enabled: initialUser === undefined,
  });
  const resolvedUser = sessionLost ? null : (initialUser ?? query.data?.user ?? null);
  useLayoutEffect(() => {
    if (resolvedUser) bindRequestActor(resolvedUser.userId);
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
  const refresh = async (notifyOtherTabs = false) => {
    if (notifyOtherTabs) sessionTabs.current?.publish();
    setSessionExpired(false);
    setSessionLost(false);
    await queryClient.invalidateQueries({ queryKey: ['current-user'] });
  };
  const logout = async () => {
    await apiRequest<void>('/api/auth/sign-out', { method: 'POST' });
    signalSessionLoss();
    sessionTabs.current?.publish();
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
      <SessionEndedContext.Provider value={sessionLost}>{children}</SessionEndedContext.Provider>
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
