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
    ? 'Live updates are connected.'
    : 'Reconnecting to live updates. You are viewing the last confirmed state; recent changes may not appear yet.';

const queryRootsByDomain: Record<LiveEventDomain, string[]> = {
  'application-cycles': ['application-cycles', 'rounds', 'portal-home', 'portal-journey'],
  'credit-profile': [
    'credit-profile',
    'published-credit-center',
    'consultant-published-credit-center',
    'portal-home',
    'portal-journey',
  ],
  documents: [
    'documents',
    'review-documents',
    'client-documents',
    'document-picker',
    'plan-response-draft',
    'plan-draft-library',
  ],
  notifications: ['notifications'],
  review: [
    'reviews',
    'review',
    'review-eligibility',
    'consultant-reviews',
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
    'plan-library',
    'plan-version-history',
    'plan-draft-library',
    'plan-response-draft',
    'post-round',
    'post-round-follow-ups',
    'portal-home',
    'portal-journey',
  ],
  strategy: ['strategy', 'portal-home', 'portal-journey'],
  appointments: ['appointments', 'calendar', 'portal-home', 'portal-journey'],
  'live-sessions': ['live-session', 'live-sessions'],
  journey: [
    'journey',
    'portal-home',
    'portal-journey',
    'client-360',
    'consultant-client-journey',
    'consultant-client-timeline',
  ],
  home: ['portal-home', 'portal-journey'],
};

export const queryRootsForLiveDomains = (domains: LiveEventDomain[]) => [
  ...new Set(domains.flatMap((domain) => queryRootsByDomain[domain] ?? [])),
];

// Events are refresh hints, never replacements for authenticated query data.
export function parseLiveUpdate(raw: string): LiveEventEnvelope | null {
  try {
    const value: unknown = JSON.parse(raw);
    if (
      !value ||
      typeof value !== 'object' ||
      !('domains' in value) ||
      !Array.isArray(value.domains) ||
      !value.domains.every((domain) => typeof domain === 'string')
    )
      return null;
    const domains = [
      ...new Set(
        value.domains.filter((domain): domain is LiveEventDomain =>
          Object.hasOwn(queryRootsByDomain, domain),
        ),
      ),
    ];
    return domains.length ? { ...value, domains } : null;
  } catch {
    return null;
  }
}

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
      if (!active) return;
      const update = parseLiveUpdate(message.data);
      if (!update) return;
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
