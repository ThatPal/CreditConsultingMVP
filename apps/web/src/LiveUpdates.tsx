import { apiRequest, type CurrentUser } from './auth/api';
import { signalSessionLoss } from './auth/sessionLoss';
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
  | 'journey'
  | 'home';
type LiveEventEnvelope = { domains: LiveEventDomain[] };
export type LiveConnectionState = 'connected' | 'reconnecting';
export const LIVE_CONNECTION_EVENT = 'credit:live-connection';
export const liveConnectionCopy = (state: LiveConnectionState) =>
  state === 'connected'
    ? 'Realtime updates are connected; committed server state remains authoritative.'
    : 'Realtime updates are reconnecting. The last confirmed state remains visible; new releases stay governed.';

const queryRootsByDomain: Record<LiveEventDomain, string[]> = {
  'application-cycles': ['application-cycles', 'rounds', 'portal-home', 'portal-journey'],
  'credit-profile': [
    'credit-profile',
    'published-credit-center',
    'consultant-published-credit-center',
    'portal-home',
    'portal-journey',
  ],
  documents: ['documents', 'review-documents'],
  notifications: ['notifications'],
  review: [
    'reviews',
    'review-workspace',
    'credit-center',
    'published-credit-center',
    'consultant-published-credit-center',
    'portal-home',
    'portal-journey',
  ],
  services: ['services', 'purchases'],
  support: ['support', 'support-cases'],
  'work-queue': ['work-queue', 'shell-client-context'],
  'major-readiness': ['major-readiness'],
  plan: [
    'plan',
    'client-plan',
    'plan-builder',
    'plan-execution',
    'plan-sources',
    'post-round',
    'post-round-follow-ups',
    'portal-home',
    'portal-journey',
  ],
  strategy: ['strategy', 'portal-home', 'portal-journey'],
  appointments: ['appointments', 'calendar', 'portal-home', 'portal-journey'],
  'live-sessions': ['live-session', 'live-sessions'],
  journey: ['journey', 'portal-home', 'portal-journey'],
  home: ['portal-home', 'portal-journey'],
};

export const queryRootsForLiveDomains = (domains: LiveEventDomain[]) => [
  ...new Set(domains.flatMap((domain) => queryRootsByDomain[domain] ?? [])),
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
    let active = true;
    let checking = false;
    const ended = () => {
      source.close();
      signalSessionLoss();
    };
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
      window.dispatchEvent(
        new CustomEvent<LiveConnectionState>(LIVE_CONNECTION_EVENT, { detail: 'connected' }),
      );
    };
    source.onerror = () => {
      if (!checking && active) {
        checking = true;
        void apiRequest<{ user: CurrentUser }>('/api/me')
          .then(({ user: current }) => {
            if (
              active &&
              (current.userId !== user.userId ||
                current.role !== user.role ||
                current.clientId !== user.clientId ||
                current.status !== 'ACTIVE' ||
                (user.role !== 'CLIENT' && !current.staffMfaVerified))
            )
              ended();
          })
          .catch(() => undefined)
          .finally(() => {
            checking = false;
          });
      }
      window.dispatchEvent(
        new CustomEvent<LiveConnectionState>(LIVE_CONNECTION_EVENT, { detail: 'reconnecting' }),
      );
    };
    source.addEventListener('refresh', refresh);
    source.addEventListener('session-ended', ended);
    return () => {
      active = false;
      source.onopen = null;
      source.onerror = null;
      source.removeEventListener('session-ended', ended);
      source.removeEventListener('refresh', refresh);
      source.close();
    };
  }, [queryClient, user]);

  return children;
}
