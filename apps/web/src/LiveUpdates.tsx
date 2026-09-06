import { useQueryClient } from '@tanstack/react-query';
import { type PropsWithChildren, useEffect } from 'react';
import { useAuth } from './auth/AuthProvider';
import { webEnv } from './config/env';
type LiveEventDomain =
  | 'application-cycles'
  | 'credit-profile'
  | 'documents'
  | 'notifications'
  | 'review'
  | 'services'
  | 'support'
  | 'work-queue'
  | 'major-readiness'
  | 'plan'
  | 'strategy'
  | 'appointments'
  | 'live-sessions'
  | 'journey';
type LiveEventEnvelope = { domains: LiveEventDomain[] };

const queryRootsByDomain: Record<LiveEventDomain, string[]> = {
  'application-cycles': ['application-cycles', 'rounds'],
  'credit-profile': ['credit-profile'],
  documents: ['documents', 'review-documents'],
  notifications: ['notifications'],
  review: ['reviews', 'review-workspace', 'credit-center'],
  services: ['services', 'purchases'],
  support: ['support', 'support-cases'],
  'work-queue': ['work-queue'],
  'major-readiness': ['major-readiness'],
  plan: ['plan', 'post-round', 'post-round-follow-ups'],
  strategy: ['strategy'],
  appointments: ['appointments', 'calendar'],
  'live-sessions': ['live-session', 'live-sessions'],
  journey: ['journey'],
};

export const queryRootsForLiveDomains = (domains: LiveEventDomain[]) => [
  ...new Set(domains.flatMap((domain) => queryRootsByDomain[domain])),
];

export function LiveUpdates({ children }: PropsWithChildren) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user) return;
    const source = new EventSource(`${webEnv.VITE_API_URL}/api/v1/live-updates`, {
      withCredentials: true,
    });
    let connected = false;
    const refresh = (message: MessageEvent<string>) => {
      const update = JSON.parse(message.data) as LiveEventEnvelope;
      const roots = queryRootsForLiveDomains(update.domains);
      void queryClient.invalidateQueries({
        predicate: (query) => roots.includes(String(query.queryKey[0])),
      });
      window.dispatchEvent(new CustomEvent('credit:live-update', { detail: update }));
    };
    source.onopen = () => {
      if (connected)
        void queryClient.invalidateQueries({
          predicate: (query) => query.queryKey[0] !== 'current-user',
        });
      connected = true;
    };
    source.addEventListener('refresh', refresh);
    return () => {
      source.removeEventListener('refresh', refresh);
      source.close();
    };
  }, [queryClient, user]);

  return children;
}
