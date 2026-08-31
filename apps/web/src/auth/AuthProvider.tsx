import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, type PropsWithChildren } from 'react';
import { ApiRequestError, apiRequest, type CurrentUser } from './api';

type AuthState = {
  user: CurrentUser | null;
  loading: boolean;
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
  const query = useQuery({
    queryKey: ['current-user'],
    queryFn: () => apiRequest<{ user: CurrentUser }>('/api/me'),
    retry: false,
    enabled: initialUser === undefined,
  });
  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['current-user'] });
  };
  const logout = async () => {
    await apiRequest<void>('/api/auth/sign-out', { method: 'POST' });
    queryClient.setQueryData(['current-user'], null);
  };
  return (
    <AuthContext.Provider
      value={{
        user: initialUser ?? query.data?.user ?? null,
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
