import { useQueryClient } from '@tanstack/react-query';
import { type PropsWithChildren, useEffect } from 'react';
import { useAuth } from './auth/AuthProvider';
import { webEnv } from './config/env';

export function LiveUpdates({ children }: PropsWithChildren) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user) return;
    const source = new EventSource(`${webEnv.VITE_API_URL}/api/v1/live-updates`, {
      withCredentials: true,
    });
    const refresh = () =>
      void queryClient.invalidateQueries({
        predicate: (query) => query.queryKey[0] !== 'current-user',
      });
    source.addEventListener('refresh', refresh);
    return () => {
      source.removeEventListener('refresh', refresh);
      source.close();
    };
  }, [queryClient, user]);

  return children;
}
