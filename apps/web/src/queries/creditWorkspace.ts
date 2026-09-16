import type { QueryClient } from '@tanstack/react-query';

export type PlanSummaryRead = {
  status: string;
  canRespond: boolean;
  openActionCount: number;
  completedActionCount: number;
  totalActionCount: number;
  progressPercent: number | null;
  guidanceCount: number;
  milestoneCount: number;
  nextClientItem: { id: string; title: string; status: string } | null;
};
export type CreditWorkspaceRead = {
  generatedAt: string;
  currentFocus: {
    code: string;
    title: string;
    detail: string | null;
    owner: string;
    action: string;
    actionLabel: string;
  };
  plan: PlanSummaryRead;
  profile: {
    status: string;
    isCurrent: boolean;
    reason: string;
    effectiveAt: string | null;
    expiresAt: string | null;
  };
};

// U1 compatibility boundary: keep existing cache identities while their query
// implementations converge on GetPortalHome/GetCreditCenter/GetCreditPlan.
// No domain state lives here. Replace legacy query implementations in U1;
// underlying Review/Plan/Cycle adapters retire in U3/U4/U6 respectively.
export const creditWorkspaceRoots = {
  home: 'portal-home',
  journey: 'portal-journey',
  creditCenter: 'published-credit-center',
  plan: 'client-plan',
  consultantCreditCenter: 'consultant-published-credit-center',
  consultantJourney: 'consultant-client-journey',
} as const;

export const creditWorkspaceKeys = {
  home: () => [creditWorkspaceRoots.home] as const,
  journey: () => [creditWorkspaceRoots.journey] as const,
  creditCenter: () => [creditWorkspaceRoots.creditCenter] as const,
  plan: () => [creditWorkspaceRoots.plan] as const,
  consultantCreditCenter: (clientId: string | undefined) =>
    [creditWorkspaceRoots.consultantCreditCenter, clientId] as const,
  consultantJourney: (clientId: string | undefined) =>
    [creditWorkspaceRoots.consultantJourney, clientId] as const,
};

export const creditWorkspaceRefreshRoots = Object.values(creditWorkspaceRoots);

// These source changes can alter focus, readiness, blockers or Plan context.
// Realtime hints cause authenticated refetches, never local domain transitions.
const refreshDomains = new Set([
  'application-cycles',
  'credit-profile',
  'review',
  'plan',
  'strategy',
  'appointments',
  'live-sessions',
  'journey',
  'home',
  'services',
  'major-readiness',
]);
export const creditWorkspaceRootsForDomains = (domains: readonly string[]) =>
  domains.some((domain) => refreshDomains.has(domain)) ? creditWorkspaceRefreshRoots : [];

export function invalidateCreditWorkspace(client: QueryClient) {
  return Promise.all(
    creditWorkspaceRefreshRoots.map((root) => client.invalidateQueries({ queryKey: [root] })),
  );
}
